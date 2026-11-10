import { timingSafeEqual } from './admin-auth.js';
import { cryptoRandomHex, sha256 } from './crypto.js';
import { sendDiscordDm } from './discord.js';
import { ERROR_CODES, HttpError } from './http.js';
import { getState, setState } from './state.js';

// Sign-in without a password: the bot DMs the app owner a one-time link.
// Only the newest link works (a new one replaces the old), it expires after
// LINK_TTL_MS, and a new one can be sent at most once per RESEND_MS so the page
// cannot be used to flood the owner's DMs. Only the token's hash is stored.

export const LOGIN_LINK_PATH = '/admin/login/link';
export const LOGIN_CONFIRM_PATH = '/admin/login/confirm';
const STATE_KEY = 'admin_login_link';
const TOKEN_BYTES = 32;
const LINK_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;

// User-install link: adds the app to your own account, so the bot can DM you
// without sharing a server.
export function userInstallUrl(applicationId) {
  if (!applicationId) {
    return null;
  }
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', applicationId);
  url.searchParams.set('integration_type', '1');
  url.searchParams.set('scope', 'applications.commands');
  return url.toString();
}

export async function sendLoginLink(env, origin, now = Date.now()) {
  if (!env.DISCORD_TOKEN || !env.DISCORD_USER_ID) {
    throw new HttpError('the Discord app could not be read from DISCORD_TOKEN', 500, ERROR_CODES.discordAppUnknown);
  }
  const previous = parse(await getState(env.DB, STATE_KEY));
  if (previous?.sentAt && now - previous.sentAt < RESEND_MS) {
    throw new HttpError('a sign-in link was sent less than a minute ago', 429, ERROR_CODES.loginLinkTooSoon);
  }

  const token = cryptoRandomHex(TOKEN_BYTES);
  await setState(env.DB, STATE_KEY, JSON.stringify({ hash: await sha256(token), expiresAt: now + LINK_TTL_MS, sentAt: now }));
  const link = new URL(LOGIN_LINK_PATH, origin);
  link.searchParams.set('t', token);
  try {
    // <...> stops Discord from previewing the link.
    await sendDiscordDm(
      env,
      `Sign in to your Spotify stats admin page: <${link}>\nThe link works once, for 10 minutes. If you did not ask for it, ignore this message.`
    );
  } catch (error) {
    // Nothing was delivered: allow an immediate retry (e.g. after installing the app).
    await setState(env.DB, STATE_KEY, '');
    throw new HttpError(`Discord DM failed: ${error.message}`, 502, ERROR_CODES.loginLinkDmFailed);
  }
  return { sent: true };
}

export async function consumeLoginLink(env, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length !== TOKEN_BYTES * 2) {
    return false;
  }
  const stored = parse(await getState(env.DB, STATE_KEY));
  if (!stored?.hash || !(stored.expiresAt > now)) {
    return false;
  }
  if (!timingSafeEqual(await sha256(token), stored.hash)) {
    return false;
  }
  // Keep sentAt so the resend limit still applies after use.
  await setState(env.DB, STATE_KEY, JSON.stringify({ sentAt: stored.sentAt }));
  return true;
}

function parse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

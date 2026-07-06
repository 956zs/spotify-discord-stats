import { appConfig } from '../config.js';
import { MS_PER_DAY } from '../../shared/time.js';
import { trySendDiscordDm } from './discord.js';
import { requiredEnv } from './env.js';
import { getSpotifyRefreshTokenIssuedAt } from './spotify.js';
import { getState, setState } from './state.js';

const ISO_DATE_LENGTH = 10;

export async function runSpotifyReauthReminder(env) {
  const userId = env.DISCORD_REMINDER_USER_ID || env.DISCORD_USER_ID;
  if (!userId) {
    return { sent: false, reason: 'missing_reminder_user' };
  }

  const issuedAtRaw = await getSpotifyRefreshTokenIssuedAt(env);
  if (!issuedAtRaw) {
    return sendOncePerDay(
      env,
      'missing-issued-at',
      `Spotify refresh token issue date is not set.\n\n${reauthorizeText(env)}`
    );
  }

  const issuedAt = new Date(issuedAtRaw);
  if (Number.isNaN(issuedAt.getTime())) {
    return sendOncePerDay(
      env,
      'invalid-issued-at',
      `Spotify refresh token issue date is invalid: \`${issuedAtRaw}\`.\n\n${reauthorizeText(env)}`
    );
  }

  return sendExpiringTokenReminder(env, issuedAt);
}

function sendExpiringTokenReminder(env, issuedAt) {
  const expiresAt = new Date(
    issuedAt.getTime() + appConfig.spotifyRefreshTokenValidDays * MS_PER_DAY
  );
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / MS_PER_DAY);
  if (daysLeft > appConfig.spotifyReauthRemindDays) {
    return { sent: false, reason: 'not_due', daysLeft };
  }

  const message = tokenReminderMessage(daysLeft, expiresAt, env);
  return sendOncePerDay(env, `reauth-${expiresAt.toISOString().slice(0, ISO_DATE_LENGTH)}`, message);
}

function tokenReminderMessage(daysLeft, expiresAt, env) {
  if (daysLeft >= 0) {
    return `Spotify refresh token will need reauthorization in ${daysLeft} day(s). Expires around ${expiresAt.toISOString()}.\n\n${reauthorizeText(env)}`;
  }

  return `Spotify refresh token may already be expired. It expired around ${expiresAt.toISOString()}.\n\n${reauthorizeText(env)}`;
}

function reauthorizeText(env) {
  return `Authorize here: ${getSpotifyLoginUrl(env)}`;
}

function getSpotifyLoginUrl(env) {
  const baseUrl = env.PUBLIC_BASE_URL || new URL(env.SPOTIFY_REDIRECT_URI).origin;
  const url = new URL('/spotify/login', baseUrl);
  url.searchParams.set('token', requiredEnv(env, 'ADMIN_TOKEN'));
  return url.toString();
}

async function sendOncePerDay(env, reason, message) {
  const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
  const stateKey = `spotify_reauth_reminder_sent:${reason}`;
  if ((await getState(env.DB, stateKey)) === today) {
    return { sent: false, reason: 'already_sent_today' };
  }

  const notification = await trySendDiscordDm(env, message);
  await setState(env.DB, stateKey, today);
  if (!notification.sent) {
    return { sent: false, reason: 'discord_dm_failed', error: notification.error };
  }
  return { sent: true, reason };
}

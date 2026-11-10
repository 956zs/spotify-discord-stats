import { cryptoRandomHex } from './crypto.js';
import { ERROR_CODES, HttpError } from './http.js';

// The admin page signs in once (with ADMIN_TOKEN, or with a one-time link the bot
// DMs you, see login-link.js) and then carries a signed session cookie, so no token
// appears in URLs or browser history. The signing key is ADMIN_TOKEN when it is set
// (rotating it invalidates every session); without it, a random key kept in D1.
const SESSION_COOKIE = 'admin_session';
const SESSION_KEY_STATE = 'admin_session_key';
const SESSION_KEY_BYTES = 32;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_PER_SECOND = 1000;

export async function isAdminRequest(request, url, env) {
  const queryToken =
    url.searchParams.get('token') ||
    url.searchParams.get('admin_token') ||
    url.searchParams.get('key');
  if (queryToken) {
    return Boolean(env.ADMIN_TOKEN) && timingSafeEqual(queryToken, env.ADMIN_TOKEN);
  }
  const cookie = readCookie(request, SESSION_COOKIE);
  if (!cookie) {
    return false;
  }
  return verifySession(cookie, await sessionSecret(env));
}

export async function requireAdmin(request, url, env) {
  if (!(await isAdminRequest(request, url, env))) {
    throw new HttpError('unauthorized', 401, ERROR_CODES.unauthorized);
  }
}

// Password sign-in only exists when ADMIN_TOKEN is set.
export function hasPasswordLogin(env) {
  return Boolean(env.ADMIN_TOKEN);
}

export function checkAdminToken(token, env) {
  return hasPasswordLogin(env) && typeof token === 'string' && timingSafeEqual(token, env.ADMIN_TOKEN);
}

export async function createSessionCookie(env, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_SECONDS * MS_PER_SECOND;
  const signature = await sign(await sessionSecret(env), String(expiresAt));
  return cookie(`${expiresAt}.${signature}`, SESSION_TTL_SECONDS);
}

// Created once; INSERT .. DO NOTHING keeps the first key if two requests race.
export async function sessionSecret(env) {
  if (env.ADMIN_TOKEN) {
    return env.ADMIN_TOKEN;
  }
  const read = () => env.DB.prepare('SELECT value FROM app_state WHERE key = ?').bind(SESSION_KEY_STATE).first();
  const row = await read();
  if (row?.value) {
    return row.value;
  }
  await env.DB.prepare('INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING')
    .bind(SESSION_KEY_STATE, cryptoRandomHex(SESSION_KEY_BYTES))
    .run();
  return (await read()).value;
}

export function clearSessionCookie() {
  return cookie('', 0);
}

// Browsers set Sec-Fetch-Site themselves and pages cannot forge it. Origin is the
// fallback for clients that omit it; comparing it to request.url alone breaks behind
// proxies that rewrite the host (wrangler dev does).
export function requireSameOrigin(request, url) {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) {
    if (site !== 'same-origin') {
      throw new HttpError('forbidden', 403, ERROR_CODES.forbidden);
    }
    return;
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) {
    throw new HttpError('forbidden', 403, ERROR_CODES.forbidden);
  }
}

// JSON-only APIs: a cross-site page cannot send a JSON body without a CORS preflight,
// and SameSite=Strict keeps the session cookie off cross-site requests anyway.
export function requireSameOriginJson(request, url) {
  requireSameOrigin(request, url);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    throw new HttpError('expected application/json', 415, ERROR_CODES.expectedJson);
  }
}

export async function verifySession(value, secret, now = Date.now()) {
  const [expiresAtText, signature] = String(value ?? '').split('.');
  const expiresAt = Number(expiresAtText);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }
  return timingSafeEqual(signature, await sign(secret, expiresAtText));
}

function cookie(value, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

async function sign(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`admin-session:${message}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

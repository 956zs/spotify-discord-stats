import { requiredEnv } from './env.js';
import { HttpError } from './http.js';

// The admin page signs in once with ADMIN_TOKEN and then carries a signed session
// cookie, so the token stops appearing in URLs and browser history. Rotating
// ADMIN_TOKEN invalidates every session because it is also the signing key.
const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MS_PER_SECOND = 1000;

export async function isAdminRequest(request, url, env) {
  const expected = requiredEnv(env, 'ADMIN_TOKEN');
  const queryToken =
    url.searchParams.get('token') ||
    url.searchParams.get('admin_token') ||
    url.searchParams.get('key');
  if (queryToken) {
    return timingSafeEqual(queryToken, expected);
  }
  return verifySession(readCookie(request, SESSION_COOKIE), expected);
}

export async function requireAdmin(request, url, env) {
  if (!(await isAdminRequest(request, url, env))) {
    throw new HttpError('unauthorized', 401);
  }
}

export function checkAdminToken(token, env) {
  return typeof token === 'string' && timingSafeEqual(token, requiredEnv(env, 'ADMIN_TOKEN'));
}

export async function createSessionCookie(env, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_SECONDS * MS_PER_SECOND;
  const signature = await sign(requiredEnv(env, 'ADMIN_TOKEN'), String(expiresAt));
  return cookie(`${expiresAt}.${signature}`, SESSION_TTL_SECONDS);
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
      throw new HttpError('forbidden', 403);
    }
    return;
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) {
    throw new HttpError('forbidden', 403);
  }
}

// JSON-only APIs: a cross-site page cannot send a JSON body without a CORS preflight,
// and SameSite=Strict keeps the session cookie off cross-site requests anyway.
export function requireSameOriginJson(request, url) {
  requireSameOrigin(request, url);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    throw new HttpError('expected application/json', 415);
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

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

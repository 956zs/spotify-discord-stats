import crypto from 'node:crypto';
import http from 'node:http';
import { env, envInt } from './env.js';
import { getState, setState } from './db.js';
import { buildSpotifyAuthorizeUrl, exchangeSpotifyCode } from './spotify.js';

const STATE_TTL_MS = 10 * 60 * 1000;

let server;

export function getSpotifyLoginUrl() {
  const publicBaseUrl = getPublicBaseUrl();
  if (publicBaseUrl) {
    return new URL('/spotify/login', publicBaseUrl).toString();
  }

  return null;
}

export function startSpotifyOAuthServer(client) {
  if (server) {
    return server;
  }

  const port = envInt('AUTH_SERVER_PORT', 3000);
  if (port <= 0) {
    console.log('Spotify OAuth callback server disabled.');
    return null;
  }

  const host = env('AUTH_SERVER_HOST', '0.0.0.0');
  server = http.createServer((request, response) => {
    handleRequest(request, response, client).catch((error) => {
      console.error('OAuth callback failed:', error);
      sendHtml(response, 500, 'Spotify authorization failed', error.message);
    });
  });

  server.listen(port, host, () => {
    console.log(`Spotify OAuth callback server listening on ${host}:${port}`);
    console.log(`Spotify login URL: ${getSpotifyLoginUrl() ?? 'not configured'}`);
  });

  return server;
}

function getPublicBaseUrl() {
  const configured = env('PUBLIC_BASE_URL');
  if (configured) {
    return configured;
  }

  const redirectUri = env('SPOTIFY_REDIRECT_URI');
  if (!redirectUri) {
    return null;
  }

  try {
    const url = new URL(redirectUri);
    return url.origin;
  } catch {
    return null;
  }
}

async function handleRequest(request, response, client) {
  const url = new URL(request.url, getRequestBaseUrl(request));

  if (url.pathname === '/health') {
    sendText(response, 200, 'ok');
    return;
  }

  if (url.pathname === '/spotify/login') {
    const state = createOAuthState();
    response.writeHead(302, {
      Location: buildSpotifyAuthorizeUrl({ state })
    });
    response.end();
    return;
  }

  if (url.pathname === '/spotify/callback') {
    await handleCallback(url, response, client);
    return;
  }

  sendText(response, 404, 'not found');
}

async function handleCallback(url, response, client) {
  const error = url.searchParams.get('error');
  if (error) {
    sendHtml(response, 400, 'Spotify authorization denied', `Spotify returned: ${error}`);
    return;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    sendHtml(response, 400, 'Spotify authorization failed', 'Missing code or state.');
    return;
  }

  if (!consumeOAuthState(state)) {
    sendHtml(response, 400, 'Spotify authorization failed', 'Invalid or expired state.');
    return;
  }

  const token = await exchangeSpotifyCode(code);
  await notifyAuthorizationSuccess(client);
  sendHtml(
    response,
    200,
    'Spotify authorization complete',
    `Refresh token saved at ${new Date().toISOString()}. You can close this tab.`
  );

  if (!token.refresh_token) {
    console.warn('Spotify token response did not contain a refresh token.');
  }
}

function createOAuthState() {
  const state = crypto.randomBytes(24).toString('hex');
  setState(
    `spotify_oauth_state:${state}`,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString()
    })
  );
  return state;
}

function consumeOAuthState(state) {
  const key = `spotify_oauth_state:${state}`;
  const raw = getState(key);
  if (!raw) {
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  if (Date.parse(parsed.expiresAt) < Date.now()) {
    return false;
  }

  setState(key, 'used');
  return true;
}

async function notifyAuthorizationSuccess(client) {
  const userId = env('DISCORD_REMINDER_USER_ID') || env('DISCORD_USER_ID');
  if (!userId) {
    return;
  }

  const user = await client.users.fetch(userId);
  await user.send('Spotify authorization completed. New refresh token was saved on the VPS.');
}

function getRequestBaseUrl(request) {
  const host = request.headers.host ?? `127.0.0.1:${envInt('AUTH_SERVER_PORT', 3000)}`;
  return `http://${host}`;
}

function sendText(response, status, text) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(text);
}

function sendHtml(response, status, title, body) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </body>
</html>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

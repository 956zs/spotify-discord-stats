import { env, requiredEnv } from './env.js';
import {
  getState,
  setState,
  upsertSpotifyPlay
} from './db.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

export function buildSpotifyAuthorizeUrl(options = {}) {
  const clientId = requiredEnv('SPOTIFY_CLIENT_ID');
  const redirectUri = requiredEnv('SPOTIFY_REDIRECT_URI');
  const scope = [
    'user-read-recently-played'
  ].join(' ');

  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scope);
  url.searchParams.set('redirect_uri', redirectUri);
  if (options.state) {
    url.searchParams.set('state', options.state);
  }
  return url.toString();
}

export async function exchangeSpotifyCode(codeOrUrl) {
  const code = parseCode(codeOrUrl);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: requiredEnv('SPOTIFY_REDIRECT_URI')
  });

  const token = await spotifyTokenRequest(body);
  saveSpotifyTokenResponse(token);
  return token;
}

export async function refreshSpotifyAccessToken() {
  const refreshToken = getSpotifyRefreshToken();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const token = await spotifyTokenRequest(body);
  if (token.refresh_token && token.refresh_token !== refreshToken) {
    saveSpotifyTokenResponse(token);
    console.log('Spotify returned a new refresh token and it was saved to SQLite.');
  }
  return token.access_token;
}

export function getSpotifyRefreshToken() {
  const stored = getState('spotify_refresh_token');
  if (stored) {
    return stored;
  }

  const configured = env('SPOTIFY_REFRESH_TOKEN');
  if (configured) {
    return configured;
  }

  throw new Error('Missing Spotify refresh token. Open /spotify/login or run npm run spotify:auth-url.');
}

export function getSpotifyRefreshTokenIssuedAt() {
  return getState('spotify_refresh_token_issued_at') || env('SPOTIFY_REFRESH_TOKEN_ISSUED_AT');
}

export function saveSpotifyTokenResponse(token) {
  if (token.refresh_token) {
    setState('spotify_refresh_token', token.refresh_token);
    setState('spotify_refresh_token_issued_at', new Date().toISOString());
  }
}

async function spotifyTokenRequest(body) {
  const credentials = Buffer.from(
    `${requiredEnv('SPOTIFY_CLIENT_ID')}:${requiredEnv('SPOTIFY_CLIENT_SECRET')}`
  ).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new Error(`Spotify token error ${response.status}: ${errorDetail(payload)}`);
  }
  return payload;
}

function parseCode(codeOrUrl) {
  if (!codeOrUrl) {
    throw new Error('Pass a Spotify callback URL or code as the first argument.');
  }

  if (codeOrUrl.startsWith('http://') || codeOrUrl.startsWith('https://')) {
    const url = new URL(codeOrUrl);
    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('Callback URL did not contain a code query parameter.');
    }
    return code;
  }

  return codeOrUrl;
}

export async function syncRecentlyPlayed() {
  const accessToken = await refreshSpotifyAccessToken();
  const lastAfter = getState('spotify_recently_played_after_ms');
  const url = new URL(`${API_URL}/me/player/recently-played`);
  url.searchParams.set('limit', '50');
  if (lastAfter) {
    url.searchParams.set('after', lastAfter);
  }

  const response = await spotifyApiFetch(url, accessToken);
  const items = response.items ?? [];
  let inserted = 0;
  let maxPlayedAtMs = lastAfter ? Number(lastAfter) : 0;

  for (const item of items) {
    if (upsertSpotifyPlay(item)) {
      inserted += 1;
    }

    const playedAtMs = Date.parse(item.played_at);
    if (!Number.isNaN(playedAtMs)) {
      maxPlayedAtMs = Math.max(maxPlayedAtMs, playedAtMs);
    }
  }

  if (maxPlayedAtMs > 0) {
    setState('spotify_recently_played_after_ms', String(maxPlayedAtMs));
  }

  return { fetched: items.length, inserted };
}

async function spotifyApiFetch(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after') ?? 'unknown';
    throw new Error(`Spotify rate limited this request. Retry-After: ${retryAfter}`);
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new Error(`Spotify API error ${response.status}: ${errorDetail(payload)}`);
  }

  return payload;
}

async function responsePayload(response) {
  const text = await response.text();
  if (text.trim() === '') {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorDetail(payload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

export function hasSpotifyRefreshToken() {
  return Boolean(getState('spotify_refresh_token') || env('SPOTIFY_REFRESH_TOKEN'));
}

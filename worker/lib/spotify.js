import { upsertSpotifyPlay } from './plays.js';
import { requiredEnv } from './env.js';
import { ERROR_CODES, HttpError } from './http.js';
import { getState, setState } from './state.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const RECENTLY_PLAYED_LIMIT = 50;

export function buildSpotifyAuthorizeUrl(env, state) {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', requiredEnv(env, 'SPOTIFY_CLIENT_ID'));
  url.searchParams.set(
    'scope',
    ['user-read-recently-played'].join(' ')
  );
  url.searchParams.set('redirect_uri', requiredEnv(env, 'SPOTIFY_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeSpotifyCode(env, code) {
  const token = await spotifyTokenRequest(
    env,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: requiredEnv(env, 'SPOTIFY_REDIRECT_URI')
    })
  );
  await saveSpotifyTokenResponse(env.DB, token);
  return token;
}

export async function syncRecentlyPlayed(env) {
  const accessToken = await refreshSpotifyAccessToken(env);
  const lastAfter = await getState(env.DB, 'spotify_recently_played_after_ms');
  const url = new URL(`${SPOTIFY_API_URL}/me/player/recently-played`);
  url.searchParams.set('limit', String(RECENTLY_PLAYED_LIMIT));
  if (lastAfter) {
    url.searchParams.set('after', lastAfter);
  }

  const response = await spotifyApiFetch(url, accessToken);
  const items = response.items ?? [];
  const result = await persistRecentlyPlayed(env.DB, items, lastAfter);
  return { fetched: items.length, inserted: result.inserted };
}

export async function getSpotifyRefreshTokenIssuedAt(env) {
  return (
    (await getState(env.DB, 'spotify_refresh_token_issued_at')) ||
    env.SPOTIFY_REFRESH_TOKEN_ISSUED_AT ||
    null
  );
}

async function refreshSpotifyAccessToken(env) {
  const refreshToken = await getSpotifyRefreshToken(env);
  const token = await spotifyTokenRequest(
    env,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  );

  if (token.refresh_token && token.refresh_token !== refreshToken) {
    await saveSpotifyTokenResponse(env.DB, token);
  }

  return token.access_token;
}

async function spotifyTokenRequest(env, body) {
  const credentials = btoa(
    `${requiredEnv(env, 'SPOTIFY_CLIENT_ID')}:${requiredEnv(env, 'SPOTIFY_CLIENT_SECRET')}`
  );

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
    throw new HttpError(`Spotify token error ${response.status}: ${errorDetail(payload)}`, 500, ERROR_CODES.spotifyTokenFailed);
  }
  return payload;
}

async function getSpotifyRefreshToken(env) {
  const stored = await getState(env.DB, 'spotify_refresh_token');
  if (stored) {
    return stored;
  }

  if (env.SPOTIFY_REFRESH_TOKEN) {
    return env.SPOTIFY_REFRESH_TOKEN;
  }

  throw new HttpError(
    'Missing Spotify refresh token. Open /spotify/login with admin token.',
    500,
    ERROR_CODES.spotifyNotConnected
  );
}

async function saveSpotifyTokenResponse(db, token) {
  if (!token.refresh_token) {
    return;
  }

  await setState(db, 'spotify_refresh_token', token.refresh_token);
  await setState(db, 'spotify_refresh_token_issued_at', new Date().toISOString());
}

async function spotifyApiFetch(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after') ?? 'unknown';
    throw new HttpError(`Spotify rate limited this request. Retry-After: ${retryAfter}`, 500, ERROR_CODES.spotifyRateLimited);
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new HttpError(`Spotify API error ${response.status}: ${errorDetail(payload)}`, 500, ERROR_CODES.spotifyApiFailed);
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

async function persistRecentlyPlayed(db, items, lastAfter) {
  let inserted = 0;
  let maxPlayedAtMs = lastAfter ? Number(lastAfter) : 0;

  for (const item of items) {
    inserted += (await upsertSpotifyPlay(db, item)) ? 1 : 0;
    const playedAtMs = Date.parse(item.played_at);
    if (!Number.isNaN(playedAtMs)) {
      maxPlayedAtMs = Math.max(maxPlayedAtMs, playedAtMs);
    }
  }

  if (maxPlayedAtMs > 0) {
    await setState(db, 'spotify_recently_played_after_ms', String(maxPlayedAtMs));
  }
  return { inserted };
}

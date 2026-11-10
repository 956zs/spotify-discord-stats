import { sha256 } from './crypto.js';
import { ERROR_CODES, HttpError } from './http.js';
import { getState, setState } from './state.js';

// Settings that used to be required [vars] in wrangler.toml are now filled in at
// runtime, so a fresh deploy only needs DISCORD_TOKEN (ADMIN_TOKEN is optional, see login-link.js):
// - DISCORD_CLIENT_ID / DISCORD_USER_ID: looked up from the bot token (the app and its owner).
// - PUBLIC_BASE_URL: the origin the admin page was last opened on.
// - SPOTIFY_REDIRECT_URI: PUBLIC_BASE_URL + /spotify/callback.
// - SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET: entered on the admin page, saved in D1.
// A value set in Cloudflare (vars or secrets) always wins over the derived one.

export const SPOTIFY_CALLBACK_PATH = '/spotify/callback';

export const STATE_KEYS = {
  discordApp: 'discord_app',
  publicBaseUrl: 'public_base_url',
  spotifyClientId: 'spotify_client_id',
  spotifyClientSecret: 'spotify_client_secret'
};

const DISCORD_APP_URL = 'https://discord.com/api/v10/applications/@me';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const SPOTIFY_CLIENT_SECRET_PATTERN = /^[0-9a-f]{32}$/i;

export async function withRuntimeConfig(env, options = {}) {
  if (!env?.DB) {
    return env;
  }
  const stored = await readStoredValues(env.DB);
  const resolved = { ...env };

  const baseUrl =
    trimUrl(env.PUBLIC_BASE_URL) ||
    originOf(env.SPOTIFY_REDIRECT_URI) ||
    stored[STATE_KEYS.publicBaseUrl] ||
    options.requestOrigin ||
    null;
  if (baseUrl) {
    resolved.PUBLIC_BASE_URL = baseUrl;
    resolved.SPOTIFY_REDIRECT_URI = env.SPOTIFY_REDIRECT_URI || `${baseUrl}${SPOTIFY_CALLBACK_PATH}`;
  }

  resolved.SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID || stored[STATE_KEYS.spotifyClientId] || undefined;
  resolved.SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET || stored[STATE_KEYS.spotifyClientSecret] || undefined;

  if ((!env.DISCORD_CLIENT_ID || !env.DISCORD_USER_ID) && env.DISCORD_TOKEN) {
    const app = await discordApp(env, stored[STATE_KEYS.discordApp]);
    if (app) {
      resolved.DISCORD_CLIENT_ID = env.DISCORD_CLIENT_ID || app.applicationId;
      resolved.DISCORD_USER_ID = env.DISCORD_USER_ID || app.ownerId || undefined;
    }
  }

  return resolved;
}

// Signed-in admin requests remember their origin, so the cron run (which has no
// request) knows the public URL for uploaded images and reminder links.
export async function rememberPublicOrigin(env, origin) {
  if (env.PUBLIC_BASE_URL || env.SPOTIFY_REDIRECT_URI || !isHttpsOrigin(origin)) {
    return false;
  }
  if ((await getState(env.DB, STATE_KEYS.publicBaseUrl)) === origin) {
    return false;
  }
  await setState(env.DB, STATE_KEYS.publicBaseUrl, origin);
  return true;
}

// What the admin page shows on the Spotify app card. Never includes the secret.
export async function spotifyAppStatus(rawEnv, resolvedEnv) {
  const fromCloudflare = Boolean(rawEnv.SPOTIFY_CLIENT_ID && rawEnv.SPOTIFY_CLIENT_SECRET);
  return {
    clientId: resolvedEnv.SPOTIFY_CLIENT_ID || null,
    hasSecret: Boolean(resolvedEnv.SPOTIFY_CLIENT_SECRET),
    configured: Boolean(resolvedEnv.SPOTIFY_CLIENT_ID && resolvedEnv.SPOTIFY_CLIENT_SECRET),
    source: fromCloudflare ? 'cloudflare' : rawEnv.SPOTIFY_CLIENT_ID || rawEnv.SPOTIFY_CLIENT_SECRET ? 'mixed' : 'admin',
    redirectUri: resolvedEnv.SPOTIFY_REDIRECT_URI || null
  };
}

export function discordAppStatus(resolvedEnv) {
  return {
    applicationId: resolvedEnv.DISCORD_CLIENT_ID || null,
    userId: resolvedEnv.DISCORD_USER_ID || null
  };
}

export function parseSpotifyAppInput(body) {
  const clientId = String(body?.clientId ?? '').trim();
  const clientSecret = String(body?.clientSecret ?? '').trim();
  const invalid = [];
  if (!SPOTIFY_CLIENT_ID_PATTERN.test(clientId)) {
    invalid.push('Client ID');
  }
  if (!SPOTIFY_CLIENT_SECRET_PATTERN.test(clientSecret)) {
    invalid.push('Client Secret');
  }
  if (invalid.length > 0) {
    throw new HttpError('invalid Spotify app credentials', 400, ERROR_CODES.invalidSpotifyApp, invalid);
  }
  return { clientId, clientSecret };
}

// Checks the pair with Spotify (client credentials grant) before saving, so a typo
// shows up here instead of as a failed sign-in later.
export async function saveSpotifyApp(env, input) {
  if (env.SPOTIFY_CLIENT_ID || env.SPOTIFY_CLIENT_SECRET) {
    throw new HttpError('Spotify app is set in Cloudflare', 409, ERROR_CODES.spotifyAppFromCloudflare);
  }
  const { clientId, clientSecret } = parseSpotifyAppInput(input);
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  });
  if (response.status === 400 || response.status === 401) {
    throw new HttpError('Spotify rejected the Client ID or Client Secret', 400, ERROR_CODES.spotifyAppRejected);
  }
  if (!response.ok) {
    throw new HttpError(`Spotify check failed ${response.status}`, 502, ERROR_CODES.spotifyTokenFailed);
  }

  const previousId = await getState(env.DB, STATE_KEYS.spotifyClientId);
  await setState(env.DB, STATE_KEYS.spotifyClientId, clientId);
  await setState(env.DB, STATE_KEYS.spotifyClientSecret, clientSecret);
  // A refresh token belongs to the app that issued it; a different app needs a new sign-in.
  return { changedApp: Boolean(previousId) && previousId !== clientId };
}

async function readStoredValues(db) {
  const keys = Object.values(STATE_KEYS);
  const { results } = await db
    .prepare(`SELECT key, value FROM app_state WHERE key IN (${keys.map(() => '?').join(', ')})`)
    .bind(...keys)
    .all();
  return Object.fromEntries((results ?? []).map((row) => [row.key, row.value]));
}

// Cached per bot token (by hash), so a new token looks the app up again.
async function discordApp(env, storedRaw) {
  const tokenHash = await sha256(env.DISCORD_TOKEN);
  const cached = parseJson(storedRaw);
  if (cached?.tokenHash === tokenHash && cached.applicationId) {
    return cached;
  }

  let response;
  try {
    response = await fetch(DISCORD_APP_URL, {
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        'User-Agent': 'DiscordBot (https://github.com/956zs/spotify-discord-stats, 1.0.0)'
      }
    });
  } catch (error) {
    console.warn('Discord app lookup failed', error.message);
    return null;
  }
  if (!response.ok) {
    console.warn('Discord app lookup failed', response.status);
    return null;
  }

  const app = await response.json();
  const ownerId = app.team ? app.team.owner_user_id : app.owner?.id;
  const value = { tokenHash, applicationId: String(app.id), ownerId: ownerId ? String(ownerId) : null };
  await setState(env.DB, STATE_KEYS.discordApp, JSON.stringify(value));
  return value;
}

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function trimUrl(value) {
  return value ? String(value).replace(/\/+$/, '') : '';
}

function originOf(value) {
  try {
    return value ? new URL(value).origin : '';
  } catch {
    return '';
  }
}

function isHttpsOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.origin === origin;
  } catch {
    return false;
  }
}


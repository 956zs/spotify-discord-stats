import appConfig from '../config/app.json' with { type: 'json' };
import widgetConfig from '../config/widget.json' with { type: 'json' };

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const DISCORD_API_URL = 'https://discord.com/api/v9';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error(error);
      return json({ error: error.message }, error.status ?? 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  }
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  if (url.pathname === '/spotify/login') {
    requireAdminToken(url, env);
    const state = await createOAuthState(env.DB);
    return Response.redirect(buildSpotifyAuthorizeUrl(env, state), 302);
  }

  if (url.pathname === '/spotify/callback') {
    return handleSpotifyCallback(url, env);
  }

  if (url.pathname === '/admin/sync') {
    requireAdminToken(url, env);
    const result = await syncOnce(env, { forcePatch: true });
    return json(result);
  }

  if (url.pathname === '/admin/stats') {
    requireAdminToken(url, env);
    const stats = await getStats(env.DB, appConfig.statsDays);
    return json(stats);
  }

  return json({ error: 'not found' }, 404);
}

async function handleScheduled(env) {
  const result = await syncOnce(env);
  console.log('scheduled sync', result);
  try {
    const reminder = await runSpotifyReauthReminder(env);
    console.log('reauth reminder', reminder);
  } catch (error) {
    console.warn('reauth reminder failed', error.message);
  }
}

async function handleSpotifyCallback(url, env) {
  const spotifyError = url.searchParams.get('error');
  if (spotifyError) {
    return html('Spotify authorization denied', `Spotify returned: ${spotifyError}`, 400);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return html('Spotify authorization failed', 'Missing code or state.', 400);
  }

  if (!(await consumeOAuthState(env.DB, state))) {
    return html('Spotify authorization failed', 'Invalid or expired state.', 400);
  }

  const token = await exchangeSpotifyCode(env, code);
  const notification = await trySendDiscordDm(
    env,
    'Spotify authorization completed. New refresh token was saved in D1.'
  );

  if (!token.refresh_token) {
    console.warn('Spotify token response did not contain a refresh token.');
  }

  return html(
    'Spotify authorization complete',
    notification.sent
      ? `Refresh token saved at ${new Date().toISOString()}. You can close this tab.`
      : `Refresh token saved at ${new Date().toISOString()}. Discord DM was skipped: ${notification.error}. You can close this tab.`
  );
}

async function syncOnce(env, options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed(env);
  let genres;
  try {
    genres = await refreshMissingArtistGenres(env);
  } catch (error) {
    genres = { updated: 0, skipped: true, error: error.message };
  }
  const stats = await getStats(env.DB, appConfig.statsDays);

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(env, stats, { force: options.forcePatch });
  }

  return { recentlyPlayed, genres, stats, discord };
}

function buildSpotifyAuthorizeUrl(env, state) {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', requiredEnv(env, 'SPOTIFY_CLIENT_ID'));
  url.searchParams.set(
    'scope',
    ['user-read-recently-played', 'user-read-currently-playing'].join(' ')
  );
  url.searchParams.set('redirect_uri', requiredEnv(env, 'SPOTIFY_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeSpotifyCode(env, code) {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Spotify token error ${response.status}: ${JSON.stringify(payload)}`);
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

  throw new Error('Missing Spotify refresh token. Open /spotify/login with admin token.');
}

async function saveSpotifyTokenResponse(db, token) {
  if (!token.refresh_token) {
    return;
  }

  await setState(db, 'spotify_refresh_token', token.refresh_token);
  await setState(db, 'spotify_refresh_token_issued_at', new Date().toISOString());
}

async function syncRecentlyPlayed(env) {
  const accessToken = await refreshSpotifyAccessToken(env);
  const lastAfter = await getState(env.DB, 'spotify_recently_played_after_ms');
  const url = new URL(`${SPOTIFY_API_URL}/me/player/recently-played`);
  url.searchParams.set('limit', '50');
  if (lastAfter) {
    url.searchParams.set('after', lastAfter);
  }

  const response = await spotifyApiFetch(url, accessToken);
  const items = response.items ?? [];
  let inserted = 0;
  let maxPlayedAtMs = lastAfter ? Number(lastAfter) : 0;

  for (const item of items) {
    if (await upsertSpotifyPlay(env.DB, item)) {
      inserted += 1;
    }

    const playedAtMs = Date.parse(item.played_at);
    if (!Number.isNaN(playedAtMs)) {
      maxPlayedAtMs = Math.max(maxPlayedAtMs, playedAtMs);
    }
  }

  if (maxPlayedAtMs > 0) {
    await setState(env.DB, 'spotify_recently_played_after_ms', String(maxPlayedAtMs));
  }

  return { fetched: items.length, inserted };
}

async function refreshMissingArtistGenres(env, maxBatches = 3) {
  const accessToken = await refreshSpotifyAccessToken(env);
  let updated = 0;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const rows = await env.DB.prepare(`
      SELECT artist_key, artist_id
      FROM artists
      WHERE artist_id IS NOT NULL
        AND (genres_cached_at IS NULL OR genres_cached_at < datetime('now', '-30 days'))
      ORDER BY genres_cached_at IS NOT NULL, artist_name
      LIMIT 50
    `).all();

    if (!rows.results.length) {
      break;
    }

    const ids = rows.results.map((row) => row.artist_id).filter(Boolean);
    const url = new URL(`${SPOTIFY_API_URL}/artists`);
    url.searchParams.set('ids', ids.join(','));
    const response = await spotifyApiFetch(url, accessToken);

    for (const artist of response.artists ?? []) {
      if (artist?.id) {
        await updateArtistGenres(env.DB, artist);
        updated += 1;
      }
    }
  }

  return { updated };
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Spotify API error ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function upsertSpotifyPlay(db, item) {
  if (!item?.track || item.track.type !== 'track' || !item.played_at) {
    return false;
  }

  const track = item.track;
  const playedAt = item.played_at;
  const playedAtMs = Date.parse(playedAt);
  if (Number.isNaN(playedAtMs)) {
    return false;
  }

  const album = track.album ?? {};
  const trackId = track.id || spotifyIdFromUri(track.uri);
  const albumId = album.id || spotifyIdFromUri(album.uri);
  const trackKey = trackId || track.uri || fallbackKey('track', track.name, album.name);
  const albumKey = albumId || album.uri || fallbackKey('album', album.name);
  const inserted = await upsertPlay(db, {
    playedAt,
    playedAtMs,
    trackKey,
    trackId,
    trackUri: track.uri ?? null,
    trackName: track.name ?? 'Unknown Track',
    albumKey,
    albumId,
    albumUri: album.uri ?? null,
    albumName: album.name ?? null,
    durationMs: track.duration_ms ?? null,
    msPlayed: null,
    source: 'spotify_api'
  });

  for (const artist of track.artists ?? []) {
    const artistId = artist.id || spotifyIdFromUri(artist.uri);
    const artistKey = artistId || artist.uri || fallbackKey('artist', artist.name);
    await upsertPlayArtist(db, {
      playedAt,
      trackKey,
      artistKey,
      artistId,
      artistUri: artist.uri ?? null,
      artistName: artist.name ?? 'Unknown Artist'
    });
  }

  return inserted;
}

async function upsertPlay(db, play) {
  const existing = await db
    .prepare('SELECT 1 FROM plays WHERE played_at = ? AND track_key = ?')
    .bind(play.playedAt, play.trackKey)
    .first();

  await db
    .prepare(`
      INSERT INTO plays (
        played_at, played_at_ms, track_key, track_id, track_uri, track_name,
        album_key, album_id, album_uri, album_name, duration_ms, ms_played,
        source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(played_at, track_key) DO UPDATE SET
        track_id = COALESCE(plays.track_id, excluded.track_id),
        track_uri = COALESCE(plays.track_uri, excluded.track_uri),
        track_name = COALESCE(excluded.track_name, plays.track_name),
        album_key = COALESCE(plays.album_key, excluded.album_key),
        album_id = COALESCE(plays.album_id, excluded.album_id),
        album_uri = COALESCE(plays.album_uri, excluded.album_uri),
        album_name = COALESCE(plays.album_name, excluded.album_name),
        duration_ms = COALESCE(plays.duration_ms, excluded.duration_ms),
        ms_played = COALESCE(excluded.ms_played, plays.ms_played)
    `)
    .bind(
      play.playedAt,
      play.playedAtMs,
      play.trackKey,
      play.trackId,
      play.trackUri,
      play.trackName,
      play.albumKey,
      play.albumId,
      play.albumUri,
      play.albumName,
      play.durationMs,
      play.msPlayed,
      play.source,
      new Date().toISOString()
    )
    .run();

  return !existing;
}

async function upsertPlayArtist(db, artist) {
  await db
    .prepare(`
      INSERT OR IGNORE INTO play_artists (
        played_at, track_key, artist_key, artist_id, artist_uri, artist_name
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      artist.playedAt,
      artist.trackKey,
      artist.artistKey,
      artist.artistId,
      artist.artistUri,
      artist.artistName
    )
    .run();

  await db
    .prepare(`
      INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(artist_key) DO UPDATE SET
        artist_id = COALESCE(excluded.artist_id, artists.artist_id),
        artist_uri = COALESCE(excluded.artist_uri, artists.artist_uri),
        artist_name = excluded.artist_name
    `)
    .bind(artist.artistKey, artist.artistId, artist.artistUri, artist.artistName)
    .run();
}

async function updateArtistGenres(db, artist) {
  await db
    .prepare(`
      INSERT INTO artists (
        artist_key, artist_id, artist_uri, artist_name, genres_json, genres_cached_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(artist_key) DO UPDATE SET
        artist_id = excluded.artist_id,
        artist_uri = excluded.artist_uri,
        artist_name = excluded.artist_name,
        genres_json = excluded.genres_json,
        genres_cached_at = excluded.genres_cached_at
    `)
    .bind(
      artist.id,
      artist.id,
      artist.uri ?? null,
      artist.name ?? 'Unknown Artist',
      JSON.stringify(artist.genres ?? []),
      new Date().toISOString()
    )
    .run();
}

async function getStats(db, days) {
  const since = new Date(Date.now() - days * MS_PER_DAY).toISOString();
  const summary = await db
    .prepare(`
      SELECT
        COUNT(*) AS songs_played,
        COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms,
        COUNT(DISTINCT track_key) AS unique_songs,
        COUNT(DISTINCT COALESCE(album_key, album_name)) AS different_albums
      FROM plays
      WHERE played_at >= ?
    `)
    .bind(since)
    .first();

  const artistSummary = await db
    .prepare(`
      SELECT COUNT(DISTINCT artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `)
    .bind(since)
    .first();

  const artistRows = await db
    .prepare(`
      SELECT pa.artist_key, a.genres_json
      FROM play_artists pa
      LEFT JOIN artists a ON a.artist_key = pa.artist_key
      WHERE pa.played_at >= ?
    `)
    .bind(since)
    .all();

  const genreCounts = new Map();
  for (const row of artistRows.results) {
    let genres = [];
    try {
      genres = JSON.parse(row.genres_json || '[]');
    } catch {
      genres = [];
    }

    for (const genre of genres) {
      const key = normalizeKey(genre);
      if (key) {
        genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const [mostListenedGenre] = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    'unknown',
    0
  ];

  return {
    days,
    since,
    songsPlayed: Number(summary.songs_played ?? 0),
    listeningMs: Number(summary.listening_ms ?? 0),
    uniqueSongs: Number(summary.unique_songs ?? 0),
    differentArtists: Number(artistSummary.different_artists ?? 0),
    differentAlbums: Number(summary.different_albums ?? 0),
    mostListenedGenre
  };
}

function buildWidgetPayload(stats) {
  const fields = widgetConfig.fields;
  const dynamic = [
    widgetField(fields.topHeroTitle, widgetConfig.topHeroTitle),
    widgetField(fields.during, widgetConfig.during),
    widgetField(fields.lastUpdated, `${widgetConfig.lastUpdatedPrefix}${formatLocalUpdatedAt()}`),
    widgetField(fields.mainTitle, widgetConfig.mainTitle),
    widgetField(fields.songsPlayed, String(stats.songsPlayed)),
    widgetField(fields.listeningTime, formatMinutes(stats.listeningMs)),
    widgetField(fields.uniqueSongs, String(stats.uniqueSongs)),
    widgetField(fields.differentArtists, String(stats.differentArtists)),
    widgetField(fields.differentAlbums, String(stats.differentAlbums)),
    widgetField(fields.mostListenedGenre, stats.mostListenedGenre)
  ];

  return {
    username: widgetConfig.username,
    data: { dynamic }
  };
}

function widgetField(name, value) {
  if (!name) {
    throw new Error('Widget field name is missing. Check config/widget.json.');
  }
  return { type: 1, name, value };
}

async function patchDiscordWidget(env, stats, options = {}) {
  const payload = buildWidgetPayload(stats);
  const hash = await sha256(JSON.stringify(payload));

  if (appConfig.patchOnlyWhenChanged && !options.force) {
    const previousHash = await getState(env.DB, 'discord_widget_payload_hash');
    if (previousHash === hash) {
      return { patched: false, skipped: true, reason: 'unchanged' };
    }
  }

  const applicationId = requiredEnv(env, 'DISCORD_CLIENT_ID');
  const discordUserId = requiredEnv(env, 'DISCORD_USER_ID');
  const identityId = env.DISCORD_IDENTITY_ID || '0';
  const response = await discordFetch(
    env,
    `/applications/${applicationId}/users/${discordUserId}/identities/${identityId}/profile`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord widget PATCH failed ${response.status}: ${text}`);
  }

  await setState(env.DB, 'discord_widget_payload_hash', hash);
  await setState(env.DB, 'discord_widget_last_patched_at', new Date().toISOString());
  return { patched: true, skipped: false };
}

async function runSpotifyReauthReminder(env) {
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

  const expiresAt = new Date(
    issuedAt.getTime() + appConfig.spotifyRefreshTokenValidDays * MS_PER_DAY
  );
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / MS_PER_DAY);
  if (daysLeft > appConfig.spotifyReauthRemindDays) {
    return { sent: false, reason: 'not_due', daysLeft };
  }

  const message =
    daysLeft >= 0
      ? `Spotify refresh token will need reauthorization in ${daysLeft} day(s). Expires around ${expiresAt.toISOString()}.\n\n${reauthorizeText(env)}`
      : `Spotify refresh token may already be expired. It expired around ${expiresAt.toISOString()}.\n\n${reauthorizeText(env)}`;

  return sendOncePerDay(env, `reauth-${expiresAt.toISOString().slice(0, 10)}`, message);
}

async function getSpotifyRefreshTokenIssuedAt(env) {
  return (
    (await getState(env.DB, 'spotify_refresh_token_issued_at')) ||
    env.SPOTIFY_REFRESH_TOKEN_ISSUED_AT ||
    null
  );
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
  const today = new Date().toISOString().slice(0, 10);
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

async function sendDiscordDm(env, content) {
  const userId = env.DISCORD_REMINDER_USER_ID || requiredEnv(env, 'DISCORD_USER_ID');
  const channelResponse = await discordFetch(env, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: userId })
  });

  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok) {
    throw new Error(`Discord create DM failed ${channelResponse.status}: ${JSON.stringify(channel)}`);
  }

  const messageResponse = await discordFetch(env, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });

  const message = await messageResponse.json().catch(() => ({}));
  if (!messageResponse.ok) {
    throw new Error(`Discord send DM failed ${messageResponse.status}: ${JSON.stringify(message)}`);
  }
}

async function trySendDiscordDm(env, content) {
  try {
    await sendDiscordDm(env, content);
    return { sent: true };
  } catch (error) {
    console.warn('Discord DM failed', error.message);
    return { sent: false, error: error.message };
  }
}

function discordFetch(env, path, init = {}) {
  return fetch(`${DISCORD_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${requiredEnv(env, 'DISCORD_TOKEN')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
      ...init.headers
    }
  });
}

async function createOAuthState(db) {
  const state = cryptoRandomHex(24);
  await setState(
    db,
    `spotify_oauth_state:${state}`,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString()
    })
  );
  return state;
}

async function consumeOAuthState(db, state) {
  const key = `spotify_oauth_state:${state}`;
  const raw = await getState(db, key);
  if (!raw || raw === 'used') {
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

  await setState(db, key, 'used');
  return true;
}

async function getState(db, key) {
  const row = await db.prepare('SELECT value FROM app_state WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}

async function setState(db, key, value) {
  await db
    .prepare(`
      INSERT INTO app_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .bind(key, String(value))
    .run();
}

function requireAdminToken(url, env) {
  const expected = requiredEnv(env, 'ADMIN_TOKEN');
  const provided =
    url.searchParams.get('token') ||
    url.searchParams.get('admin_token') ||
    url.searchParams.get('key');
  if (provided !== expected) {
    throw new HttpError('unauthorized', 401);
  }
}

function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required binding/secret: ${name}`);
  }
  return value;
}

function formatMinutes(ms) {
  if (!ms || ms < 0) {
    return '0 minutes';
  }
  return `${Math.round(ms / 60000)} minutes`;
}

function formatLocalUpdatedAt(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Taipei'
  });
  return formatter.format(date);
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fallbackKey(prefix, ...parts) {
  return `${prefix}:${parts.map(normalizeKey).join('|')}`;
}

function spotifyIdFromUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  const parts = uri.split(':');
  if (parts.length !== 3 || parts[0] !== 'spotify') {
    return null;
  }

  return parts[2] || null;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function cryptoRandomHex(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function html(title, body, status = 200) {
  return new Response(
    `<!doctype html>
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
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

class HttpError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

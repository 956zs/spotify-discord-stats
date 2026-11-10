import { playRowToSongStatus } from '../../shared/song.js';
import { nowIso, sinceIso } from '../../shared/time.js';
import { collectWidgetData } from '../../shared/widget-payload.js';
import {
  rangeKey,
  resolveSince
} from '../../shared/widget-metrics-query.js';
import { HERO_UPLOAD } from '../../shared/widget-hero.js';
import { isAllTime } from '../../shared/widget-settings.js';
import { loadWindowResults, pruneStatWindows } from './stat-windows.js';
import { getState, setState } from './state.js';
import { HERO_IMAGE_KEY, getWidgetImageMeta } from './widget-images.js';

const CACHE_KEY_PREFIX = 'widget_metrics_cache:';

// Widget numbers for the current settings. Each range's results are cached and reused
// while the newest play, the hour-floored window start, and the query set are all
// unchanged, so idle cron ticks skip the work entirely. On a cache miss the numbers
// come from the range's incrementally maintained window (stat-windows.js), which only
// reads the plays that changed since the last sync. `refresh` skips the cache.
// `saved: false` marks unsaved settings (admin preview): ranges without a window then
// run the direct queries instead of building one. Saved settings also drop windows of
// ranges they no longer use.
// `publicBaseUrl` is where /widget/hero is reachable; without it "upload" acts like "asset".
export async function getWidgetData(db, settings, options = {}) {
  const saved = options.saved ?? true;
  const now = options.now ?? new Date();
  const playsVersion = await getPlaysVersion(db);
  let computed = false;
  const heroUpload =
    settings.widget.heroImage === HERO_UPLOAD ? await getWidgetImageMeta(db, HERO_IMAGE_KEY) : null;

  const data = await collectWidgetData(db, settings, {
    now,
    lastPlayed: await getLastPlayedSong(db),
    heroUpload,
    publicBaseUrl: options.publicBaseUrl,
    loadRange: async (days, queryIds) => {
      const since = await resolveSince(db, days, now);
      const fingerprint = `${playsVersion}|${since}|${queryIds.join(',')}`;
      const cacheKey = `${CACHE_KEY_PREFIX}${rangeKey(days)}`;

      if (!options.refresh) {
        const cached = await readCache(db, cacheKey);
        if (cached?.fingerprint === fingerprint) {
          return { since, results: cached.results };
        }
      }

      computed = true;
      const results = await loadWindowResults(db, rangeKey(days), since, queryIds, { allowBuild: saved });
      await setState(db, cacheKey, JSON.stringify({ fingerprint, results }));
      return { since, results };
    }
  });
  if (saved && computed) {
    await pruneStatWindows(db, Object.keys(data.ranges));
  }
  return data;
}

// Changes whenever a play or play artist row is added, including late plays with an
// older played_at. Rewrites of existing rows clear the cache instead (see
// invalidateStatWindows).
async function getPlaysVersion(db) {
  const row = await db.prepare(`
    SELECT (SELECT COALESCE(MAX(rowid), 0) FROM plays) || ':' ||
      (SELECT COALESCE(MAX(rowid), 0) FROM play_artists) AS version
  `).first();
  return row?.version ?? '0:0';
}

async function readCache(db, key) {
  const raw = await getState(db, key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getStatsRanges(db, daysList) {
  const ranges = {};
  for (const days of daysList) {
    ranges[`${days}d`] = await getStats(db, days);
  }
  return ranges;
}

// Plain summary for /admin/stats and sync debugging output. `days` is a whole number of
// days or 'all' (from the earliest stored play).
export async function getStats(db, days) {
  const since = isAllTime(days) ? await getEarliestPlayedAt(db) : sinceIso(days);
  const summary = await getPlaySummary(db, since);
  const artistSummary = await getArtistSummary(db, since);
  const topAlbum = await getTopAlbum(db, since);

  return {
    days,
    since,
    songsPlayed: Number(summary.songs_played ?? 0),
    listeningMs: Number(summary.listening_ms ?? 0),
    uniqueSongs: Number(summary.unique_songs ?? 0),
    differentArtists: Number(artistSummary.different_artists ?? 0),
    differentAlbums: Number(summary.different_albums ?? 0),
    topAlbum: topAlbum?.album_name ?? 'unknown',
    topAlbumImageUrl: topAlbum?.album_image_url ?? null,
    topAlbumPlays: Number(topAlbum?.plays ?? 0)
  };
}

export async function getLastPlayedSong(db) {
  const row = await db
    .prepare(`
      SELECT
        p.played_at,
        p.track_name,
        p.album_name,
        p.album_image_url,
        (
          SELECT GROUP_CONCAT(pa.artist_name, ', ')
          FROM play_artists pa
          WHERE pa.played_at = p.played_at
            AND pa.track_key = p.track_key
        ) AS artist_names
      FROM plays p
      ORDER BY p.played_at_ms DESC
      LIMIT 1
    `)
    .first();

  return playRowToSongStatus(row);
}

async function getEarliestPlayedAt(db) {
  const row = await db.prepare('SELECT MIN(played_at) AS played_at FROM plays').first();
  return row?.played_at ?? nowIso();
}

async function getPlaySummary(db, since) {
  return db
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
}

// The unary + on artist_key is deliberate. Written as COUNT(DISTINCT artist_key),
// SQLite prefers an artist_key-ordered index so it can skip the DISTINCT temp b-tree,
// and ends up scanning every row in the table. The + hides the column from that
// optimisation, so the planner uses the played_at index and reads only the window.
async function getArtistSummary(db, since) {
  return db
    .prepare(`
      SELECT COUNT(DISTINCT +artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `)
    .bind(since)
    .first();
}

async function getTopAlbum(db, since) {
  return db
    .prepare(`
      SELECT album_name, MAX(album_image_url) AS album_image_url, COUNT(*) AS plays
      FROM plays
      WHERE played_at >= ?
        AND album_name IS NOT NULL
        AND TRIM(album_name) != ''
      GROUP BY COALESCE(album_key, album_name), album_name
      ORDER BY plays DESC, album_name COLLATE NOCASE ASC
      LIMIT 1
    `)
    .bind(since)
    .first();
}

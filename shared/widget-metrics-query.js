import { MS_PER_DAY, nowIso } from './time.js';
import { ALL_TIME, isAllTime } from './widget-settings.js';

// Result sets behind the widget metrics. Each reads only plays at or after `since`,
// through the played_at indexes. `db` is anything with D1's prepare/bind/first/all.
//
// Unary + on artist_key / track_key is deliberate wherever a DISTINCT or GROUP BY
// touches them: without it SQLite prefers an index ordered by that key to skip the
// temp b-tree, and walks the whole table instead of the date window.

const LOCAL_TIME = "'+8 hours'";
const LATE_NIGHT_END_HOUR = 5;
const MS_PER_HOUR = 60 * 60 * 1000;

const QUERIES = {
  summary: async (db, since) => {
    const row = await first(db, `
      SELECT
        COUNT(*) AS songs_played,
        COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms,
        COUNT(DISTINCT +track_key) AS unique_songs,
        COUNT(DISTINCT COALESCE(album_key, album_name)) AS different_albums
      FROM plays
      WHERE played_at >= ?
    `, [since]);
    return {
      songsPlayed: numeric(row?.songs_played),
      listeningMs: numeric(row?.listening_ms),
      uniqueSongs: numeric(row?.unique_songs),
      differentAlbums: numeric(row?.different_albums)
    };
  },

  artistCount: async (db, since) => {
    const row = await first(db, `
      SELECT COUNT(DISTINCT +artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `, [since]);
    return { differentArtists: numeric(row?.different_artists) };
  },

  topTrack: async (db, since) => {
    const row = await first(db, `
      SELECT track_key, track_name, COUNT(*) AS plays,
        COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms
      FROM plays
      WHERE played_at >= ?
      GROUP BY +track_key, track_name
      ORDER BY plays DESC, listening_ms DESC, track_name COLLATE NOCASE ASC
      LIMIT 1
    `, [since]);
    if (!row) {
      return null;
    }
    const artists = await all(db, `
      SELECT DISTINCT artist_name
      FROM play_artists
      WHERE track_key = ? AND played_at >= ?
      ORDER BY artist_name COLLATE NOCASE ASC
    `, [row.track_key, since]);
    return {
      name: row.track_name,
      artists: artists.map((artist) => artist.artist_name).join(', '),
      plays: numeric(row.plays)
    };
  },

  topArtist: async (db, since) => {
    const row = await first(db, `
      SELECT artist_name, COUNT(*) AS plays
      FROM play_artists
      WHERE played_at >= ?
      GROUP BY +artist_key, artist_name
      ORDER BY plays DESC, artist_name COLLATE NOCASE ASC
      LIMIT 1
    `, [since]);
    return row ? { name: row.artist_name, plays: numeric(row.plays) } : null;
  },

  topAlbum: async (db, since) => {
    const row = await first(db, `
      SELECT album_name, COUNT(*) AS plays
      FROM plays
      WHERE played_at >= ?
        AND album_name IS NOT NULL
        AND TRIM(album_name) != ''
      GROUP BY COALESCE(album_key, album_name), album_name
      ORDER BY plays DESC, album_name COLLATE NOCASE ASC
      LIMIT 1
    `, [since]);
    return row ? { name: row.album_name, plays: numeric(row.plays) } : null;
  },

  peakHour: async (db, since) => {
    const row = await first(db, `
      SELECT CAST(strftime('%H', played_at, ${LOCAL_TIME}) AS INTEGER) AS local_hour, COUNT(*) AS plays
      FROM plays
      WHERE played_at >= ?
      GROUP BY local_hour
      ORDER BY plays DESC, local_hour ASC
      LIMIT 1
    `, [since]);
    return row ? { hour: numeric(row.local_hour), plays: numeric(row.plays) } : null;
  },

  peakWeekday: async (db, since) => {
    const row = await first(db, `
      SELECT CAST(strftime('%w', played_at, ${LOCAL_TIME}) AS INTEGER) AS weekday, COUNT(*) AS plays
      FROM plays
      WHERE played_at >= ?
      GROUP BY weekday
      ORDER BY plays DESC, weekday ASC
      LIMIT 1
    `, [since]);
    return row ? { weekday: numeric(row.weekday), plays: numeric(row.plays) } : null;
  },

  listeningDays: async (db, since) => {
    const rows = await all(db, `
      SELECT DISTINCT date(played_at, ${LOCAL_TIME}) AS local_date
      FROM plays
      WHERE played_at >= ?
      ORDER BY local_date ASC
    `, [since]);
    return { dates: rows.map((row) => row.local_date) };
  },

  busiestDay: async (db, since) => {
    const row = await first(db, `
      SELECT date(played_at, ${LOCAL_TIME}) AS local_date, COUNT(*) AS plays
      FROM plays
      WHERE played_at >= ?
      GROUP BY local_date
      ORDER BY plays DESC, local_date ASC
      LIMIT 1
    `, [since]);
    return row ? { date: row.local_date, plays: numeric(row.plays) } : null;
  },

  lateNight: async (db, since) => {
    const row = await first(db, `
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN CAST(strftime('%H', played_at, ${LOCAL_TIME}) AS INTEGER) < ${LATE_NIGHT_END_HOUR}
          THEN 1 ELSE 0 END), 0) AS late_night
      FROM plays
      WHERE played_at >= ?
    `, [since]);
    return { plays: numeric(row?.late_night), total: numeric(row?.total) };
  },

  newSongs: async (db, since) => {
    const row = await first(db, `
      SELECT COUNT(DISTINCT +p.track_key) AS count
      FROM plays p
      WHERE p.played_at >= ?
        AND NOT EXISTS (
          SELECT 1 FROM plays old WHERE old.track_key = p.track_key AND old.played_at < ?
        )
    `, [since, since]);
    return { count: numeric(row?.count) };
  },

  // Relies on idx_play_artists_artist_key_played_at for the NOT EXISTS probe.
  newArtists: async (db, since) => {
    const row = await first(db, `
      SELECT COUNT(DISTINCT +pa.artist_key) AS count
      FROM play_artists pa
      WHERE pa.played_at >= ?
        AND NOT EXISTS (
          SELECT 1 FROM play_artists old WHERE old.artist_key = pa.artist_key AND old.played_at < ?
        )
    `, [since, since]);
    return { count: numeric(row?.count) };
  },

  firstPlay: async (db) => ({ playedAt: await getEarliestPlayedAt(db) })
};

export const QUERY_IDS = Object.keys(QUERIES);

export async function runMetricQueries(db, since, queryIds) {
  const results = {};
  for (const id of queryIds) {
    results[id] = await QUERIES[id](db, since);
  }
  return results;
}

// Window starts are floored to the hour so results (and their cache) stay stable
// between cron ticks; all time starts at the earliest stored play.
export async function resolveSince(db, days, now = new Date()) {
  if (isAllTime(days)) {
    return (await getEarliestPlayedAt(db)) ?? nowIso(now);
  }
  const hourStart = Math.floor(now.getTime() / MS_PER_HOUR) * MS_PER_HOUR;
  return new Date(hourStart - days * MS_PER_DAY).toISOString();
}

export function rangeKey(days) {
  return isAllTime(days) ? ALL_TIME : `${days}d`;
}

export async function getEarliestPlayedAt(db) {
  const row = await first(db, 'SELECT MIN(played_at) AS played_at FROM plays', []);
  return row?.played_at ?? null;
}

export async function getLatestPlayedAtMs(db) {
  const row = await first(db, 'SELECT MAX(played_at_ms) AS played_at_ms FROM plays', []);
  return row?.played_at_ms ?? null;
}

function numeric(value) {
  return Number(value ?? 0);
}

async function first(db, sql, bindings) {
  return (await db.prepare(sql).bind(...bindings).first()) ?? null;
}

async function all(db, sql, bindings) {
  return (await db.prepare(sql).bind(...bindings).all()).results ?? [];
}

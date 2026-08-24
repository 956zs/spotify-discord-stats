import { playRowToSongStatus } from '../../shared/song.js';
import { sinceIso } from '../../shared/time.js';

export async function getWidgetStats(db, days) {
  return {
    ...(await getStats(db, days)),
    lastPlayed: await getLastPlayedSong(db)
  };
}

export async function getStatsRanges(db, daysList) {
  const ranges = {};
  for (const days of daysList) {
    ranges[`${days}d`] = await getStats(db, days);
  }
  return ranges;
}

export async function getStats(db, days) {
  const since = sinceIso(days);
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

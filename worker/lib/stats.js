import { sinceIso } from '../../shared/time.js';

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
    topAlbumPlays: Number(topAlbum?.plays ?? 0)
  };
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

async function getArtistSummary(db, since) {
  return db
    .prepare(`
      SELECT COUNT(DISTINCT artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `)
    .bind(since)
    .first();
}

async function getTopAlbum(db, since) {
  return db
    .prepare(`
      SELECT album_name, COUNT(*) AS plays
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

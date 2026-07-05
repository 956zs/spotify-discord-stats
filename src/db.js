import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';
import { fallbackKey, normalizeKey } from './keys.js';
import { isoToMs, nowIso, sinceIso } from './time.js';

let database;

export function getDb() {
  if (database) {
    return database;
  }

  const dbPath = path.resolve(env('DATABASE_PATH', './data/spotify.sqlite'));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  migrate(database);
  return database;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plays (
      played_at TEXT NOT NULL,
      played_at_ms INTEGER NOT NULL,
      track_key TEXT NOT NULL,
      track_id TEXT,
      track_uri TEXT,
      track_name TEXT NOT NULL,
      album_key TEXT,
      album_id TEXT,
      album_uri TEXT,
      album_name TEXT,
      duration_ms INTEGER,
      ms_played INTEGER,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (played_at, track_key)
    );

    CREATE TABLE IF NOT EXISTS play_artists (
      played_at TEXT NOT NULL,
      track_key TEXT NOT NULL,
      artist_key TEXT NOT NULL,
      artist_id TEXT,
      artist_uri TEXT,
      artist_name TEXT NOT NULL,
      PRIMARY KEY (played_at, track_key, artist_key)
    );

    CREATE TABLE IF NOT EXISTS artists (
      artist_key TEXT PRIMARY KEY,
      artist_id TEXT,
      artist_uri TEXT,
      artist_name TEXT NOT NULL,
      genres_json TEXT NOT NULL DEFAULT '[]',
      genres_cached_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays (played_at);
    CREATE INDEX IF NOT EXISTS idx_play_artists_artist_key ON play_artists (artist_key);
    CREATE INDEX IF NOT EXISTS idx_artists_artist_id ON artists (artist_id);
  `);
}

export function getState(key) {
  const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row?.value ?? null;
}

export function setState(key, value) {
  getDb()
    .prepare(`
      INSERT INTO app_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, String(value));
}

export function upsertSpotifyPlay(item) {
  if (!item?.track || item.track.type !== 'track' || !item.played_at) {
    return false;
  }

  const track = item.track;
  const playedAt = item.played_at;
  const playedAtMs = isoToMs(playedAt);
  if (!playedAtMs) {
    return false;
  }

  const album = track.album ?? {};
  const trackId = track.id || spotifyIdFromUri(track.uri);
  const albumId = album.id || spotifyIdFromUri(album.uri);
  const trackKey = trackId || track.uri || fallbackKey('track', track.name, album.name);
  const albumKey = albumId || album.uri || fallbackKey('album', album.name);
  const inserted = insertPlay({
    playedAt,
    playedAtMs,
    trackKey,
    trackId: trackId ?? null,
    trackUri: track.uri ?? null,
    trackName: track.name ?? 'Unknown Track',
    albumKey,
    albumId: albumId ?? null,
    albumUri: album.uri ?? null,
    albumName: album.name ?? null,
    durationMs: track.duration_ms ?? null,
    msPlayed: null,
    source: 'spotify_api'
  });

  for (const artist of track.artists ?? []) {
    const artistId = artist.id || spotifyIdFromUri(artist.uri);
    const artistKey = artistId || artist.uri || fallbackKey('artist', artist.name);
    upsertPlayArtist({
      playedAt,
      trackKey,
      artistKey,
      artistId: artistId ?? null,
      artistUri: artist.uri ?? null,
      artistName: artist.name ?? 'Unknown Artist'
    });
  }

  return inserted;
}

export function upsertExportPlay(row) {
  const playedAt = parseExportPlayedAt(row);
  if (!playedAt) {
    return false;
  }

  const playedAtMs = isoToMs(playedAt);
  if (!playedAtMs) {
    return false;
  }

  const trackName =
    row.master_metadata_track_name ??
    row.trackName ??
    row.track_name ??
    null;
  const artistName =
    row.master_metadata_album_artist_name ??
    row.artistName ??
    row.artist_name ??
    null;

  if (!trackName || !artistName) {
    return false;
  }

  const albumName =
    row.master_metadata_album_album_name ??
    row.albumName ??
    row.album_name ??
    null;
  const trackUri = row.spotify_track_uri ?? row.spotifyTrackUri ?? row.track_uri ?? null;
  const trackId = spotifyIdFromUri(trackUri);
  const trackKey = trackId || trackUri || fallbackKey('track', trackName, artistName, albumName);
  const albumKey = albumName ? fallbackKey('album', albumName, artistName) : null;
  const artistKey = fallbackKey('artist', artistName);

  const inserted = insertPlay({
    playedAt,
    playedAtMs,
    trackKey,
    trackId,
    trackUri,
    trackName,
    albumKey,
    albumId: null,
    albumUri: null,
    albumName,
    durationMs: null,
    msPlayed: row.ms_played ?? row.msPlayed ?? null,
    source: 'spotify_export'
  });

  if (inserted) {
    upsertPlayArtist({
      playedAt,
      trackKey,
      artistKey,
      artistId: null,
      artistUri: null,
      artistName
    });
  }

  return inserted;
}

function insertPlay(play) {
  const db = getDb();
  const existed = Boolean(
    db
      .prepare('SELECT 1 FROM plays WHERE played_at = ? AND track_key = ?')
      .get(play.playedAt, play.trackKey)
  );

  db
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
    .run(
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
      nowIso()
    );
  return !existed;
}

function upsertPlayArtist(artist) {
  getDb()
    .prepare(`
      INSERT OR IGNORE INTO play_artists (
        played_at, track_key, artist_key, artist_id, artist_uri, artist_name
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      artist.playedAt,
      artist.trackKey,
      artist.artistKey,
      artist.artistId,
      artist.artistUri,
      artist.artistName
    );

  getDb()
    .prepare(`
      INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(artist_key) DO UPDATE SET
        artist_id = COALESCE(excluded.artist_id, artists.artist_id),
        artist_uri = COALESCE(excluded.artist_uri, artists.artist_uri),
        artist_name = excluded.artist_name
    `)
    .run(artist.artistKey, artist.artistId, artist.artistUri, artist.artistName);
}

function parseExportPlayedAt(row) {
  if (row.ts) {
    return new Date(row.ts).toISOString();
  }

  if (row.endTime) {
    const normalized = String(row.endTime).replace(' ', 'T');
    return new Date(`${normalized}Z`).toISOString();
  }

  if (row.played_at) {
    return new Date(row.played_at).toISOString();
  }

  return null;
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

export function getUncachedSpotifyArtistIds(limit = 50) {
  return getDb()
    .prepare(`
      SELECT artist_key, artist_id
      FROM artists
      WHERE artist_id IS NOT NULL
        AND (genres_cached_at IS NULL OR genres_cached_at < datetime('now', '-30 days'))
      ORDER BY genres_cached_at IS NOT NULL, artist_name
      LIMIT ?
    `)
    .all(limit);
}

export function updateArtistGenres(artist) {
  const artistKey = artist.id;
  getDb()
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
    .run(
      artistKey,
      artist.id,
      artist.uri ?? null,
      artist.name ?? 'Unknown Artist',
      JSON.stringify(artist.genres ?? []),
      nowIso()
    );
}

export function getStats(days) {
  const since = sinceIso(days);
  const db = getDb();
  const summary = db
    .prepare(`
      SELECT
        COUNT(*) AS songs_played,
        COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms,
        COUNT(DISTINCT track_key) AS unique_songs,
        COUNT(DISTINCT COALESCE(album_key, album_name)) AS different_albums
      FROM plays
      WHERE played_at >= ?
    `)
    .get(since);

  const artistSummary = db
    .prepare(`
      SELECT COUNT(DISTINCT artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `)
    .get(since);

  const artistRows = db
    .prepare(`
      SELECT pa.artist_key, a.genres_json
      FROM play_artists pa
      LEFT JOIN artists a ON a.artist_key = pa.artist_key
      WHERE pa.played_at >= ?
    `)
    .all(since);

  const genreCounts = new Map();
  for (const row of artistRows) {
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

export function getDbHealth() {
  const db = getDb();
  const plays = db.prepare('SELECT COUNT(*) AS count FROM plays').get().count;
  const artists = db.prepare('SELECT COUNT(*) AS count FROM artists').get().count;
  const lastPlay = db
    .prepare('SELECT played_at FROM plays ORDER BY played_at DESC LIMIT 1')
    .get()?.played_at;
  return { plays, artists, lastPlay: lastPlay ?? null };
}

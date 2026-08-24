import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';
import { exportRowToPlayRecords, spotifyItemToPlayRecords } from '../shared/play-records.js';
import { playRowToSongStatus } from '../shared/song.js';
import { nowIso, sinceIso } from './time.js';

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
      album_image_url TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_plays_track_key_played_at ON plays (track_key, played_at);
    CREATE INDEX IF NOT EXISTS idx_plays_played_at_ms ON plays (played_at_ms);
    CREATE INDEX IF NOT EXISTS idx_play_artists_played_at_artist_key
      ON play_artists (played_at, artist_key, artist_name);
    CREATE INDEX IF NOT EXISTS idx_play_artists_track_key_played_at
      ON play_artists (track_key, played_at, artist_name);
    CREATE INDEX IF NOT EXISTS idx_artists_artist_id ON artists (artist_id);

    DROP INDEX IF EXISTS idx_play_artists_artist_key;
  `);

  ensureColumn(db, 'plays', 'album_image_url', 'TEXT');
}

function ensureColumn(db, table, column, definition) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => row.name === column);
  if (exists) {
    return;
  }

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
  return upsertPlayRecords(spotifyItemToPlayRecords(item));
}

export function upsertExportPlay(row) {
  return upsertPlayRecords(exportRowToPlayRecords(row), {
    insertArtistsOnlyWhenPlayInserted: true
  });
}

function upsertPlayRecords(records, options = {}) {
  if (!records) {
    return false;
  }

  const inserted = insertPlay(records.play);
  if (options.insertArtistsOnlyWhenPlayInserted && !inserted) {
    return inserted;
  }

  for (const artist of records.artists) {
    upsertPlayArtist(artist);
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
        album_key, album_id, album_uri, album_name, album_image_url,
        duration_ms, ms_played, source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(played_at, track_key) DO UPDATE SET
        track_id = COALESCE(plays.track_id, excluded.track_id),
        track_uri = COALESCE(plays.track_uri, excluded.track_uri),
        track_name = COALESCE(excluded.track_name, plays.track_name),
        album_key = COALESCE(plays.album_key, excluded.album_key),
        album_id = COALESCE(plays.album_id, excluded.album_id),
        album_uri = COALESCE(plays.album_uri, excluded.album_uri),
        album_name = COALESCE(plays.album_name, excluded.album_name),
        album_image_url = COALESCE(plays.album_image_url, excluded.album_image_url),
        duration_ms = COALESCE(plays.duration_ms, excluded.duration_ms),
        ms_played = COALESCE(excluded.ms_played, plays.ms_played)
    `)
    .run(...playBindings(play), nowIso());
  return !existed;
}

function playBindings(play) {
  return [
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
    play.albumImageUrl,
    play.durationMs,
    play.msPlayed,
    play.source
  ];
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
      SELECT COUNT(DISTINCT +artist_key) AS different_artists
      FROM play_artists
      WHERE played_at >= ?
    `)
    .get(since);

  const topAlbum = db
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
    .get(since);

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

export function getLastPlayedSong() {
  const row = getDb()
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
    .get();

  return playRowToSongStatus(row);
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

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

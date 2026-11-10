-- Incrementally maintained widget stats (see worker/lib/stat-windows.js). Each widget
-- range ('28d', 'all', ...) keeps per-key play counts for its window, so a sync only
-- reads the plays that entered or left the window instead of rescanning all of them.

-- One row per range: the window start, how far into plays / play_artists (by rowid)
-- the counts reach, and running totals.
CREATE TABLE IF NOT EXISTS stat_windows (
  range_key TEXT PRIMARY KEY,
  since TEXT NOT NULL,
  kinds TEXT NOT NULL,
  play_cursor INTEGER NOT NULL,
  play_cursor_id TEXT,
  artist_cursor INTEGER NOT NULL,
  artist_cursor_id TEXT,
  totals TEXT NOT NULL,
  token TEXT NOT NULL
);

-- Play counts per range, kind (track, album, artist, hour, weekday, date) and
-- (key, name) group, matching the GROUP BY of the direct queries.
CREATE TABLE IF NOT EXISTS stat_counts (
  range_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  plays INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  PRIMARY KEY (range_key, kind, key, name)
) WITHOUT ROWID;

-- Top-N order of the direct queries, so "top album" and friends read one row.
CREATE INDEX IF NOT EXISTS idx_stat_counts_rank
  ON stat_counts (range_key, kind, plays DESC, ms DESC, name COLLATE NOCASE, key);

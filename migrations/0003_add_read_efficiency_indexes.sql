-- Read-path indexes. Without them three hot queries degraded into full scans:
--   * recap "new tracks" re-scanned plays once per candidate row for its NOT EXISTS check
--   * the last-played lookup sorted the entire plays table just to return one row
--   * the distinct-artist count walked every play_artists row instead of the date window
CREATE INDEX IF NOT EXISTS idx_plays_track_key_played_at
  ON plays (track_key, played_at);

CREATE INDEX IF NOT EXISTS idx_plays_played_at_ms
  ON plays (played_at_ms);

CREATE INDEX IF NOT EXISTS idx_play_artists_played_at_artist_key
  ON play_artists (played_at, artist_key, artist_name);

CREATE INDEX IF NOT EXISTS idx_play_artists_track_key_played_at
  ON play_artists (track_key, played_at, artist_name);

-- Nothing filters on artist_key alone, so this index never served a lookup. It only
-- gave the planner a cheap-looking way to scan every row for COUNT(DISTINCT artist_key).
DROP INDEX IF EXISTS idx_play_artists_artist_key;

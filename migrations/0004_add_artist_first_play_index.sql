-- Lets the "new artists" widget metric probe "has this artist been played before the
-- window?" with one index seek per artist instead of scanning older history.
-- Queries that DISTINCT or GROUP BY artist_key prefix it with unary + so the planner
-- does not pick this index to avoid a temp b-tree (see 0003).
CREATE INDEX IF NOT EXISTS idx_play_artists_artist_key_played_at
  ON play_artists (artist_key, played_at);

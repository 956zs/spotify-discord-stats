import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Minimal D1 surface (prepare/bind/first/all/run/batch) over an in-memory SQLite
// database with every migration applied.
export function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = new URL('../../migrations/', import.meta.url).pathname;
  for (const file of fs.readdirSync(migrationsDir).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const execute = (sql, args) => {
    const prepared = sqlite.prepare(sql);
    if (prepared.columns().length > 0) {
      return { results: prepared.all(...args), meta: { changes: 0 } };
    }
    return { results: [], meta: { changes: Number(prepared.run(...args).changes) } };
  };

  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }),
    execute: () => execute(sql, args)
  });

  // Like D1, a batch runs as one transaction and rolls back as a whole on error.
  const batch = async (statements) => {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map((item) => item.execute());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  };

  return { prepare: (sql) => statement(sql), batch, sqlite };
}

export function insertPlay(db, playedAtIso, trackKey, artistKeys, options = {}) {
  const playedAtMs = Date.parse(playedAtIso);
  const album = options.album === undefined ? `Album ${trackKey}` : options.album;
  db.sqlite
    .prepare(`INSERT INTO plays (played_at, played_at_ms, track_key, track_name, album_key, album_name,
      duration_ms, ms_played, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?)`)
    .run(playedAtIso, playedAtMs, trackKey, options.trackName ?? `Track ${trackKey}`,
      options.albumKey === undefined ? album : options.albumKey, album,
      options.duration ?? options.ms ?? 180000, options.ms === undefined ? 180000 : options.ms, playedAtIso);
  for (const artistKey of [artistKeys].flat()) {
    db.sqlite
      .prepare('INSERT INTO play_artists (played_at, track_key, artist_key, artist_name) VALUES (?, ?, ?, ?)')
      .run(playedAtIso, trackKey, artistKey, options.artistNames?.[artistKey] ?? `Artist ${artistKey}`);
  }
}

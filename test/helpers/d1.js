import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Minimal D1 surface (prepare/bind/first/all/run) over an in-memory SQLite database
// with every migration applied.
export function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = new URL('../../migrations/', import.meta.url).pathname;
  for (const file of fs.readdirSync(migrationsDir).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } })
  });
  return { prepare: (sql) => statement(sql), sqlite };
}

export function insertPlay(db, playedAtIso, trackKey, artistKeys, options = {}) {
  const playedAtMs = Date.parse(playedAtIso);
  const album = options.album ?? `Album ${trackKey}`;
  db.sqlite
    .prepare(`INSERT INTO plays (played_at, played_at_ms, track_key, track_name, album_key, album_name,
      duration_ms, ms_played, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?)`)
    .run(playedAtIso, playedAtMs, trackKey, `Track ${trackKey}`, album, album,
      options.ms ?? 180000, options.ms ?? 180000, playedAtIso);
  for (const artistKey of [artistKeys].flat()) {
    db.sqlite
      .prepare('INSERT INTO play_artists (played_at, track_key, artist_key, artist_name) VALUES (?, ?, ?, ?)')
      .run(playedAtIso, trackKey, artistKey, `Artist ${artistKey}`);
  }
}

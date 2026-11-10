import assert from 'node:assert/strict';
import test from 'node:test';
import { QUERY_IDS, resolveSince, runMetricQueries } from '../shared/widget-metrics-query.js';
import {
  invalidateStatWindows,
  loadWindowResults,
  pruneStatWindows,
  queryKinds
} from '../worker/lib/stat-windows.js';
import { upsertSpotifyPlay } from '../worker/lib/plays.js';
import { createD1, insertPlay } from './helpers/d1.js';

const HOUR = 60 * 60 * 1000;
const START = Date.parse('2026-06-01T00:00:00.000Z');

// Small deterministic PRNG so failures can be replayed from the seed.
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

// Names are unique per group (case-insensitively), so the direct queries' top-N
// order is fully defined and both sides must agree exactly.
function catalog() {
  const tracks = [];
  for (let i = 0; i < 12; i += 1) {
    tracks.push({ key: `t${i}`, name: `Track ${i}`, album: i % 6, artists: [`a${i % 5}`] });
  }
  tracks.push({ key: 't3', name: 'Track 3 (Remaster)', album: 3, artists: ['a3'] }); // renamed track
  tracks.push({ key: 't12', name: 'Duet', album: 6, artists: ['a1', 'a2'] });
  tracks.push({ key: 't13', name: 'No album', album: 7, artists: ['a4'] });
  tracks.push({ key: 't14', name: 'Blank album', album: 8, artists: ['a0'] });
  tracks.push({ key: 't15', name: 'Keyless album', album: 9, artists: ['a5'] });
  const albums = [
    ...Array.from({ length: 7 }, (_, i) => ({ key: `al${i}`, name: `Album ${i}` })),
    { key: null, name: null }, //            not counted, never ranked
    { key: 'al8', name: '  ' }, //            counted, never ranked
    { key: null, name: 'Loose Album' } //   grouped by name
  ];
  const artistNames = { a0: 'Artist 0', a1: 'Artist 1', a2: 'Artist 2', a3: 'Artist 3', a4: 'Artist 4', a5: 'Artist 5' };
  return { tracks, albums, artistNames };
}

function insertRandomPlay(db, random, atMs, data) {
  const track = data.tracks[Math.floor(random() ** 2 * data.tracks.length)];
  const album = data.albums[track.album];
  const roll = random();
  insertPlay(db, new Date(atMs).toISOString(), track.key, track.artists, {
    trackName: track.name,
    album: album.name,
    albumKey: album.key,
    ms: roll < 0.2 ? null : Math.floor(random() * 300000),
    duration: roll < 0.1 ? null : 200000,
    artistNames: data.artistNames
  });
}

async function assertSame(db, rangeKey, days, now, queryIds = QUERY_IDS) {
  const since = await resolveSince(db, days, new Date(now));
  const expected = await runMetricQueries(db, since, queryIds);
  const actual = await loadWindowResults(db, rangeKey, since, queryIds);
  assert.deepEqual(actual, expected, `${rangeKey} at ${new Date(now).toISOString()}`);
}

for (const seed of [1, 2, 3, 4, 5]) {
  test(`window results match the direct queries over a random history (seed ${seed})`, async () => {
    const random = rng(seed);
    const data = catalog();
    const db = createD1();
    const usedAt = new Set();
    let now = START;

    for (let step = 0; step < 120; step += 1) {
      now += Math.floor(random() * 3 * HOUR);
      const count = Math.floor(random() * 4);
      for (let i = 0; i < count; i += 1) {
        // Mostly new plays; some arrive late with an older played_at (offline plays,
        // imports), some even before the all-time start.
        const late = random();
        let at = late < 0.1 ? now - Math.floor(random() * 6 * 24 * HOUR)
          : late < 0.13 ? START - Math.floor(random() * 10 * 24 * HOUR)
            : now - Math.floor(random() * HOUR);
        while (usedAt.has(at)) {
          at += 1;
        }
        usedAt.add(at);
        insertRandomPlay(db, random, at, data);
      }
      // The slots start with fewer metrics and add more later on.
      await assertSame(db, '2d', 2, now, step < 40 ? ['summary'] : step < 80 ? ['summary', 'topArtist'] : QUERY_IDS);
      await assertSame(db, 'all', 'all', now);
      if (step % 10 === 0) {
        await assertSame(db, '7d', 7, now, ['summary']);
      }
    }
  });
}

test('an empty database gives the same empty results', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  await assertSame(db, '28d', 28, now);
  insertPlay(db, '2026-07-13T03:00:00.000Z', 'x', 'X');
  await assertSame(db, '28d', 28, now);
});

test('a window built for fewer queries only counts the kinds it is missing', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', ['X', 'Y']);
  await assertSame(db, '28d', 28, now, ['summary']);
  assert.equal((await windowRow(db, '28d')).kinds, 'album,track');
  insertPlay(db, '2026-07-12T04:00:00.000Z', 'y', ['Y']);
  await assertSame(db, '28d', 28, now, ['summary', 'topArtist', 'peakHour']);
  assert.equal((await windowRow(db, '28d')).kinds, 'album,artist,hour,track');
});

test('an idle sync reads only the window state', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  await assertSame(db, '28d', 28, now, ['summary', 'topAlbum']);
  const before = (await windowRow(db, '28d')).token;
  await assertSame(db, '28d', 28, now, ['summary', 'topAlbum']);
  assert.equal((await windowRow(db, '28d')).token, before);
});

test('a concurrent update makes the loser retry instead of double counting', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  await assertSame(db, '28d', 28, now);
  insertPlay(db, '2026-07-12T04:00:00.000Z', 'y', 'Y');

  // The first batch of the next update reads the window; swap its token right after,
  // as if another request had updated the window in between.
  const realBatch = db.batch;
  let calls = 0;
  db.batch = async (statements) => {
    const results = await realBatch(statements);
    calls += 1;
    if (calls === 1) {
      db.sqlite.prepare("UPDATE stat_windows SET token = 'other'").run();
    }
    return results;
  };
  await assertSame(db, '28d', 28, now);
  db.batch = realBatch;
  assert.ok(calls > 3, 'the update was retried');
});

test('rewritten plays are recounted after invalidation', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  insertPlay(db, '2026-07-12T04:00:00.000Z', 'y', 'Y');
  await assertSame(db, 'all', 'all', now);
  db.sqlite.prepare("UPDATE plays SET ms_played = 1, album_name = 'Changed' WHERE track_key = 'x'").run();
  db.sqlite.prepare("DELETE FROM plays WHERE track_key = 'y'").run();
  await invalidateStatWindows(db);
  await assertSame(db, 'all', 'all', now);
});

test('rowids that point at other rows force a rebuild', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  insertPlay(db, '2026-07-12T04:00:00.000Z', 'y', 'Y');
  await assertSame(db, 'all', 'all', now);
  // Simulates a table rewrite (restore, VACUUM) that renumbers rows.
  db.sqlite.exec(`
    CREATE TABLE plays_copy AS SELECT * FROM plays ORDER BY played_at DESC;
    DELETE FROM plays;
    INSERT INTO plays SELECT * FROM plays_copy;
    DROP TABLE plays_copy;
  `);
  insertPlay(db, '2026-07-12T05:00:00.000Z', 'z', 'Z');
  db.sqlite.prepare("DELETE FROM plays WHERE track_key = 'x'").run();
  await assertSame(db, 'all', 'all', now);
});

test('pruning drops windows of ranges no longer used', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  await assertSame(db, '28d', 28, now);
  await assertSame(db, '7d', 7, now);
  assert.deepEqual(await pruneStatWindows(db, ['28d']), ['7d']);
  assert.deepEqual(await pruneStatWindows(db, ['28d']), []);
  const left = db.sqlite.prepare('SELECT DISTINCT range_key FROM stat_counts').all();
  assert.deepEqual(left.map((row) => row.range_key), ['28d']);
});

test('queryKinds always keeps track counts for the totals', () => {
  assert.deepEqual(queryKinds([]), ['track']);
  assert.deepEqual(queryKinds(['firstPlay', 'newSongs']), ['track']);
  assert.deepEqual(queryKinds(['lateNight', 'busiestDay', 'artistCount']), ['artist', 'date', 'hour', 'track']);
});

async function windowRow(db, rangeKey) {
  return db.sqlite.prepare('SELECT * FROM stat_windows WHERE range_key = ?').get(rangeKey);
}

test('a preview never builds a window but reuses one that exists', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  insertPlay(db, '2026-07-12T03:00:00.000Z', 'x', 'X');
  const since = await resolveSince(db, 28, new Date(now));
  const expected = await runMetricQueries(db, since, QUERY_IDS);
  assert.deepEqual(await loadWindowResults(db, '28d', since, QUERY_IDS, { allowBuild: false }), expected);
  assert.equal(await windowRow(db, '28d'), undefined);
  await assertSame(db, '28d', 28, now);
  insertPlay(db, '2026-07-12T04:00:00.000Z', 'y', 'Y');
  const updated = await runMetricQueries(db, since, QUERY_IDS);
  const token = (await windowRow(db, '28d')).token;
  assert.deepEqual(await loadWindowResults(db, '28d', since, QUERY_IDS, { allowBuild: false }), updated);
  assert.notEqual((await windowRow(db, '28d')).token, token, 'the existing window was updated');
});

test('an upsert that changes a counted column of a stored play invalidates the windows', async () => {
  const db = createD1();
  const now = Date.parse('2026-07-13T04:00:00.000Z');
  const item = (name) => ({
    played_at: '2026-07-12T03:00:00.000Z',
    track: {
      type: 'track', id: 'tx', uri: 'spotify:track:tx', name, duration_ms: 1000,
      album: { id: 'ax', uri: 'spotify:album:ax', name: 'Album X', images: [] },
      artists: [{ id: 'rx', uri: 'spotify:artist:rx', name: 'Artist X' }]
    }
  });
  db.sqlite.prepare("INSERT INTO app_state (key, value) VALUES ('widget_metrics_cache:28d', '{}')").run();

  assert.equal(await upsertSpotifyPlay(db, item('Song')), true);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM play_artists').get().n, 1);
  assert.equal(db.sqlite.prepare("SELECT artist_name FROM artists WHERE artist_key = 'rx'").get().artist_name, 'Artist X');
  await assertSame(db, '28d', 28, now);
  assert.equal(await upsertSpotifyPlay(db, item('Song')), false);
  assert.ok(await windowRow(db, '28d'), 'an unchanged upsert keeps the window');

  assert.equal(await upsertSpotifyPlay(db, item('Song (Live)')), false);
  assert.equal(await windowRow(db, '28d'), undefined);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM app_state WHERE key LIKE 'widget_metrics_cache:%'").get().n, 0);
  await assertSame(db, '28d', 28, now);
});

test('the artists upsert writes only when an artist changes', async () => {
  const db = createD1();
  const item = (playedAt, artistName) => ({
    played_at: playedAt,
    track: {
      type: 'track', id: 'tx', uri: 'spotify:track:tx', name: 'Song', duration_ms: 1000,
      album: { id: 'ax', uri: 'spotify:album:ax', name: 'Album X', images: [] },
      artists: [{ id: 'rx', uri: 'spotify:artist:rx', name: artistName }]
    }
  });
  const changes = () => db.sqlite.prepare('SELECT total_changes() AS n').get().n;

  await upsertSpotifyPlay(db, item('2026-07-12T03:00:00.000Z', 'Artist X'));
  const before = changes();
  await upsertSpotifyPlay(db, item('2026-07-12T03:00:00.000Z', 'Artist X'));
  // Only the plays upsert itself writes; the artist rows are left alone.
  assert.equal(changes() - before, 1);

  await upsertSpotifyPlay(db, item('2026-07-12T04:00:00.000Z', 'Artist X (renamed)'));
  assert.equal(db.sqlite.prepare("SELECT artist_name FROM artists WHERE artist_key = 'rx'").get().artist_name,
    'Artist X (renamed)');
});

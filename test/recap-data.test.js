import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { monthRecapRange } from '../shared/recap-ranges.js';

const TEST_DB_PATH = path.join(os.tmpdir(), 'spotify-discord-stats-recap-test.sqlite');

test('recap data includes rankings, patterns, comparison, and artwork', async () => {
  fs.rmSync(TEST_DB_PATH, { force: true });
  process.env.DATABASE_PATH = TEST_DB_PATH;

  const { upsertSpotifyPlay } = await import('../src/db.js');
  const { getWeeklyRecapData } = await import('../src/recap-data.js');

  upsertSpotifyPlay(play('2026-07-07T14:05:00.000Z', 'a', 'Alpha', 'Artist One'));
  upsertSpotifyPlay(play('2026-07-07T15:05:00.000Z', 'a', 'Alpha', 'Artist One'));
  upsertSpotifyPlay(play('2026-07-06T03:05:00.000Z', 'b', 'Beta', 'Artist Two'));
  upsertSpotifyPlay(play('2026-06-30T03:05:00.000Z', 'old', 'Old', 'Artist Old'));

  const recap = getWeeklyRecapData(new Date('2026-07-08T02:00:00.000Z'));

  assert.equal(recap.summary.songsPlayed, 3);
  assert.equal(recap.comparison.songsPlayedDelta, 2);
  assert.equal(recap.topTracks[0].trackName, 'Alpha');
  assert.equal(recap.topTracks[0].plays, 2);
  assert.equal(recap.topTracks[0].albumImageUrl, 'https://example.com/a-large.jpg');
  assert.equal(recap.topArtists[0].artistName, 'Artist One');
  assert.equal(recap.topAlbums[0].albumName, 'Album a');
  assert.equal(recap.patterns.lateNightPercent, 67);
  assert.deepEqual(recap.newTracks.map((track) => track.trackName), ['Alpha', 'Beta']);
});

test('monthly recap range uses natural month in Asia/Taipei', () => {
  assert.deepEqual(monthRecapRange('2026-06'), {
    kind: 'monthly',
    timeZone: 'Asia/Taipei',
    start: '2026-05-31T16:00:00.000Z',
    end: '2026-06-30T16:00:00.000Z',
    previousStart: '2026-04-30T16:00:00.000Z',
    previousEnd: '2026-05-31T16:00:00.000Z'
  });
});

function play(playedAt, id, name, artistName) {
  return {
    played_at: playedAt,
    track: {
      type: 'track',
      id,
      uri: `spotify:track:${id}`,
      name,
      duration_ms: 180000,
      album: album(id),
      artists: [{ id: `${artistName}-id`, uri: `spotify:artist:${artistName}-id`, name: artistName }]
    }
  };
}

function album(id) {
  return {
    id: `${id}-album`,
    uri: `spotify:album:${id}-album`,
    name: `Album ${id}`,
    images: [
      { url: `https://example.com/${id}-small.jpg`, width: 64, height: 64 },
      { url: `https://example.com/${id}-large.jpg`, width: 640, height: 640 }
    ]
  };
}

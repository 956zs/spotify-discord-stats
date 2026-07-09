import assert from 'node:assert/strict';
import test from 'node:test';
import { exportRowToPlayRecords } from '../shared/play-records.js';

test('parses one-year Spotify account streaming history rows', () => {
  const records = exportRowToPlayRecords({
    endTime: '2026-07-09 13:10',
    artistName: 'Tatsuya Kitani',
    trackName: '素敵なしゅうまつを！',
    msPlayed: 123456
  });

  assert.equal(records.play.playedAt, '2026-07-09T13:10:00.000Z');
  assert.equal(records.play.trackName, '素敵なしゅうまつを！');
  assert.equal(records.play.msPlayed, 123456);
  assert.equal(records.artists[0].artistName, 'Tatsuya Kitani');
});

test('parses extended Spotify streaming history rows', () => {
  const records = exportRowToPlayRecords({
    ts: '2026-07-09T05:10:30Z',
    ms_played: 654321,
    master_metadata_track_name: 'Call of Silence',
    master_metadata_album_artist_name: 'Hiroyuki Sawano',
    master_metadata_album_album_name: 'TV Anime Soundtrack',
    spotify_track_uri: 'spotify:track:abc123'
  });

  assert.equal(records.play.playedAt, '2026-07-09T05:10:30.000Z');
  assert.equal(records.play.trackKey, 'abc123');
  assert.equal(records.play.albumName, 'TV Anime Soundtrack');
  assert.equal(records.play.msPlayed, 654321);
});

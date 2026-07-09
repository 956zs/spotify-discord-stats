import assert from 'node:assert/strict';
import test from 'node:test';
import { playRowToSongStatus } from '../shared/song.js';

test('song widget value stays compact for the Discord card', () => {
  const status = playRowToSongStatus({
    track_name: '素敵なしゅうまつを！',
    artist_names: 'Tatsuya Kitani',
    album_name: '青のすみか',
    album_image_url: 'https://example.com/art.jpg'
  });

  assert.equal(status.value, '♪ 素敵なしゅうまつを！');
  assert.deepEqual(status.artists, ['Tatsuya Kitani']);
});

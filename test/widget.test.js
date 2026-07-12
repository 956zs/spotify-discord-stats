import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWidgetPayload } from '../src/widget.js';

test('widget headline stays compact and readable', () => {
  const payload = buildWidgetPayload({
    since: '2026-06-15T00:00:00.000Z',
    songsPlayed: 4146,
    listeningMs: 805338291,
    uniqueSongs: 2274,
    differentArtists: 876,
    differentAlbums: 469,
    topAlbum: "eYe's",
    lastPlayed: { value: '♪ 素敵なしゅうまつを！' }
  });

  assert.equal(findField(payload, 'main_title'), '✦ 4w plays: 4,146');
  assert.equal(findField(payload, 'Songs_Played'), '4,146');
  assert.equal(findField(payload, 'Unique_Songs'), '2,274');
});

function findField(payload, name) {
  return payload.data.dynamic.find((field) => field.name === name)?.value;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWidgetPayload } from '../src/widget.js';

test('widget headline stays compact and readable', () => {
  const payload = buildWidgetPayload({
    days: 28,
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

test('widget sends stat labels as user data fields', () => {
  const payload = buildWidgetPayload({
    days: 28,
    since: '2026-06-15T00:00:00.000Z',
    songsPlayed: 1,
    listeningMs: 0,
    uniqueSongs: 1,
    differentArtists: 1,
    differentAlbums: 1,
    topAlbum: 'A',
    lastPlayed: { value: '♪ A' }
  });

  assert.equal(findField(payload, 'Songs_Played_Label'), 'Total Songs Played');
  assert.equal(findField(payload, 'Top_Album_Label'), 'Top Album');
  assert.equal(findField(payload, 'top_hero_title'), '✦ 4w on Spotify🧋');
});

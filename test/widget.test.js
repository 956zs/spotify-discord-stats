import assert from 'node:assert/strict';
import test from 'node:test';
import { appConfig, widgetConfig } from '../src/config.js';
import { buildWidgetPayload } from '../shared/widget-payload.js';
import { defaultSettings } from '../shared/widget-settings.js';

const NOW = new Date('2026-07-13T04:00:00.000Z');

function data(summary = {}) {
  const results = {
    summary: { songsPlayed: 4146, listeningMs: 805338291, uniqueSongs: 2274, differentAlbums: 469, ...summary },
    artistCount: { differentArtists: 876 },
    topAlbum: { name: "eYe's", plays: 40 }
  };
  return {
    ranges: { '28d': { days: 28, since: '2026-06-15T04:00:00.000Z', results } },
    lastPlayed: { value: '♪ 素敵なしゅうまつを！' },
    now: NOW
  };
}

function findField(payload, name) {
  return payload.data.dynamic.find((field) => field.name === name)?.value;
}

test('default widget output matches the original fixed layout', () => {
  const settings = defaultSettings({ ...appConfig, statsDays: 28 }, widgetConfig);
  const payload = buildWidgetPayload(data(), settings, widgetConfig.fields);

  assert.equal(findField(payload, 'top_hero_title'), '✦ 4w on Spotify🧋');
  assert.equal(findField(payload, 'main_title'), '✦ 4w plays: 4,146');
  assert.equal(findField(payload, 'Songs_Played'), '4,146');
  assert.equal(findField(payload, 'Listening_Time'), '13422 minutes');
  assert.equal(findField(payload, 'Unique_Songs'), '2,274');
  assert.equal(findField(payload, 'Different_Artists'), '876');
  assert.equal(findField(payload, 'Different_Albums'), '469');
  assert.equal(findField(payload, 'Top_Album'), "eYe's");
  assert.equal(findField(payload, 'Songs_Played_Label'), 'Total Songs Played');
  assert.equal(findField(payload, 'Top_Album_Label'), 'Top Album');
  assert.equal(findField(payload, 'song'), '♪ 素敵なしゅうまつを！');
});

test('every configured slot has value and label field names', () => {
  assert.equal(widgetConfig.slots.length, widgetConfig.fields.slots.length);
  for (const slot of widgetConfig.fields.slots) {
    assert.ok(slot.value && slot.label);
  }
});

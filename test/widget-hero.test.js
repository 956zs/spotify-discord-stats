import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWidgetPayload } from '../shared/widget-payload.js';
import { normalizeHeroMode, resolveHeroImageUrl } from '../shared/widget-hero.js';
import { defaultSettings, mergeSettings, validateSettings } from '../shared/widget-settings.js';

const APP_CONFIG = { statsDays: 28, recapReports: { enabled: true } };
const WIDGET_CONFIG = {
  username: 'Stats',
  topHeroTitle: 'hero',
  mainTitle: 'main',
  lastUpdatedPrefix: 'updated ',
  slots: [{ metric: 'songsPlayed', range: 'global', label: 'Plays', value: '{value}' }]
};
const FIELDS = {
  topHeroTitle: 'top_hero_title',
  during: 'during',
  lastUpdated: 'last_updated',
  song: 'song',
  mainTitle: 'main_title',
  heroImage: 'hero_image',
  slots: [{ value: 'S1', label: 'S1_Label' }]
};
const SHA = 'abcdef0123456789'.repeat(4);
const ALBUM_URL = 'https://i.scdn.co/image/ab67616d0000b273deadbeef';

function settingsWith(heroImage) {
  const settings = structuredClone(defaultSettings(APP_CONFIG, WIDGET_CONFIG));
  settings.widget.heroImage = heroImage;
  return settings;
}

function data(extra = {}) {
  return {
    ranges: { '28d': { days: 28, since: '2026-06-15T00:00:00.000Z', results: { summary: { songsPlayed: 3 } } } },
    lastPlayed: { value: '♪ song', imageUrl: ALBUM_URL },
    heroUpload: { sha256: SHA },
    publicBaseUrl: 'https://stats.example.test',
    now: new Date('2026-07-13T00:00:00.000Z'),
    ...extra
  };
}

function heroField(payload) {
  return payload.data.dynamic.find((field) => field.name === 'hero_image');
}

test('hero mode defaults to asset and normalizes missing or garbage values', () => {
  assert.equal(defaultSettings(APP_CONFIG, WIDGET_CONFIG).widget.heroImage, 'asset');
  assert.equal(defaultSettings(APP_CONFIG, { ...WIDGET_CONFIG, heroImage: 'album' }).widget.heroImage, 'album');
  for (const mode of ['asset', 'upload', 'album']) {
    assert.equal(normalizeHeroMode(mode), mode);
  }
  for (const garbage of [undefined, null, '', 'UPLOAD', 'toString', 3, {}, []]) {
    assert.equal(normalizeHeroMode(garbage), 'asset');
  }
});

test('validateSettings keeps valid hero modes and turns missing or unknown ones into asset', () => {
  for (const mode of ['asset', 'upload', 'album']) {
    assert.equal(validateSettings(settingsWith(mode), 1).settings.widget.heroImage, mode);
  }
  const missing = settingsWith('album');
  delete missing.widget.heroImage;
  assert.equal(validateSettings(missing, 1).settings.widget.heroImage, 'asset');
  const { settings, errors } = validateSettings(settingsWith('<script>'), 1);
  assert.deepEqual(errors, []);
  assert.equal(settings.widget.heroImage, 'asset');
});

test('older stored settings without a hero mode merge to asset', () => {
  const defaults = defaultSettings(APP_CONFIG, WIDGET_CONFIG);
  const older = structuredClone(defaults);
  delete older.widget.heroImage;
  older.widget.mainTitle = 'kept';
  const merged = mergeSettings(defaults, older);
  assert.equal(merged.widget.heroImage, 'asset');
  assert.equal(merged.widget.mainTitle, 'kept');
});

test('asset mode sends no hero field', () => {
  assert.equal(heroField(buildWidgetPayload(data(), settingsWith('asset'), FIELDS)), undefined);
});

test('upload mode sends a type 3 media field with a versioned public URL', () => {
  const field = heroField(buildWidgetPayload(data({ publicBaseUrl: 'https://stats.example.test/' }), settingsWith('upload'), FIELDS));
  assert.deepEqual(field, {
    type: 3,
    name: 'hero_image',
    value: { url: `https://stats.example.test/widget/hero?v=${SHA.slice(0, 12)}` }
  });
});

test('upload mode falls back to asset without an image or a public base URL', () => {
  assert.equal(heroField(buildWidgetPayload(data({ heroUpload: null }), settingsWith('upload'), FIELDS)), undefined);
  assert.equal(heroField(buildWidgetPayload(data({ publicBaseUrl: null }), settingsWith('upload'), FIELDS)), undefined);
});

test('album mode sends the last played album artwork', () => {
  assert.deepEqual(heroField(buildWidgetPayload(data(), settingsWith('album'), FIELDS)), {
    type: 3,
    name: 'hero_image',
    value: { url: ALBUM_URL }
  });
});

test('album mode falls back to asset when there is no usable artwork', () => {
  for (const lastPlayed of [{ value: '' }, { value: '♪ x', imageUrl: null }, { value: '♪ x', imageUrl: 'http://insecure/x.jpg' }, { value: '♪ x', imageUrl: 'not a url' }]) {
    assert.equal(heroField(buildWidgetPayload(data({ lastPlayed }), settingsWith('album'), FIELDS)), undefined);
  }
});

test('a hero image without a configured field name fails loudly, asset mode does not need one', () => {
  const fields = { ...FIELDS, heroImage: undefined };
  assert.throws(() => buildWidgetPayload(data(), settingsWith('album'), fields), /field name is missing/);
  assert.doesNotThrow(() => buildWidgetPayload(data(), settingsWith('asset'), fields));
});

test('resolveHeroImageUrl handles empty input', () => {
  assert.equal(resolveHeroImageUrl('album'), null);
  assert.equal(resolveHeroImageUrl('upload', {}), null);
  assert.equal(resolveHeroImageUrl(undefined, {}), null);
});

test('heroEditorConfirmed defaults to false and only a real true counts', () => {
  assert.equal(defaultSettings(APP_CONFIG, WIDGET_CONFIG).widget.heroEditorConfirmed, false);
  assert.equal(defaultSettings(APP_CONFIG, { ...WIDGET_CONFIG, heroEditorConfirmed: true }).widget.heroEditorConfirmed, true);
  assert.equal(defaultSettings(APP_CONFIG, { ...WIDGET_CONFIG, heroEditorConfirmed: 'yes' }).widget.heroEditorConfirmed, false);

  for (const value of [true, false]) {
    const settings = settingsWith('upload');
    settings.widget.heroEditorConfirmed = value;
    assert.equal(validateSettings(settings, 1).settings.widget.heroEditorConfirmed, value);
  }
  const missing = settingsWith('upload');
  delete missing.widget.heroEditorConfirmed;
  assert.equal(validateSettings(missing, 1).settings.widget.heroEditorConfirmed, false);
  for (const garbage of [null, '', 'true', 1, 0, {}, [], '<script>']) {
    const settings = settingsWith('album');
    settings.widget.heroEditorConfirmed = garbage;
    const result = validateSettings(settings, 1);
    assert.deepEqual(result.errors, []);
    assert.equal(result.settings.widget.heroEditorConfirmed, false);
  }
});

test('older stored settings without heroEditorConfirmed merge to false', () => {
  const defaults = defaultSettings(APP_CONFIG, WIDGET_CONFIG);
  const older = structuredClone(defaults);
  delete older.widget.heroEditorConfirmed;
  assert.equal(mergeSettings(defaults, older).widget.heroEditorConfirmed, false);
  older.widget.heroEditorConfirmed = true;
  assert.equal(mergeSettings(defaults, older).widget.heroEditorConfirmed, true);
});

test('heroEditorConfirmed does not change the payload', () => {
  const confirmed = settingsWith('upload');
  confirmed.widget.heroEditorConfirmed = true;
  assert.deepEqual(buildWidgetPayload(data(), confirmed, FIELDS), buildWidgetPayload(data(), settingsWith('upload'), FIELDS));
});

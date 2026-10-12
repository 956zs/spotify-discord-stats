import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWidgetPayload } from '../shared/widget-payload.js';
import {
  STAT_KEYS,
  defaultSettings,
  mergeSettings,
  rangeLongLabel,
  rangeShortLabel,
  renderTemplate,
  validateSettings
} from '../shared/widget-settings.js';

const APP_CONFIG = { statsDays: 28, recapReports: { enabled: true } };
const WIDGET_CONFIG = {
  username: 'Stats',
  topHeroTitle: '✦ {range} on Spotify',
  mainTitle: '{rangeLong}: {count}',
  lastUpdatedPrefix: 'updated ',
  stats: Object.fromEntries(STAT_KEYS.map((key) => [key, { label: `${key} label`, value: '{value}' }]))
};
const FIELDS = {
  topHeroTitle: 'top_hero_title',
  during: 'during',
  lastUpdated: 'last_updated',
  song: 'song',
  mainTitle: 'main_title',
  ...Object.fromEntries(STAT_KEYS.map((key) => [key, key])),
  labels: Object.fromEntries(STAT_KEYS.map((key) => [key, `${key}_Label`]))
};

function validInput() {
  return structuredClone(defaultSettings(APP_CONFIG, WIDGET_CONFIG));
}

function stats(overrides = {}) {
  return {
    days: 28,
    since: '2026-06-15T00:00:00.000Z',
    songsPlayed: 4146,
    listeningMs: 60000,
    uniqueSongs: 2274,
    differentArtists: 876,
    differentAlbums: 469,
    topAlbum: "eYe's",
    lastPlayed: { value: '♪ song' },
    ...overrides
  };
}

function field(payload, name) {
  return payload.data.dynamic.find((entry) => entry.name === name)?.value;
}

test('range labels cover weeks, days, years, and all time', () => {
  assert.equal(rangeShortLabel(28), '4w');
  assert.equal(rangeShortLabel(7), '1w');
  assert.equal(rangeShortLabel(90), '90d');
  assert.equal(rangeShortLabel(1), '1d');
  assert.equal(rangeShortLabel(365), '1y');
  assert.equal(rangeShortLabel('all'), 'all time');
  assert.equal(rangeLongLabel(28), '4 Weeks');
  assert.equal(rangeLongLabel(7), '1 Week');
  assert.equal(rangeLongLabel(1), '1 Day');
  assert.equal(rangeLongLabel(730), '2 Years');
  assert.equal(rangeLongLabel('all'), 'All Time');
});

test('renderTemplate replaces known placeholders and keeps unknown ones', () => {
  assert.equal(renderTemplate('{range} plays: {count}', { range: '4w', count: '12' }), '4w plays: 12');
  assert.equal(renderTemplate('{rnage} typo', { range: '4w' }), '{rnage} typo');
  assert.equal(renderTemplate('', { range: '4w' }), '');
  assert.equal(renderTemplate(null, {}), '');
  assert.equal(renderTemplate('{toString}', {}), '{toString}');
});

test('validateSettings accepts defaults and all-time range', () => {
  const input = validInput();
  input.statsDays = 'all';
  const { settings, errors } = validateSettings(input);
  assert.deepEqual(errors, []);
  assert.equal(settings.statsDays, 'all');
  assert.equal(settings.widget.stats.topAlbum.label, 'topAlbum label');
});

test('validateSettings coerces numeric strings and drops unknown keys', () => {
  const input = validInput();
  input.statsDays = '30';
  input.extra = 'ignored';
  input.widget.injected = 'ignored';
  const { settings } = validateSettings(input);
  assert.equal(settings.statsDays, 30);
  assert.equal('extra' in settings, false);
  assert.equal('injected' in settings.widget, false);
});

test('validateSettings rejects non-object input', () => {
  assert.equal(validateSettings(null).settings, null);
  assert.equal(validateSettings('x').settings, null);
  assert.equal(validateSettings([]).settings, null);
});

test('validateSettings rejects out-of-range days', () => {
  for (const statsDays of [0, -1, 1.5, 3651, 'forever', '', null]) {
    const input = validInput();
    input.statsDays = statsDays;
    const { settings, errors } = validateSettings(input);
    assert.equal(settings, null, `statsDays ${statsDays}`);
    assert.match(errors[0], /statsDays/);
  }
});

test('validateSettings accepts boundary days', () => {
  for (const statsDays of [1, 3650]) {
    const input = validInput();
    input.statsDays = statsDays;
    assert.equal(validateSettings(input).settings.statsDays, statsDays);
  }
});

test('validateSettings rejects empty labels, long text, and wrong types', () => {
  const input = validInput();
  input.widget.stats.songsPlayed.label = '   ';
  input.widget.mainTitle = 'x'.repeat(257);
  input.recapEnabled = 'yes';
  delete input.widget.username;
  const { settings, errors } = validateSettings(input);
  assert.equal(settings, null);
  assert.equal(errors.length, 4);
});

test('mergeSettings fills keys missing from older stored overrides', () => {
  const defaults = defaultSettings(APP_CONFIG, WIDGET_CONFIG);
  const merged = mergeSettings(defaults, {
    statsDays: 'all',
    widget: { topHeroTitle: 'custom', stats: { topAlbum: { label: 'Fav' } } },
    unknown: true
  });
  assert.equal(merged.statsDays, 'all');
  assert.equal(merged.widget.topHeroTitle, 'custom');
  assert.equal(merged.widget.mainTitle, defaults.widget.mainTitle);
  assert.equal(merged.widget.stats.topAlbum.label, 'Fav');
  assert.equal(merged.widget.stats.topAlbum.value, '{value}');
  assert.equal('unknown' in merged, false);
  assert.equal(mergeSettings(defaults, null), defaults);
});

test('payload renders templates for windowed and all-time ranges', () => {
  const widget = defaultSettings(APP_CONFIG, WIDGET_CONFIG).widget;
  widget.stats.songsPlayed.value = '✦ {value}';
  widget.stats.songsPlayed.label = '{range} Songs';

  const windowed = buildWidgetPayload(stats(), widget, FIELDS);
  assert.equal(field(windowed, 'top_hero_title'), '✦ 4w on Spotify');
  assert.equal(field(windowed, 'main_title'), '4 Weeks: 4,146');
  assert.equal(field(windowed, 'songsPlayed'), '✦ 4,146');
  assert.equal(field(windowed, 'songsPlayed_Label'), '4w Songs');
  assert.equal(field(windowed, 'topAlbum'), "eYe's");

  const allTime = buildWidgetPayload(stats({ days: 'all' }), widget, FIELDS);
  assert.equal(field(allTime, 'top_hero_title'), '✦ all time on Spotify');
  assert.equal(field(allTime, 'main_title'), 'All Time: 4,146');
});

test('payload fails loudly when a label field mapping is missing', () => {
  const widget = defaultSettings(APP_CONFIG, WIDGET_CONFIG).widget;
  const fields = { ...FIELDS, labels: {} };
  assert.throws(() => buildWidgetPayload(stats(), widget, fields), /field name is missing/);
});

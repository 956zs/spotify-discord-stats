import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWidgetPayload, planWidgetQueries } from '../shared/widget-payload.js';
import {
  defaultSettings,
  mergeSettings,
  rangeLongLabel,
  rangeShortLabel,
  renderTemplate,
  resolveSlotRange,
  validateSettings
} from '../shared/widget-settings.js';

const SLOT_COUNT = 3;
const APP_CONFIG = { statsDays: 28, recapReports: { enabled: true } };
const WIDGET_CONFIG = {
  username: 'Stats',
  topHeroTitle: '✦ {range} on Spotify',
  mainTitle: '{rangeLong}: {count}',
  lastUpdatedPrefix: 'updated ',
  slots: [
    { metric: 'songsPlayed', range: 'global', label: 'Plays', value: '{value}' },
    { metric: 'topArtist', range: 'global', label: 'Top Artist', value: '{value}' },
    { metric: 'songsPlayed', range: 'all', label: '{range} plays', value: '✦ {value}' }
  ]
};
const FIELDS = {
  topHeroTitle: 'top_hero_title',
  during: 'during',
  lastUpdated: 'last_updated',
  song: 'song',
  mainTitle: 'main_title',
  slots: [1, 2, 3].map((n) => ({ value: `S${n}`, label: `S${n}_Label` }))
};

function validInput() {
  return structuredClone(defaultSettings(APP_CONFIG, WIDGET_CONFIG));
}

function field(payload, name) {
  return payload.data.dynamic.find((entry) => entry.name === name)?.value;
}

function widgetData() {
  return {
    ranges: {
      '28d': {
        days: 28,
        since: '2026-06-15T00:00:00.000Z',
        results: { summary: { songsPlayed: 4146 }, topArtist: { name: 'Yorushika', plays: 12 } }
      },
      all: {
        days: 'all',
        since: '2024-05-24T00:00:00.000Z',
        results: { summary: { songsPlayed: 43672 } }
      }
    },
    lastPlayed: { value: '♪ song' },
    now: new Date('2026-07-13T00:00:00.000Z')
  };
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
  const { settings, errors } = validateSettings(input, SLOT_COUNT);
  assert.deepEqual(errors, []);
  assert.equal(settings.statsDays, 'all');
  assert.equal(settings.widget.slots[1].metric, 'topArtist');
  assert.equal(settings.widget.slots[2].range, 'all');
});

test('validateSettings coerces numeric strings and drops unknown keys', () => {
  const input = validInput();
  input.statsDays = '30';
  input.extra = 'ignored';
  input.widget.injected = 'ignored';
  const { settings } = validateSettings(input, SLOT_COUNT);
  assert.equal(settings.statsDays, 30);
  assert.equal('extra' in settings, false);
  assert.equal('injected' in settings.widget, false);
});

test('validateSettings rejects non-object input', () => {
  assert.equal(validateSettings(null, SLOT_COUNT).settings, null);
  assert.equal(validateSettings('x', SLOT_COUNT).settings, null);
  assert.equal(validateSettings([], SLOT_COUNT).settings, null);
});

test('validateSettings rejects out-of-range days', () => {
  for (const statsDays of [0, -1, 1.5, 3651, 'forever', '', null]) {
    const input = validInput();
    input.statsDays = statsDays;
    const { settings, errors } = validateSettings(input, SLOT_COUNT);
    assert.equal(settings, null, `statsDays ${statsDays}`);
    assert.match(errors[0], /statsDays/);
  }
});

test('validateSettings accepts boundary days', () => {
  for (const statsDays of [1, 3650]) {
    const input = validInput();
    input.statsDays = statsDays;
    assert.equal(validateSettings(input, SLOT_COUNT).settings.statsDays, statsDays);
  }
});

test('validateSettings rejects empty labels, long text, and wrong types', () => {
  const input = validInput();
  input.widget.slots[0].label = '   ';
  input.widget.mainTitle = 'x'.repeat(257);
  input.recapEnabled = 'yes';
  delete input.widget.username;
  const { settings, errors } = validateSettings(input, SLOT_COUNT);
  assert.equal(settings, null);
  assert.equal(errors.length, 4);
});

test('validateSettings checks slot count, metric ids, and slot ranges', () => {
  const tooFew = validInput();
  tooFew.widget.slots.pop();
  assert.match(validateSettings(tooFew, SLOT_COUNT).errors[0], /exactly 3 slots/);

  const unknownMetric = validInput();
  unknownMetric.widget.slots[0].metric = 'genre';
  assert.match(validateSettings(unknownMetric, SLOT_COUNT).errors[0], /not a known metric/);

  const prototypeKey = validInput();
  prototypeKey.widget.slots[0].metric = 'toString';
  assert.equal(validateSettings(prototypeKey, SLOT_COUNT).settings, null);

  const badRange = validInput();
  badRange.widget.slots[1].range = 0;
  assert.match(validateSettings(badRange, SLOT_COUNT).errors[0], /slots\[1\]\.range/);

  const customRange = validInput();
  customRange.widget.slots[1].range = '45';
  assert.equal(validateSettings(customRange, SLOT_COUNT).settings.widget.slots[1].range, 45);
});

test('resolveSlotRange follows the global range only for global slots', () => {
  assert.equal(resolveSlotRange('global', 28), 28);
  assert.equal(resolveSlotRange('global', 'all'), 'all');
  assert.equal(resolveSlotRange('all', 28), 'all');
  assert.equal(resolveSlotRange(90, 'all'), 90);
});

test('mergeSettings fills missing keys and only keeps slot lists of the right length', () => {
  const defaults = defaultSettings(APP_CONFIG, WIDGET_CONFIG);
  const merged = mergeSettings(defaults, {
    statsDays: 'all',
    widget: { topHeroTitle: 'custom', stats: { legacy: true } },
    unknown: true
  });
  assert.equal(merged.statsDays, 'all');
  assert.equal(merged.widget.topHeroTitle, 'custom');
  assert.equal(merged.widget.mainTitle, defaults.widget.mainTitle);
  assert.deepEqual(merged.widget.slots, defaults.widget.slots);
  assert.equal('unknown' in merged, false);
  assert.equal('stats' in merged.widget, false);
  assert.equal(mergeSettings(defaults, null), defaults);

  const reordered = [...defaults.widget.slots].reverse();
  assert.deepEqual(mergeSettings(defaults, { widget: { slots: reordered } }).widget.slots, reordered);
  assert.deepEqual(mergeSettings(defaults, { widget: { slots: reordered.slice(1) } }).widget.slots, defaults.widget.slots);
});

test('planWidgetQueries groups queries per range and always includes summary', () => {
  const plan = planWidgetQueries(validInput());
  assert.deepEqual([...plan.keys()].sort(), ['28d', 'all']);
  assert.deepEqual([...plan.get('28d').queryIds].sort(), ['summary', 'topArtist']);
  assert.deepEqual([...plan.get('all').queryIds], ['summary']);
});

test('payload renders each slot with its own range variables', () => {
  const payload = buildWidgetPayload(widgetData(), validInput(), FIELDS);
  assert.equal(field(payload, 'top_hero_title'), '✦ 4w on Spotify');
  assert.equal(field(payload, 'main_title'), '4 Weeks: 4,146');
  assert.equal(field(payload, 'S1'), '4,146');
  assert.equal(field(payload, 'S2'), 'Yorushika');
  assert.equal(field(payload, 'S2_Label'), 'Top Artist');
  assert.equal(field(payload, 'S3'), '✦ 43,672');
  assert.equal(field(payload, 'S3_Label'), 'all time plays');
});

test('payload fails loudly when a slot has no field names', () => {
  const fields = { ...FIELDS, slots: FIELDS.slots.slice(0, 2) };
  assert.throws(() => buildWidgetPayload(widgetData(), validInput(), fields), /slot 3 has no field names/);
});

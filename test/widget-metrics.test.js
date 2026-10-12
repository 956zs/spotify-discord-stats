import assert from 'node:assert/strict';
import test from 'node:test';
import {
  METRICS,
  currentStreak,
  formatDuration,
  formatMetric,
  longestStreak,
  metricCatalog,
  rangeDayCount
} from '../shared/widget-metrics.js';
import { QUERY_IDS, resolveSince, runMetricQueries } from '../shared/widget-metrics-query.js';
import { createD1, insertPlay } from './helpers/d1.js';

// 2026-07-13 12:00 Taipei (Monday).
const NOW = new Date('2026-07-13T04:00:00.000Z');

// Taipei-local times in comments. Track a / artist A1 were already heard before the window.
function seed() {
  const db = createD1();
  insertPlay(db, '2026-05-01T04:00:00.000Z', 'a', 'A1'); //            05-01 12:00 (outside 28d)
  insertPlay(db, '2026-07-10T16:30:00.000Z', 'a', 'A1'); //            07-11 00:30 Sat, late night
  insertPlay(db, '2026-07-10T17:30:00.000Z', 'b', 'A2'); //            07-11 01:30 Sat, late night
  insertPlay(db, '2026-07-11T12:00:00.000Z', 'b', 'A2'); //            07-11 20:00 Sat
  insertPlay(db, '2026-07-12T12:00:00.000Z', 'b', ['A2', 'A3']); //    07-12 20:00 Sun
  insertPlay(db, '2026-07-13T01:00:00.000Z', 'c', 'A1'); //            07-13 09:00 Mon
  return db;
}

async function rangeResults(db, days) {
  const since = await resolveSince(db, days, NOW);
  return { since, results: await runMetricQueries(db, since, QUERY_IDS) };
}

async function formatted(db, days) {
  const { since, results } = await rangeResults(db, days);
  const ctx = { days, since, now: NOW };
  return Object.fromEntries(Object.keys(METRICS).map((id) => [id, formatMetric(id, results, ctx)]));
}

test('windowed metrics match a hand-checked dataset', async () => {
  const values = await formatted(seed(), 28);
  assert.equal(values.songsPlayed, '5');
  assert.equal(values.uniqueSongs, '3');
  assert.equal(values.differentArtists, '3');
  assert.equal(values.differentAlbums, '3');
  assert.equal(values.listeningMinutes, '15 minutes');
  assert.equal(values.listeningHours, '0 hours');
  assert.equal(values.dailyMinutes, '1 min/day');
  assert.equal(values.dailyPlays, '0.2 plays/day');
  assert.equal(values.averageTrackLength, '3:00');
  assert.equal(values.topTrack, 'Track b');
  assert.equal(values.topTrackWithArtist, 'Track b — Artist A2, Artist A3');
  assert.equal(values.topTrackPlays, '3');
  assert.equal(values.topArtist, 'Artist A2');
  assert.equal(values.topArtistPlays, '3');
  assert.equal(values.topAlbum, 'Album b');
  assert.equal(values.topAlbumPlays, '3');
  assert.equal(values.peakHour, '20:00');
  assert.equal(values.peakWeekday, 'Saturday');
  assert.equal(values.listeningDays, '3');
  assert.equal(values.busiestDay, '2026/7/11 (3)');
  assert.equal(values.busiestDayPlays, '3');
  assert.equal(values.lateNightShare, '40%');
  assert.equal(values.newSongs, '2');
  assert.equal(values.newArtists, '2');
  assert.equal(values.repeatRate, '1.7x');
  assert.equal(values.currentStreak, '3 days');
  assert.equal(values.longestStreak, '3 days');
  assert.equal(values.daysSinceFirstPlay, '74 days');
});

test('all-time metrics start at the first play', async () => {
  const values = await formatted(seed(), 'all');
  assert.equal(values.songsPlayed, '6');
  assert.equal(values.newSongs, '3');
  assert.equal(values.newArtists, '3');
  assert.equal(values.topArtist, 'Artist A1');
  assert.equal(values.longestStreak, '3 days');
  assert.equal(values.listeningDays, '4');
});

test('window start is floored to the hour', async () => {
  const since = await resolveSince(createD1(), 28, new Date('2026-07-13T04:37:12.000Z'));
  assert.equal(since, '2026-06-15T04:00:00.000Z');
});

test('every metric formats an empty database without throwing', async () => {
  const values = await formatted(createD1(), 28);
  assert.equal(values.songsPlayed, '0');
  assert.equal(values.topTrack, '—');
  assert.equal(values.topAlbum, 'unknown');
  assert.equal(values.peakHour, '—');
  assert.equal(values.busiestDay, '—');
  assert.equal(values.lateNightShare, '0%');
  assert.equal(values.averageTrackLength, '0:00');
  assert.equal(values.repeatRate, '0.0x');
  assert.equal(values.currentStreak, '0 days');
  assert.equal(values.daysSinceFirstPlay, '—');
  const allTime = await formatted(createD1(), 'all');
  assert.equal(allTime.dailyPlays, '0.0 plays/day');
});

test('streaks handle gaps, yesterday, and broken runs', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(['2026-07-01', '2026-07-02', '2026-07-04', '2026-07-05', '2026-07-06']), 3);
  assert.equal(longestStreak(['2026-02-28', '2026-03-01']), 2);
  const days = ['2026-07-10', '2026-07-11', '2026-07-12'];
  assert.equal(currentStreak(days, NOW), 3); //            last day was yesterday
  assert.equal(currentStreak(['2026-07-11'], NOW), 0); //  two days ago: broken
  assert.equal(currentStreak([], NOW), 0);
  // 2026-07-12 23:30 Taipei is still "today" = 07-12 even though UTC is 15:30.
  assert.equal(currentStreak(['2026-07-12'], new Date('2026-07-12T15:30:00.000Z')), 1);
});

test('formatDuration and rangeDayCount boundaries', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(61_000), '1:01');
  assert.equal(formatDuration(59_600), '1:00');
  assert.equal(formatDuration(null), '0:00');
  assert.equal(rangeDayCount({ days: 28 }), 28);
  assert.equal(rangeDayCount({ days: 'all', since: '2026-07-01T16:00:00.000Z', now: NOW }), 12);
  assert.equal(rangeDayCount({ days: 'all', since: NOW.toISOString(), now: NOW }), 1);
});

test('metric catalog lists every metric with admin copy', () => {
  const catalog = metricCatalog();
  assert.equal(catalog.length, Object.keys(METRICS).length);
  for (const metric of catalog) {
    assert.ok(metric.name && metric.group && metric.label, metric.id);
    for (const query of METRICS[metric.id].queries) {
      assert.ok(QUERY_IDS.includes(query), `${metric.id} uses unknown query ${query}`);
    }
  }
});

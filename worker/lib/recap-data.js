import { monthRecapRange, previousMonthRecapRange, weeklyRecapRange } from '../../shared/recap-ranges.js';
import { MS_PER_DAY } from '../../shared/time.js';

const TOP_LIMIT = 5;
const MAX_TOP_LIMIT = 25;
const LATE_NIGHT_START_HOUR = 21;
const LATE_NIGHT_END_HOUR = 2;
const LOCAL_TIME_MODIFIER = '+8 hours';

export function getWeeklyRecapData(db, now = new Date()) {
  return getRecapData(db, weeklyRecapRange(now));
}

export function getMonthlyRecapData(db, now = new Date()) {
  return getRecapData(db, previousMonthRecapRange(now));
}

export function getMonthRecapData(db, yearMonth) {
  return getRecapData(db, monthRecapRange(yearMonth));
}

export async function getRecapData(db, range, options = {}) {
  const limit = options.limit ?? TOP_LIMIT;
  const summary = await getSummary(db, range.start, range.end);
  const previousSummary = await getSummary(db, range.previousStart, range.previousEnd);

  return {
    range,
    summary,
    comparison: compareSummaries(summary, previousSummary),
    topTracks: await getTopTracks(db, range, limit),
    topArtists: await getTopArtists(db, range, limit),
    topAlbums: await getTopAlbums(db, range, limit),
    newTracks: await getNewTracks(db, range, limit),
    patterns: await getPatterns(db, range)
  };
}

async function getSummary(db, start, end) {
  const row = await first(db, summarySql(), [start, end]);
  const artistRow = await first(db, artistSummarySql(), [start, end]);
  return {
    songsPlayed: numeric(row.songs_played),
    listeningMs: numeric(row.listening_ms),
    uniqueSongs: numeric(row.unique_songs),
    differentAlbums: numeric(row.different_albums),
    differentArtists: numeric(artistRow.different_artists)
  };
}

async function getTopTracks(db, range, limit) {
  const rows = await all(db, topTracksSql(limit), [range.start, range.end]);
  return Promise.all(rows.map(async (row) => mapTrack(row, await getTrackArtists(db, range, row.track_key))));
}

async function getTrackArtists(db, range, trackKey) {
  const rows = await all(db, trackArtistsSql(), [trackKey, range.start, range.end]);
  return rows.map((row) => row.artist_name);
}

async function getTopArtists(db, range, limit) {
  const rows = await all(db, topArtistsSql(limit), [range.start, range.end]);
  return rows.map((row) => ({ artistKey: row.artist_key, artistName: row.artist_name, plays: numeric(row.plays) }));
}

async function getTopAlbums(db, range, limit) {
  const rows = await all(db, topAlbumsSql(limit), [range.start, range.end]);
  return rows.map(mapAlbum);
}

async function getNewTracks(db, range, limit) {
  const rows = await all(db, newTracksSql(limit), [range.start, range.end, range.start]);
  return Promise.all(rows.map(async (row) => mapTrack(row, await getTrackArtists(db, range, row.track_key))));
}

async function getPatterns(db, range) {
  const distinctDays = await getListeningDays(db, range);
  const peakHour = await first(db, peakHourSql(), [range.start, range.end]);
  return {
    peakDay: mapDay(await first(db, peakDaySql(), [range.start, range.end])),
    peakHour: mapHour(peakHour),
    lateNightPercent: await getLateNightPercent(db, range),
    longestStreakDays: longestStreak(distinctDays),
    listeningDays: distinctDays.length
  };
}

async function getListeningDays(db, range) {
  const rows = await all(db, listeningDaysSql(), [range.start, range.end]);
  return rows.map((row) => row.local_date);
}

async function getLateNightPercent(db, range) {
  const row = await first(db, lateNightSql(), [range.start, range.end]);
  const plays = numeric(row.total_plays);
  return plays === 0 ? 0 : Math.round((numeric(row.late_night_plays) / plays) * 100);
}

function compareSummaries(current, previous) {
  return {
    songsPlayedDelta: current.songsPlayed - previous.songsPlayed,
    listeningMsDelta: current.listeningMs - previous.listeningMs,
    uniqueSongsDelta: current.uniqueSongs - previous.uniqueSongs,
    differentArtistsDelta: current.differentArtists - previous.differentArtists,
    differentAlbumsDelta: current.differentAlbums - previous.differentAlbums
  };
}

function mapTrack(row, artists) {
  return {
    trackKey: row.track_key,
    trackName: row.track_name,
    artists,
    albumName: row.album_name,
    albumImageUrl: row.album_image_url,
    plays: numeric(row.plays),
    listeningMs: numeric(row.listening_ms)
  };
}

function mapAlbum(row) {
  return {
    albumKey: row.album_key,
    albumName: row.album_name,
    albumImageUrl: row.album_image_url,
    plays: numeric(row.plays),
    listeningMs: numeric(row.listening_ms)
  };
}

function mapDay(row) {
  return row ? { date: row.local_date, plays: numeric(row.plays), listeningMs: numeric(row.listening_ms) } : null;
}

function mapHour(row) {
  return row ? { hour: numeric(row.local_hour), label: `${row.local_hour}:00`, plays: numeric(row.plays) } : null;
}

function longestStreak(days) {
  let best = 0;
  let current = 0;
  let previousMs = null;
  for (const day of days) {
    const ms = Date.parse(`${day}T00:00:00.000Z`);
    current = previousMs === ms - MS_PER_DAY ? current + 1 : 1;
    best = Math.max(best, current);
    previousMs = ms;
  }
  return best;
}

function numeric(value) {
  return Number(value ?? 0);
}

async function first(db, sql, bindings) {
  return (await db.prepare(sql).bind(...bindings).first()) ?? {};
}

async function all(db, sql, bindings) {
  return (await db.prepare(sql).bind(...bindings).all()).results ?? [];
}

function summarySql() {
  return `
    SELECT COUNT(*) AS songs_played,
      COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms,
      COUNT(DISTINCT track_key) AS unique_songs,
      COUNT(DISTINCT COALESCE(album_key, album_name)) AS different_albums
    FROM plays
    WHERE played_at >= ? AND played_at < ?
  `;
}

// See getArtistSummary in stats.js for why artist_key carries a unary +.
function artistSummarySql() {
  return `
    SELECT COUNT(DISTINCT +artist_key) AS different_artists
    FROM play_artists
    WHERE played_at >= ? AND played_at < ?
  `;
}

function topTracksSql(limit) {
  return `
    SELECT track_key, track_name, album_name, MAX(album_image_url) AS album_image_url,
      COUNT(*) AS plays, COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms
    FROM plays
    WHERE played_at >= ? AND played_at < ?
    GROUP BY track_key, track_name, album_name
    ORDER BY plays DESC, listening_ms DESC, track_name COLLATE NOCASE ASC
    LIMIT ${safeLimit(limit)}
  `;
}

function trackArtistsSql() {
  return `
    SELECT DISTINCT artist_name
    FROM play_artists
    WHERE track_key = ? AND played_at >= ? AND played_at < ?
    ORDER BY artist_name COLLATE NOCASE ASC
  `;
}

function topArtistsSql(limit) {
  return `
    SELECT artist_key, artist_name, COUNT(*) AS plays
    FROM play_artists
    WHERE played_at >= ? AND played_at < ?
    GROUP BY artist_key, artist_name
    ORDER BY plays DESC, artist_name COLLATE NOCASE ASC
    LIMIT ${safeLimit(limit)}
  `;
}

function topAlbumsSql(limit) {
  return `
    SELECT COALESCE(album_key, album_name) AS album_key, album_name,
      MAX(album_image_url) AS album_image_url, COUNT(*) AS plays,
      COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms
    FROM plays
    WHERE played_at >= ? AND played_at < ? AND album_name IS NOT NULL
    GROUP BY COALESCE(album_key, album_name), album_name
    ORDER BY plays DESC, listening_ms DESC, album_name COLLATE NOCASE ASC
    LIMIT ${safeLimit(limit)}
  `;
}

function newTracksSql(limit) {
  return `
    SELECT p.track_key, p.track_name, p.album_name, MAX(p.album_image_url) AS album_image_url,
      COUNT(*) AS plays, COALESCE(SUM(COALESCE(p.ms_played, p.duration_ms, 0)), 0) AS listening_ms
    FROM plays p
    WHERE p.played_at >= ? AND p.played_at < ?
      AND NOT EXISTS (SELECT 1 FROM plays old WHERE old.track_key = p.track_key AND old.played_at < ?)
    GROUP BY p.track_key, p.track_name, p.album_name
    ORDER BY plays DESC, listening_ms DESC, p.track_name COLLATE NOCASE ASC
    LIMIT ${safeLimit(limit)}
  `;
}

function peakDaySql() {
  return `
    SELECT date(played_at, '${LOCAL_TIME_MODIFIER}') AS local_date, COUNT(*) AS plays,
      COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0) AS listening_ms
    FROM plays
    WHERE played_at >= ? AND played_at < ?
    GROUP BY local_date
    ORDER BY plays DESC, local_date ASC
    LIMIT 1
  `;
}

function peakHourSql() {
  return `
    SELECT strftime('%H', played_at, '${LOCAL_TIME_MODIFIER}') AS local_hour, COUNT(*) AS plays
    FROM plays
    WHERE played_at >= ? AND played_at < ?
    GROUP BY local_hour
    ORDER BY plays DESC, local_hour ASC
    LIMIT 1
  `;
}

function listeningDaysSql() {
  return `
    SELECT DISTINCT date(played_at, '${LOCAL_TIME_MODIFIER}') AS local_date
    FROM plays
    WHERE played_at >= ? AND played_at < ?
    ORDER BY local_date ASC
  `;
}

function lateNightSql() {
  return `
    SELECT COUNT(*) AS total_plays,
      SUM(CASE WHEN CAST(strftime('%H', played_at, '${LOCAL_TIME_MODIFIER}') AS INTEGER) >= ${LATE_NIGHT_START_HOUR}
        OR CAST(strftime('%H', played_at, '${LOCAL_TIME_MODIFIER}') AS INTEGER) < ${LATE_NIGHT_END_HOUR} THEN 1 ELSE 0 END) AS late_night_plays
    FROM plays
    WHERE played_at >= ? AND played_at < ?
  `;
}

function safeLimit(limit) {
  const number = Number(limit);
  if (!Number.isInteger(number) || number < 1 || number > MAX_TOP_LIMIT) {
    throw new Error(`Recap limit must be an integer between 1 and ${MAX_TOP_LIMIT}.`);
  }
  return number;
}

import { formatCount } from './number.js';
import { MS_PER_DAY, MS_PER_MINUTE, formatMinutes } from './time.js';

// Every metric a widget slot can show. `queries` names the result sets it reads (see
// widget-metrics-query.js) so a sync only runs the queries the chosen slots need.
// `name` and `group` are zh-TW admin-page copy (English in METRIC_NAMES_EN and
// GROUP_NAMES_EN); `label` is the default widget label and is never translated
// (Discord shows it).

const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY = '—';

export const METRIC_GROUPS = ['數量', '時間', '排行', '習慣', '探索', '連續紀錄', '里程碑'];

// ---- English admin-page copy (metric dropdown in the admin page's slot rows) ----
// zh-TW names live in METRICS below; these are the English names for the same ids.
export const GROUP_NAMES_EN = {
  數量: 'Counts',
  時間: 'Time',
  排行: 'Top lists',
  習慣: 'Habits',
  探索: 'Discovery',
  連續紀錄: 'Streaks',
  里程碑: 'Milestones'
};

export const METRIC_NAMES_EN = {
  songsPlayed: 'Play count',
  uniqueSongs: 'Unique songs',
  differentArtists: 'Different artists',
  differentAlbums: 'Different albums',
  listeningMinutes: 'Listening time (minutes)',
  listeningHours: 'Listening time (hours)',
  dailyMinutes: 'Average daily listening time',
  dailyPlays: 'Average daily plays',
  averageTrackLength: 'Average track length',
  topTrack: 'Top song',
  topTrackWithArtist: 'Top song (with artist)',
  topTrackPlays: 'Top song plays',
  topArtist: 'Top artist',
  topArtistPlays: 'Top artist plays',
  topAlbum: 'Top album',
  topAlbumPlays: 'Top album plays',
  peakHour: 'Peak listening hour',
  peakWeekday: 'Peak listening weekday',
  listeningDays: 'Days with listening',
  busiestDay: 'Busiest day (date and plays)',
  busiestDayPlays: 'Most plays in a day',
  lateNightShare: 'Late-night share (00–05)',
  newSongs: 'New songs (first play)',
  newArtists: 'New artists (first play)',
  repeatRate: 'Repeat rate',
  currentStreak: 'Current listening streak',
  longestStreak: 'Longest listening streak',
  daysSinceFirstPlay: 'Days since first play (ignores range)'
};

export const METRICS = {
  songsPlayed: {
    group: '數量', name: '播放次數', label: 'Total Songs Played', queries: ['summary'],
    format: (r) => formatCount(r.summary.songsPlayed)
  },
  uniqueSongs: {
    group: '數量', name: '不重複歌曲數', label: 'Unique Songs', queries: ['summary'],
    format: (r) => formatCount(r.summary.uniqueSongs)
  },
  differentArtists: {
    group: '數量', name: '歌手數', label: 'Different Artists', queries: ['artistCount'],
    format: (r) => formatCount(r.artistCount.differentArtists)
  },
  differentAlbums: {
    group: '數量', name: '專輯數', label: 'Different Albums', queries: ['summary'],
    format: (r) => formatCount(r.summary.differentAlbums)
  },
  listeningMinutes: {
    group: '時間', name: '聽歌時間（分鐘）', label: 'Total Listening Time', queries: ['summary'],
    format: (r) => formatMinutes(r.summary.listeningMs)
  },
  listeningHours: {
    group: '時間', name: '聽歌時間（小時）', label: 'Listening Hours', queries: ['summary'],
    format: (r) => `${formatCount(Math.round(r.summary.listeningMs / MS_PER_HOUR))} hours`
  },
  dailyMinutes: {
    group: '時間', name: '每天平均聽歌時間', label: 'Daily Listening', queries: ['summary'],
    format: (r, ctx) =>
      `${formatCount(Math.round(r.summary.listeningMs / MS_PER_MINUTE / rangeDayCount(ctx)))} min/day`
  },
  dailyPlays: {
    group: '時間', name: '每天平均播放次數', label: 'Daily Plays', queries: ['summary'],
    format: (r, ctx) => `${oneDecimal(r.summary.songsPlayed / rangeDayCount(ctx))} plays/day`
  },
  averageTrackLength: {
    group: '時間', name: '平均每首長度', label: 'Avg Track Length', queries: ['summary'],
    format: (r) => formatDuration(r.summary.songsPlayed ? r.summary.listeningMs / r.summary.songsPlayed : 0)
  },
  topTrack: {
    group: '排行', name: '最常聽的歌', label: 'Top Song', queries: ['topTrack'],
    format: (r) => r.topTrack?.name ?? EMPTY
  },
  topTrackWithArtist: {
    group: '排行', name: '最常聽的歌（含歌手）', label: 'Top Song', queries: ['topTrack'],
    format: (r) => (r.topTrack ? joinNonEmpty([r.topTrack.name, r.topTrack.artists], ' — ') : EMPTY)
  },
  topTrackPlays: {
    group: '排行', name: '最常聽的歌 播放次數', label: 'Top Song Plays', queries: ['topTrack'],
    format: (r) => formatCount(r.topTrack?.plays ?? 0)
  },
  topArtist: {
    group: '排行', name: '最常聽的歌手', label: 'Top Artist', queries: ['topArtist'],
    format: (r) => r.topArtist?.name ?? EMPTY
  },
  topArtistPlays: {
    group: '排行', name: '最常聽的歌手 播放次數', label: 'Top Artist Plays', queries: ['topArtist'],
    format: (r) => formatCount(r.topArtist?.plays ?? 0)
  },
  topAlbum: {
    group: '排行', name: '最常聽的專輯', label: 'Top Album', queries: ['topAlbum'],
    format: (r) => r.topAlbum?.name ?? 'unknown'
  },
  topAlbumPlays: {
    group: '排行', name: '最常聽的專輯 播放次數', label: 'Top Album Plays', queries: ['topAlbum'],
    format: (r) => formatCount(r.topAlbum?.plays ?? 0)
  },
  peakHour: {
    group: '習慣', name: '最常聽歌的時段', label: 'Peak Hour', queries: ['peakHour'],
    format: (r) => (r.peakHour ? `${String(r.peakHour.hour).padStart(2, '0')}:00` : EMPTY)
  },
  peakWeekday: {
    group: '習慣', name: '最常聽歌的星期', label: 'Peak Day', queries: ['peakWeekday'],
    format: (r) => (r.peakWeekday ? WEEKDAYS[r.peakWeekday.weekday] : EMPTY)
  },
  listeningDays: {
    group: '習慣', name: '有聽歌的天數', label: 'Listening Days', queries: ['listeningDays'],
    format: (r) => formatCount(r.listeningDays.dates.length)
  },
  busiestDay: {
    group: '習慣', name: '單日最高播放（日期與次數）', label: 'Busiest Day', queries: ['busiestDay'],
    format: (r) => (r.busiestDay ? `${slashDate(r.busiestDay.date)} (${formatCount(r.busiestDay.plays)})` : EMPTY)
  },
  busiestDayPlays: {
    group: '習慣', name: '單日最高播放次數', label: 'Most Plays in a Day', queries: ['busiestDay'],
    format: (r) => formatCount(r.busiestDay?.plays ?? 0)
  },
  lateNightShare: {
    group: '習慣', name: '深夜聽歌比例（0–5 點）', label: 'Late Night', queries: ['lateNight'],
    format: (r) => `${percent(r.lateNight.plays, r.lateNight.total)}%`
  },
  newSongs: {
    group: '探索', name: '新歌數（第一次聽）', label: 'New Songs', queries: ['newSongs'],
    format: (r) => formatCount(r.newSongs.count)
  },
  newArtists: {
    group: '探索', name: '新歌手數（第一次聽）', label: 'New Artists', queries: ['newArtists'],
    format: (r) => formatCount(r.newArtists.count)
  },
  repeatRate: {
    group: '探索', name: '重複播放率', label: 'Plays per Song', queries: ['summary'],
    format: (r) => `${oneDecimal(r.summary.uniqueSongs ? r.summary.songsPlayed / r.summary.uniqueSongs : 0)}x`
  },
  currentStreak: {
    group: '連續紀錄', name: '目前連續聽歌天數', label: 'Current Streak', queries: ['listeningDays'],
    format: (r, ctx) => days(currentStreak(r.listeningDays.dates, ctx.now))
  },
  longestStreak: {
    group: '連續紀錄', name: '最長連續聽歌天數', label: 'Longest Streak', queries: ['listeningDays'],
    format: (r) => days(longestStreak(r.listeningDays.dates))
  },
  daysSinceFirstPlay: {
    group: '里程碑', name: '開始記錄至今天數（不受區間影響）', label: 'Days Tracked', queries: ['firstPlay'],
    format: (r, ctx) =>
      r.firstPlay.playedAt ? days(Math.floor((ctx.now.getTime() - Date.parse(r.firstPlay.playedAt)) / MS_PER_DAY) + 1) : EMPTY
  }
};

export function isMetricId(id) {
  return Object.hasOwn(METRICS, id);
}

export function metricQueries(id) {
  return METRICS[id].queries;
}

// Admin-page copy for the slot dropdowns, in display order, in zh-TW and English.
export function metricCatalog() {
  return Object.entries(METRICS).map(([id, metric]) => ({
    id,
    group: metric.group,
    groupEn: GROUP_NAMES_EN[metric.group],
    name: metric.name,
    nameEn: METRIC_NAMES_EN[id],
    label: metric.label
  }));
}

export function formatMetric(id, results, ctx) {
  return METRICS[id].format(results, ctx);
}

// Days covered by a range, used for per-day averages. All time counts from the first
// stored play, and never less than one day so averages stay finite.
export function rangeDayCount(ctx) {
  if (typeof ctx.days === 'number') {
    return ctx.days;
  }
  const span = ctx.now.getTime() - Date.parse(ctx.since);
  return Math.max(1, Math.ceil(span / MS_PER_DAY));
}

// `dates` are ascending local YYYY-MM-DD strings.
export function longestStreak(dates) {
  let best = 0;
  let current = 0;
  let previousMs = null;
  for (const date of dates) {
    const ms = dateMs(date);
    current = previousMs === ms - MS_PER_DAY ? current + 1 : 1;
    best = Math.max(best, current);
    previousMs = ms;
  }
  return best;
}

// A streak is still alive if the last listening day is today or yesterday (Taipei).
export function currentStreak(dates, now) {
  if (dates.length === 0) {
    return 0;
  }
  const todayMs = dateMs(localDate(now));
  let expectedMs = dateMs(dates.at(-1));
  if (todayMs - expectedMs > MS_PER_DAY) {
    return 0;
  }

  let streak = 0;
  for (let index = dates.length - 1; index >= 0 && dateMs(dates[index]) === expectedMs; index -= 1) {
    streak += 1;
    expectedMs -= MS_PER_DAY;
  }
  return streak;
}

export function formatDuration(ms) {
  const totalSeconds = Math.round((Number(ms) || 0) / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function localDate(date) {
  const taipeiOffsetMs = 8 * MS_PER_HOUR;
  return new Date(date.getTime() + taipeiOffsetMs).toISOString().slice(0, 10);
}

function dateMs(date) {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function slashDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}/${month}/${day}`;
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function oneDecimal(value) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function days(count) {
  return `${formatCount(count)} ${count === 1 ? 'day' : 'days'}`;
}

function joinNonEmpty(parts, separator) {
  return parts.filter((part) => part).join(separator);
}

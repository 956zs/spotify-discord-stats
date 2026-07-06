const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const TAIWAN_LOCALE = 'zh-TW';

export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
export const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * MS_PER_MINUTE;

export function nowIso(date = new Date()) {
  return date.toISOString();
}

export function isoToMs(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function sinceIso(days, nowMs = Date.now()) {
  return new Date(nowMs - days * MS_PER_DAY).toISOString();
}

export function formatMinutes(ms) {
  if (!ms || ms < 0) {
    return '0 minutes';
  }
  return `${Math.round(ms / MS_PER_MINUTE)} minutes`;
}

export function formatLocalUpdatedAt(date = new Date()) {
  const formatter = new Intl.DateTimeFormat(TAIWAN_LOCALE, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TAIPEI_TIME_ZONE
  });
  return formatter.format(date);
}

export function formatLocalDate(date) {
  const formatter = new Intl.DateTimeFormat(TAIWAN_LOCALE, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: TAIPEI_TIME_ZONE
  });
  return formatter.format(date);
}

export function formatDateRange(startIso, endDate = new Date()) {
  return `${formatLocalDate(new Date(startIso))} ~ ${formatLocalDate(endDate)}`;
}

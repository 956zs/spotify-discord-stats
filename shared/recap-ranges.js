import { MS_PER_DAY } from './time.js';

const TAIPEI_OFFSET_HOURS = 8;
const MS_PER_HOUR = 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = TAIPEI_OFFSET_HOURS * MS_PER_HOUR;
const WEEK_DAYS = 7;
const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export const RECAP_TIME_ZONE = 'Asia/Taipei';

export function weeklyRecapRange(now = new Date()) {
  const endMs = now.getTime();
  const startMs = endMs - WEEK_DAYS * MS_PER_DAY;
  return buildRange('weekly', startMs, endMs, startMs - WEEK_DAYS * MS_PER_DAY, startMs);
}

export function previousMonthRecapRange(now = new Date()) {
  const local = toTaipeiDate(now);
  return monthRange(local.getUTCFullYear(), local.getUTCMonth() - 1);
}

export function monthRecapRange(yearMonth) {
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) {
    throw new Error('Month must use YYYY-MM format.');
  }

  const [year, month] = yearMonth.split('-').map(Number);
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 01 and 12.');
  }
  return monthRange(year, month - 1);
}

function monthRange(year, monthIndex) {
  const startMs = localMonthStartUtcMs(year, monthIndex);
  const endMs = localMonthStartUtcMs(year, monthIndex + 1);
  const previousStartMs = localMonthStartUtcMs(year, monthIndex - 1);
  return buildRange('monthly', startMs, endMs, previousStartMs, startMs);
}

function buildRange(kind, startMs, endMs, previousStartMs, previousEndMs) {
  return {
    kind,
    timeZone: RECAP_TIME_ZONE,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    previousStart: new Date(previousStartMs).toISOString(),
    previousEnd: new Date(previousEndMs).toISOString()
  };
}

function localMonthStartUtcMs(year, monthIndex) {
  return Date.UTC(year, monthIndex, 1) - TAIPEI_OFFSET_MS;
}

function toTaipeiDate(date) {
  return new Date(date.getTime() + TAIPEI_OFFSET_MS);
}

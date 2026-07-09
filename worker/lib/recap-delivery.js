import { appConfig } from '../config.js';
import { renderRecapMessages } from '../../shared/recap-renderer.js';
import { getMonthRecapData, getMonthlyRecapData, getWeeklyRecapData } from './recap-data.js';
import { sendDiscordDmPayloads } from './discord.js';
import { getState, setState } from './state.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const TAIPEI_OFFSET_HOURS = 8;
const TAIPEI_OFFSET_MS = TAIPEI_OFFSET_HOURS * MS_PER_HOUR;
const WEEKLY_REPORT = 'weekly';
const MONTHLY_REPORT = 'monthly';

export async function runDueRecapReports(env, now = new Date()) {
  if (!appConfig.recapReports?.enabled) {
    return { sent: 0, skipped: true, reason: 'disabled', results: [] };
  }

  const due = dueReportKinds(now);
  const results = [];
  for (const kind of due) {
    results.push(await sendScheduledRecap(env, kind, now));
  }
  return { sent: results.filter((result) => result.sent).length, results };
}

export async function sendWeeklyRecap(env, now = new Date()) {
  return sendRecap(env, WEEKLY_REPORT, await getWeeklyRecapData(env.DB, now));
}

export async function sendMonthlyRecap(env, options = {}) {
  const recap = options.month
    ? await getMonthRecapData(env.DB, options.month)
    : await getMonthlyRecapData(env.DB, options.now ?? new Date());
  return sendRecap(env, MONTHLY_REPORT, recap);
}

async function sendScheduledRecap(env, kind, now) {
  const recap = kind === WEEKLY_REPORT
    ? await getWeeklyRecapData(env.DB, now)
    : await getMonthlyRecapData(env.DB, now);
  const stateKey = sentStateKey(kind, recap.range);
  if (await getState(env.DB, stateKey)) {
    return { sent: false, kind, reason: 'already_sent', stateKey };
  }

  const result = await sendRecap(env, kind, recap);
  await setState(env.DB, stateKey, new Date().toISOString());
  return { ...result, stateKey };
}

async function sendRecap(env, kind, recap) {
  const messages = renderRecapMessages(recap, { title: recapTitle(kind) });
  await sendDiscordDmPayloads(env, messages);
  return { sent: true, kind, messages: messages.length, range: recap.range };
}

function dueReportKinds(now) {
  const parts = taipeiParts(now);
  const due = [];
  if (isDueTime(parts) && parts.weekday === appConfig.recapReports.weeklyDay) {
    due.push(WEEKLY_REPORT);
  }
  if (isDueTime(parts) && parts.day === appConfig.recapReports.monthlyDay) {
    due.push(MONTHLY_REPORT);
  }
  return due;
}

function isDueTime(parts) {
  return parts.hour === appConfig.recapReports.sendHour
    && parts.minute === appConfig.recapReports.sendMinute;
}

function taipeiParts(date) {
  const local = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return {
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    weekday: local.getUTCDay()
  };
}

function sentStateKey(kind, range) {
  return `recap_sent:${kind}:${range.start}:${range.end}`;
}

function recapTitle(kind) {
  return kind === MONTHLY_REPORT ? '✦ Monthly Recap' : '✦ Weekly Recap';
}

import { appConfig } from './config.js';
import { requireAdminToken } from './lib/env.js';
import { json } from './lib/http.js';
import { startSpotifyLogin, handleSpotifyCallback } from './lib/oauth.js';
import { runDueRecapReports, sendMonthlyRecap, sendWeeklyRecap } from './lib/recap-delivery.js';
import { runSpotifyReauthReminder } from './lib/reminder.js';
import { syncOnce } from './lib/sync.js';
import { getStatsRanges, getWidgetStats } from './lib/stats.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  if (url.pathname === '/spotify/login') {
    requireAdminToken(url, env);
    return startSpotifyLogin(env);
  }

  if (url.pathname === '/spotify/callback') {
    return handleSpotifyCallback(url, env);
  }

  if (url.pathname === '/admin/sync') {
    requireAdminToken(url, env);
    return json(await syncOnce(env, { forcePatch: true, includeStatsRanges: true }));
  }

  if (url.pathname === '/admin/stats') {
    requireAdminToken(url, env);
    const stats = await getWidgetStats(env.DB, appConfig.statsDays);
    const statsRanges = await getStatsRanges(env.DB, appConfig.statsRangeDays);
    return json({ ...stats, statsRanges });
  }

  if (url.pathname === '/admin/recap/weekly/send') {
    requirePost(request);
    requireAdminToken(url, env);
    return json(await sendWeeklyRecap(env));
  }

  if (url.pathname === '/admin/recap/monthly/send') {
    requirePost(request);
    requireAdminToken(url, env);
    return json(await sendMonthlyRecap(env, { month: url.searchParams.get('month') }));
  }

  return json({ error: 'not found' }, 404);
}

export async function handleScheduled(env, now = new Date()) {
  const result = await syncOnce(env);
  console.log('scheduled sync', result);

  try {
    const reminder = await runSpotifyReauthReminder(env);
    console.log('reauth reminder', reminder);
  } catch (error) {
    console.warn('reauth reminder failed', error.message);
  }

  const recap = await runDueRecapReports(env, now);
  console.log('recap reports', recap);
}

function requirePost(request) {
  if (request.method !== 'POST') {
    const error = new Error('method not allowed');
    error.status = 405;
    throw error;
  }
}

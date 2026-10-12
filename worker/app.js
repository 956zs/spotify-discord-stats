import { appConfig, widgetConfig } from './config.js';
import { MS_PER_DAY } from '../shared/time.js';
import {
  checkAdminToken,
  clearSessionCookie,
  createSessionCookie,
  isAdminRequest,
  requireAdmin,
  requireSameOrigin,
  requireSameOriginJson
} from './lib/admin-auth.js';
import { adminPageResponse, loginPageResponse } from './lib/admin-page.js';
import { HttpError, json } from './lib/http.js';
import { startSpotifyLogin, handleSpotifyCallback } from './lib/oauth.js';
import { runDueRecapReports, sendMonthlyRecap, sendWeeklyRecap } from './lib/recap-delivery.js';
import { runSpotifyReauthReminder } from './lib/reminder.js';
import { getDefaultSettings, loadSettings, parseSettingsInput, saveSettings } from './lib/settings.js';
import { getSpotifyRefreshTokenIssuedAt } from './lib/spotify.js';
import { getState } from './lib/state.js';
import { syncOnce } from './lib/sync.js';
import { getStatsRanges, getWidgetStats } from './lib/stats.js';
import { buildWidgetPayload } from './lib/widget.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  if (url.pathname === '/spotify/login') {
    await requireAdmin(request, url, env);
    return startSpotifyLogin(env);
  }

  if (url.pathname === '/spotify/callback') {
    return handleSpotifyCallback(url, env);
  }

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    return (await isAdminRequest(request, url, env)) ? adminPageResponse() : loginPageResponse();
  }

  if (url.pathname === '/admin/login') {
    return handleLogin(request, url, env);
  }

  if (url.pathname === '/admin/logout') {
    requirePost(request);
    return redirect('/admin', clearSessionCookie());
  }

  if (url.pathname.startsWith('/admin/api/')) {
    await requireAdmin(request, url, env);
    return handleAdminApi(request, url, env);
  }

  if (url.pathname === '/admin/sync') {
    await requireAdmin(request, url, env);
    return json(await syncOnce(env, { forcePatch: true, refreshStats: true, includeStatsRanges: true }));
  }

  if (url.pathname === '/admin/stats') {
    await requireAdmin(request, url, env);
    const settings = await loadSettings(env.DB);
    const stats = await getWidgetStats(env.DB, settings.statsDays);
    const statsRanges = await getStatsRanges(env.DB, appConfig.statsRangeDays);
    return json({ ...stats, statsRanges });
  }

  if (url.pathname === '/admin/recap/weekly/send') {
    requirePost(request);
    await requireAdmin(request, url, env);
    return json(await sendWeeklyRecap(env));
  }

  if (url.pathname === '/admin/recap/monthly/send') {
    requirePost(request);
    await requireAdmin(request, url, env);
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

async function handleLogin(request, url, env) {
  requirePost(request);
  requireSameOrigin(request, url);

  const form = await request.formData();
  if (!checkAdminToken(form.get('token'), env)) {
    return loginPageResponse(401, true);
  }
  return redirect('/admin', await createSessionCookie(env));
}

async function handleAdminApi(request, url, env) {
  if (url.pathname === '/admin/api/state' && request.method === 'GET') {
    const settings = await loadSettings(env.DB);
    const stats = await getWidgetStats(env.DB, settings.statsDays);
    return json({
      settings,
      defaults: getDefaultSettings(),
      payload: buildWidgetPayload(stats, settings),
      fields: widgetConfig.fields,
      status: await adminStatus(env)
    });
  }

  requirePost(request);
  requireSameOriginJson(request, url);
  const body = await readJson(request);

  if (url.pathname === '/admin/api/preview') {
    const settings = parseSettingsInput(body.settings);
    const stats = await getWidgetStats(env.DB, settings.statsDays);
    return json({ payload: buildWidgetPayload(stats, settings), fields: widgetConfig.fields });
  }

  if (url.pathname === '/admin/api/settings') {
    return json({ settings: await saveSettings(env.DB, body.settings) });
  }

  if (url.pathname === '/admin/api/push') {
    return json(await syncOnce(env, { forcePatch: true, refreshStats: true }));
  }

  return json({ error: 'not found' }, 404);
}

async function adminStatus(env) {
  const issuedAt = await getSpotifyRefreshTokenIssuedAt(env);
  let tokenDaysLeft = null;
  if (issuedAt && !Number.isNaN(Date.parse(issuedAt))) {
    const expiresAt = Date.parse(issuedAt) + appConfig.spotifyRefreshTokenValidDays * MS_PER_DAY;
    tokenDaysLeft = `${Math.ceil((expiresAt - Date.now()) / MS_PER_DAY)} 天`;
  }

  return [
    ['Spotify 授權剩餘', tokenDaysLeft],
    ['Spotify 授權時間', issuedAt],
    ['上次推送 Discord', await getState(env.DB, 'discord_widget_last_patched_at')]
  ];
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body ?? {};
  } catch {
    throw new HttpError('invalid JSON body', 400);
  }
}

function redirect(location, cookie) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' }
  });
}

function requirePost(request) {
  if (request.method !== 'POST') {
    const error = new Error('method not allowed');
    error.status = 405;
    throw error;
  }
}

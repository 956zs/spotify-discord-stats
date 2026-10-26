import { appConfig, widgetConfig } from './config.js';
import { MS_PER_DAY } from '../shared/time.js';
import { HERO_IMAGE_PATH } from '../shared/widget-hero.js';
import { metricCatalog } from '../shared/widget-metrics.js';
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
import { publicBaseUrl } from './lib/env.js';
import { HttpError, json } from './lib/http.js';
import { startSpotifyLogin, handleSpotifyCallback } from './lib/oauth.js';
import { runDueRecapReports, sendMonthlyRecap, sendWeeklyRecap } from './lib/recap-delivery.js';
import { runSpotifyReauthReminder } from './lib/reminder.js';
import { getDefaultSettings, loadSettings, parseSettingsInput, saveSettings } from './lib/settings.js';
import { getSpotifyRefreshTokenIssuedAt } from './lib/spotify.js';
import { getState } from './lib/state.js';
import { syncOnce } from './lib/sync.js';
import { getStats, getStatsRanges, getWidgetData } from './lib/stats.js';
import { buildWidgetPayload } from './lib/widget.js';
import {
  HERO_IMAGE_KEY,
  deleteWidgetImage,
  getWidgetImageMeta,
  readImageUpload,
  saveWidgetImage,
  widgetImageResponse
} from './lib/widget-images.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  // Public: Discord's media proxy fetches the uploaded hero image from here.
  if (url.pathname === HERO_IMAGE_PATH) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new HttpError('method not allowed', 405);
    }
    return widgetImageResponse(env.DB, HERO_IMAGE_KEY, request);
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
    const stats = await getStats(env.DB, settings.statsDays);
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
  // A failed sync (e.g. Spotify is down or needs reauthorizing) must not skip the reminder and recaps;
  // it is rethrown at the end so the cron run still shows as failed.
  let syncError = null;
  try {
    const result = await syncOnce(env);
    console.log('scheduled sync', result);
  } catch (error) {
    syncError = error;
    console.warn('scheduled sync failed', error.message);
  }

  try {
    const reminder = await runSpotifyReauthReminder(env);
    console.log('reauth reminder', reminder);
  } catch (error) {
    console.warn('reauth reminder failed', error.message);
  }

  const recap = await runDueRecapReports(env, now);
  console.log('recap reports', recap);

  if (syncError) {
    throw syncError;
  }
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
    const data = await getWidgetData(env.DB, settings, { publicBaseUrl: publicBaseUrl(env) });
    return json({
      settings,
      defaults: getDefaultSettings(),
      payload: buildWidgetPayload(data, settings),
      fields: widgetConfig.fields,
      metrics: metricCatalog(),
      heroImage: await heroImageState(env),
      status: await adminStatus(env)
    });
  }

  requirePost(request);

  // Raw image body, so it skips the JSON-only guard but keeps the same-origin checks.
  // An image Content-Type is not CORS-safelisted, so cross-site pages also need a preflight.
  if (url.pathname === '/admin/api/hero-image') {
    requireSameOrigin(request, url);
    const image = await readImageUpload(request);
    await saveWidgetImage(env.DB, HERO_IMAGE_KEY, image);
    return json({ heroImage: await heroImageState(env) });
  }

  requireSameOriginJson(request, url);
  const body = await readJson(request);

  if (url.pathname === '/admin/api/hero-image/delete') {
    const { deleted } = await deleteWidgetImage(env.DB, HERO_IMAGE_KEY);
    return json({ deleted, heroImage: await heroImageState(env) });
  }

  if (url.pathname === '/admin/api/preview') {
    const settings = parseSettingsInput(body.settings);
    const data = await getWidgetData(env.DB, settings, { publicBaseUrl: publicBaseUrl(env) });
    return json({ payload: buildWidgetPayload(data, settings), fields: widgetConfig.fields });
  }

  if (url.pathname === '/admin/api/settings') {
    return json({ settings: await saveSettings(env.DB, body.settings) });
  }

  if (url.pathname === '/admin/api/push') {
    return json(await syncOnce(env, { forcePatch: true, refreshStats: true }));
  }

  return json({ error: 'not found' }, 404);
}

async function heroImageState(env) {
  return {
    upload: await getWidgetImageMeta(env.DB, HERO_IMAGE_KEY),
    publicBaseUrl: publicBaseUrl(env)
  };
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

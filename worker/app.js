import { appConfig, widgetConfig } from './config.js';
import { RECAP_TIME_ZONE } from '../shared/recap-ranges.js';
import { MS_PER_DAY } from '../shared/time.js';
import { HERO_ALBUM, HERO_IMAGE_PATH, resolveHeroImageUrl } from '../shared/widget-hero.js';
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
import { pickLanguage } from './lib/admin/i18n.js';
import { publicBaseUrl } from './lib/env.js';
import { HERO_TEMPLATE_PATH, heroTemplateResponse } from './lib/hero-template.js';
import { ERROR_CODES, HttpError, json } from './lib/http.js';
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
      throw new HttpError('method not allowed', 405, ERROR_CODES.methodNotAllowed);
    }
    return widgetImageResponse(env.DB, HERO_IMAGE_KEY, request);
  }

  // Public: the hero size template is just a guide image, no secrets.
  if (url.pathname === HERO_TEMPLATE_PATH) {
    return heroTemplateResponse(request);
  }

  if (url.pathname === '/spotify/login') {
    await requireAdmin(request, url, env);
    return startSpotifyLogin(env);
  }

  if (url.pathname === '/spotify/callback') {
    return handleSpotifyCallback(url, env);
  }

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    const lang = pickLanguage(request.headers.get('Accept-Language'));
    return (await isAdminRequest(request, url, env)) ? adminPageResponse(lang) : loginPageResponse(200, false, lang);
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

  return json({ error: 'not found', code: ERROR_CODES.notFound }, 404);
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
    return loginPageResponse(401, true, pickLanguage(request.headers.get('Accept-Language')));
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
      albumImageUrl: albumImageUrl(data),
      // Public application id, used to link to this app's widget editor.
      discordClientId: env.DISCORD_CLIENT_ID || null,
      recapSchedule: recapSchedule(),
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
    return json({
      payload: buildWidgetPayload(data, settings),
      fields: widgetConfig.fields,
      albumImageUrl: albumImageUrl(data)
    });
  }

  if (url.pathname === '/admin/api/settings') {
    return json({ settings: await saveSettings(env.DB, body.settings) });
  }

  if (url.pathname === '/admin/api/push') {
    return json(await syncOnce(env, { forcePatch: true, refreshStats: true }));
  }

  return json({ error: 'not found', code: ERROR_CODES.notFound }, 404);
}

async function heroImageState(env) {
  return {
    upload: await getWidgetImageMeta(env.DB, HERO_IMAGE_KEY),
    publicBaseUrl: publicBaseUrl(env)
  };
}

// Album artwork of the last played song (https only, as Discord needs), for the
// album mode card on the admin page.
function albumImageUrl(data) {
  return resolveHeroImageUrl(HERO_ALBUM, { lastPlayed: data.lastPlayed });
}

function recapSchedule() {
  const recap = appConfig.recapReports;
  return {
    weeklyDay: recap.weeklyDay,
    monthlyDay: recap.monthlyDay,
    hour: recap.sendHour,
    minute: recap.sendMinute,
    timeZone: RECAP_TIME_ZONE
  };
}

// Raw values only; the admin page formats and translates them.
export async function adminStatus(env, now = Date.now()) {
  const authorizedAt = await getSpotifyRefreshTokenIssuedAt(env);
  const validDays = appConfig.spotifyRefreshTokenValidDays;
  let expiresAt = null;
  let daysLeft = null;
  if (authorizedAt && !Number.isNaN(Date.parse(authorizedAt))) {
    const expiresMs = Date.parse(authorizedAt) + validDays * MS_PER_DAY;
    expiresAt = new Date(expiresMs).toISOString();
    daysLeft = Math.ceil((expiresMs - now) / MS_PER_DAY);
  }

  return {
    spotify: {
      authorizedAt: authorizedAt || null,
      expiresAt,
      daysLeft,
      validDays,
      remindDays: appConfig.spotifyReauthRemindDays
    },
    discord: {
      lastPushedAt: (await getState(env.DB, 'discord_widget_last_patched_at')) || null
    }
  };
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body ?? {};
  } catch {
    throw new HttpError('invalid JSON body', 400, ERROR_CODES.invalidJson);
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
    throw new HttpError('method not allowed', 405, ERROR_CODES.methodNotAllowed);
  }
}

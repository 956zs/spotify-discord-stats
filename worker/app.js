import { appConfig } from './config.js';
import { requireAdminToken } from './lib/env.js';
import { json } from './lib/http.js';
import { startSpotifyLogin, handleSpotifyCallback } from './lib/oauth.js';
import { runSpotifyReauthReminder } from './lib/reminder.js';
import { syncOnce } from './lib/sync.js';
import { getStats } from './lib/stats.js';

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
    return json(await syncOnce(env, { forcePatch: true }));
  }

  if (url.pathname === '/admin/stats') {
    requireAdminToken(url, env);
    return json(await getStats(env.DB, appConfig.statsDays));
  }

  return json({ error: 'not found' }, 404);
}

export async function handleScheduled(env) {
  const result = await syncOnce(env);
  console.log('scheduled sync', result);

  try {
    const reminder = await runSpotifyReauthReminder(env);
    console.log('reauth reminder', reminder);
  } catch (error) {
    console.warn('reauth reminder failed', error.message);
  }
}

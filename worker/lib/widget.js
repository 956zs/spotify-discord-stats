import { appConfig, widgetConfig } from '../config.js';
import { buildWidgetPayload as buildPayload } from '../../shared/widget-payload.js';
import { discordFetch } from './discord.js';
import { requiredEnv } from './env.js';
import { sha256 } from './crypto.js';
import { getState, setState } from './state.js';

export function buildWidgetPayload(stats, settings, now = new Date()) {
  return buildPayload(stats, settings.widget, widgetConfig.fields, now);
}

export async function patchDiscordWidget(env, stats, settings, options = {}) {
  const payload = buildWidgetPayload(stats, settings);
  const hash = await sha256(JSON.stringify(payload));

  if (await shouldSkipPatch(env.DB, hash, options)) {
    return { patched: false, skipped: true, reason: 'unchanged' };
  }

  const applicationId = requiredEnv(env, 'DISCORD_CLIENT_ID');
  const discordUserId = requiredEnv(env, 'DISCORD_USER_ID');
  const identityId = env.DISCORD_IDENTITY_ID || '0';
  const response = await discordFetch(
    env,
    `/applications/${applicationId}/users/${discordUserId}/identities/${identityId}/profile`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord widget PATCH failed ${response.status}: ${text}`);
  }

  await setState(env.DB, 'discord_widget_payload_hash', hash);
  await setState(env.DB, 'discord_widget_last_patched_at', new Date().toISOString());
  return { patched: true, skipped: false };
}

async function shouldSkipPatch(db, hash, options) {
  if (!appConfig.patchOnlyWhenChanged || options.force) {
    return false;
  }

  const previousHash = await getState(db, 'discord_widget_payload_hash');
  return previousHash === hash;
}

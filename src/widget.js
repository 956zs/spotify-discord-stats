import crypto from 'node:crypto';
import { appConfig, widgetConfig } from './config.js';
import { env, requiredEnv } from './env.js';
import { getState, setState } from './db.js';
import { getD1Compat, getLastPlayedSong } from './db.js';
import { buildWidgetPayload as buildPayload, collectWidgetData } from '../shared/widget-payload.js';
import { defaultSettings } from '../shared/widget-settings.js';

// The Node runtime has no admin page, so its settings are the config file defaults.
// It also cannot store or serve an uploaded hero image, so heroImage "upload" acts like
// "asset" here; "album" works because lastPlayed carries the album artwork.
export function getWidgetSettings() {
  return defaultSettings(appConfig, widgetConfig);
}

export async function getWidgetPayload(settings = getWidgetSettings(), now = new Date()) {
  const data = await collectWidgetData(getD1Compat(), settings, {
    now,
    lastPlayed: getLastPlayedSong()
  });
  return buildPayload(data, settings, widgetConfig.fields, now);
}

export async function patchDiscordWidget(payload, options = {}) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (appConfig.patchOnlyWhenChanged && !options.force) {
    const previousHash = getState('discord_widget_payload_hash');
    if (previousHash === hash) {
      return { patched: false, skipped: true, reason: 'unchanged' };
    }
  }

  const applicationId = requiredEnv('DISCORD_CLIENT_ID');
  const discordUserId = requiredEnv('DISCORD_USER_ID');
  const identityId = env('DISCORD_IDENTITY_ID', '0');
  const token = requiredEnv('DISCORD_TOKEN');

  const url = `https://discord.com/api/v9/applications/${applicationId}/users/${discordUserId}/identities/${identityId}/profile`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord widget PATCH failed ${response.status}: ${text}`);
  }

  setState('discord_widget_payload_hash', hash);
  setState('discord_widget_last_patched_at', new Date().toISOString());
  return { patched: true, skipped: false, response: text };
}

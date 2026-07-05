import crypto from 'node:crypto';
import { appConfig, widgetConfig } from './config.js';
import { env, requiredEnv } from './env.js';
import { getState, setState } from './db.js';
import { formatLocalUpdatedAt, formatMinutes } from './time.js';

export function buildWidgetPayload(stats) {
  const fields = widgetConfig.fields;
  const dynamic = [
    field(fields.topHeroTitle, widgetConfig.topHeroTitle),
    field(fields.during, widgetConfig.during),
    field(fields.lastUpdated, `${widgetConfig.lastUpdatedPrefix}${formatLocalUpdatedAt()}`),
    field(fields.mainTitle, widgetConfig.mainTitle),
    field(fields.songsPlayed, String(stats.songsPlayed)),
    field(fields.listeningTime, formatMinutes(stats.listeningMs)),
    field(fields.uniqueSongs, String(stats.uniqueSongs)),
    field(fields.differentArtists, String(stats.differentArtists)),
    field(fields.differentAlbums, String(stats.differentAlbums)),
    field(fields.mostListenedGenre, stats.mostListenedGenre)
  ];

  return {
    username: widgetConfig.username,
    data: { dynamic }
  };
}

function field(name, value) {
  if (!name) {
    throw new Error('Widget field name is missing. Check config/widget.json.');
  }
  return { type: 1, name, value };
}

export async function patchDiscordWidget(stats, options = {}) {
  const payload = buildWidgetPayload(stats);
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

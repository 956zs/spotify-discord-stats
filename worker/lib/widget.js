import { appConfig, widgetConfig } from '../config.js';
import { formatCount } from '../../shared/number.js';
import { formatDateRange, formatLocalUpdatedAt, formatMinutes } from '../../shared/time.js';
import { discordFetch } from './discord.js';
import { requiredEnv } from './env.js';
import { sha256 } from './crypto.js';
import { getState, setState } from './state.js';

export function buildWidgetPayload(stats) {
  const fields = widgetConfig.fields;
  const dynamic = [
    widgetField(fields.topHeroTitle, widgetConfig.topHeroTitle),
    widgetField(fields.during, formatDateRange(stats.since)),
    widgetField(fields.lastUpdated, `${widgetConfig.lastUpdatedPrefix}${formatLocalUpdatedAt()} (UTC +8)`),
    widgetField(fields.song, stats.lastPlayed.value),
    widgetField(fields.mainTitle, `${widgetConfig.mainTitle} ${formatCount(stats.songsPlayed)}`),
    widgetField(fields.songsPlayed, formatCount(stats.songsPlayed)),
    widgetField(fields.listeningTime, formatMinutes(stats.listeningMs)),
    widgetField(fields.uniqueSongs, formatCount(stats.uniqueSongs)),
    widgetField(fields.differentArtists, formatCount(stats.differentArtists)),
    widgetField(fields.differentAlbums, formatCount(stats.differentAlbums)),
    widgetField(fields.topAlbum, stats.topAlbum)
  ];

  return {
    username: widgetConfig.username,
    data: { dynamic }
  };
}

export async function patchDiscordWidget(env, stats, options = {}) {
  const payload = buildWidgetPayload(stats);
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

function widgetField(name, value) {
  if (!name) {
    throw new Error('Widget field name is missing. Check config/widget.json.');
  }
  return { type: 1, name, value };
}

async function shouldSkipPatch(db, hash, options) {
  if (!appConfig.patchOnlyWhenChanged || options.force) {
    return false;
  }

  const previousHash = await getState(db, 'discord_widget_payload_hash');
  return previousHash === hash;
}

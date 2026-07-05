import crypto from 'node:crypto';
import { env, envBool, requiredEnv } from './env.js';
import { getState, setState } from './db.js';
import { formatLocalUpdatedAt, formatMinutes } from './time.js';

export function buildWidgetPayload(stats) {
  const dynamic = [
    field(env('WIDGET_FIELD_MAIN_TITLE', 'main_title'), env('WIDGET_MAIN_TITLE', 'Last 4 Weeks Played:')),
    field(env('WIDGET_FIELD_SONGS_PLAYED', 'Songs_Played'), String(stats.songsPlayed)),
    field(env('WIDGET_FIELD_LISTENING_TIME', 'Listening_Time'), formatMinutes(stats.listeningMs)),
    field(env('WIDGET_FIELD_UNIQUE_SONGS', 'Unique_Songs'), String(stats.uniqueSongs)),
    field(env('WIDGET_FIELD_DIFFERENT_ARTISTS', 'Different_Artists'), String(stats.differentArtists)),
    field(env('WIDGET_FIELD_DIFFERENT_ALBUMS', 'Different_Albums'), String(stats.differentAlbums)),
    field(env('WIDGET_FIELD_MOST_LISTENED_GENRE', 'Most_Listened_Genre'), stats.mostListenedGenre)
  ];

  const lastUpdatedField = env('WIDGET_FIELD_LAST_UPDATED');
  if (lastUpdatedField) {
    dynamic.push(field(lastUpdatedField, formatLocalUpdatedAt()));
  }

  return {
    username: env('WIDGET_USERNAME', 'My Spotify Stats'),
    data: { dynamic }
  };
}

function field(name, value) {
  return { type: 1, name, value };
}

export async function patchDiscordWidget(stats, options = {}) {
  const payload = buildWidgetPayload(stats);
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (envBool('PATCH_ONLY_WHEN_CHANGED', true) && !options.force) {
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

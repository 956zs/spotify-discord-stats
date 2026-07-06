import { requiredEnv } from './env.js';

const DISCORD_API_URL = 'https://discord.com/api/v9';

export async function sendDiscordDm(env, content) {
  const userId = env.DISCORD_REMINDER_USER_ID || requiredEnv(env, 'DISCORD_USER_ID');
  const channelResponse = await discordFetch(env, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: userId })
  });

  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok) {
    throw new Error(`Discord create DM failed ${channelResponse.status}: ${JSON.stringify(channel)}`);
  }

  const messageResponse = await discordFetch(env, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });

  const message = await messageResponse.json().catch(() => ({}));
  if (!messageResponse.ok) {
    throw new Error(`Discord send DM failed ${messageResponse.status}: ${JSON.stringify(message)}`);
  }
}

export async function trySendDiscordDm(env, content) {
  try {
    await sendDiscordDm(env, content);
    return { sent: true };
  } catch (error) {
    console.warn('Discord DM failed', error.message);
    return { sent: false, error: error.message };
  }
}

export function discordFetch(env, path, init = {}) {
  return fetch(`${DISCORD_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${requiredEnv(env, 'DISCORD_TOKEN')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
      ...init.headers
    }
  });
}

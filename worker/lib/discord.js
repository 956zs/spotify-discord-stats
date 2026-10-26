import { requiredEnv } from './env.js';
import { ERROR_CODES, HttpError } from './http.js';

const DISCORD_API_URL = 'https://discord.com/api/v9';
const DISCORD_MESSAGE_API_URL = 'https://discord.com/api/v10';

export async function sendDiscordDm(env, content) {
  return sendDiscordDmPayload(env, { content });
}

export async function sendDiscordDmPayloads(env, payloads) {
  for (const payload of payloads) {
    await sendDiscordDmPayload(env, payload);
  }
  return { sent: true, messages: payloads.length };
}

export async function sendDiscordDmPayload(env, payload) {
  const channel = await createDiscordDmChannel(env);
  const messageResponse = await discordMessageFetch(env, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const message = await messageResponse.json().catch(() => ({}));
  if (!messageResponse.ok) {
    throw new HttpError(
      `Discord send DM failed ${messageResponse.status}: ${JSON.stringify(message)}`,
      500,
      ERROR_CODES.discordDmFailed
    );
  }
}

async function createDiscordDmChannel(env) {
  const userId = env.DISCORD_REMINDER_USER_ID || requiredEnv(env, 'DISCORD_USER_ID');
  const channelResponse = await discordMessageFetch(env, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: userId })
  });

  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok) {
    throw new HttpError(
      `Discord create DM failed ${channelResponse.status}: ${JSON.stringify(channel)}`,
      500,
      ERROR_CODES.discordDmFailed
    );
  }
  return channel;
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

function discordMessageFetch(env, path, init = {}) {
  return fetch(`${DISCORD_MESSAGE_API_URL}${path}`, {
    ...init,
    headers: discordHeaders(env, init.headers)
  });
}

function discordHeaders(env, headers = {}) {
  return {
    Authorization: `Bot ${requiredEnv(env, 'DISCORD_TOKEN')}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
    ...headers
  };
}

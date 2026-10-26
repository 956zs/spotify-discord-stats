import assert from 'node:assert/strict';
import test from 'node:test';
import { handleScheduled } from '../worker/app.js';
import { createD1, insertPlay } from './helpers/d1.js';

// Monday 09:00 Asia/Taipei, when the weekly recap is due.
const WEEKLY_RECAP_DUE = new Date('2026-10-26T01:00:00Z');

function createEnv(overrides = {}) {
  const db = createD1();
  insertPlay(db, '2026-10-24T12:00:00.000Z', 'track:a', ['artist:a'], { album: 'Album' });
  return {
    DB: db,
    DISCORD_TOKEN: 'discord-token',
    DISCORD_CLIENT_ID: '111',
    DISCORD_USER_ID: '222',
    SPOTIFY_CLIENT_ID: 'spotify-client',
    SPOTIFY_CLIENT_SECRET: 'spotify-secret',
    SPOTIFY_REDIRECT_URI: 'https://stats.example.test/spotify/callback',
    SPOTIFY_REFRESH_TOKEN: 'refresh-token',
    SPOTIFY_REFRESH_TOKEN_ISSUED_AT: '2026-10-01T00:00:00.000Z',
    ...overrides
  };
}

function mockFetch(t, { widgetStatus = 200 } = {}) {
  const dms = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://accounts.spotify.com/api/token') {
      return Response.json({ access_token: 'access-token', expires_in: 3600 });
    }
    if (url.startsWith('https://api.spotify.com/v1/me/player/recently-played')) {
      return Response.json({ items: [] });
    }
    if (url.endsWith('/profile') && init.method === 'PATCH') {
      return new Response(widgetStatus === 200 ? '{}' : '{"message":"Unknown Application"}', {
        status: widgetStatus
      });
    }
    if (url.endsWith('/users/@me/channels')) {
      return Response.json({ id: 'dm-channel' });
    }
    if (url.endsWith('/channels/dm-channel/messages')) {
      dms.push(JSON.parse(init.body));
      return Response.json({ id: String(dms.length) });
    }
    throw new Error(`unexpected fetch ${init.method ?? 'GET'} ${url}`);
  });
  return dms;
}

function weeklyRecapSent(dms) {
  return dms.some((payload) => JSON.stringify(payload).includes('Weekly Recap'));
}

test('scheduled run syncs, patches the widget, and sends the due recap', async (t) => {
  const dms = mockFetch(t);
  await handleScheduled(createEnv(), WEEKLY_RECAP_DUE);
  assert.ok(weeklyRecapSent(dms));
});

test('a failed widget patch does not block the due recap', async (t) => {
  const dms = mockFetch(t, { widgetStatus: 404 });
  await assert.rejects(handleScheduled(createEnv(), WEEKLY_RECAP_DUE), /Discord widget PATCH failed 404/);
  assert.ok(weeklyRecapSent(dms));
});

test('a failed Spotify sync does not block the due recap', async (t) => {
  const dms = mockFetch(t);
  const env = createEnv({ SPOTIFY_REFRESH_TOKEN: undefined });
  await assert.rejects(handleScheduled(env, WEEKLY_RECAP_DUE), /Missing Spotify refresh token/);
  assert.ok(weeklyRecapSent(dms));
});

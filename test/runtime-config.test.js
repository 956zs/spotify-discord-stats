import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest, handleScheduled } from '../worker/app.js';
import { ERROR_CODES } from '../worker/lib/http.js';
import {
  STATE_KEYS,
  parseSpotifyAppInput,
  rememberPublicOrigin,
  saveSpotifyApp,
  withRuntimeConfig
} from '../worker/lib/runtime-config.js';
import { getState, setState } from '../worker/lib/state.js';
import { createD1 } from './helpers/d1.js';

const ORIGIN = 'https://stats.example.test';
const ADMIN_TOKEN = 'test-admin-token-123';
const CLIENT_ID = '0123456789abcdef0123456789abcdef';
const CLIENT_SECRET = 'fedcba9876543210fedcba9876543210';

function createEnv(extra = {}) {
  return { DB: createD1(), ADMIN_TOKEN, DISCORD_TOKEN: 'bot-token-1', ...extra };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(t, handler) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    return handler(url, init);
  });
  return calls;
}

function discordApp(owner = { id: '42' }, extra = {}) {
  return jsonResponse({ id: '1001', owner, ...extra });
}

async function login(env) {
  const response = await handleRequest(
    new Request(`${ORIGIN}/admin/login`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: new URLSearchParams({ token: ADMIN_TOKEN })
    }),
    env
  );
  return response.headers.get('Set-Cookie').split(';')[0];
}

function adminPost(pathname, body, cookie) {
  return new Request(`${ORIGIN}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(body)
  });
}

test('values set in Cloudflare win and skip the Discord lookup', async (t) => {
  const calls = mockFetch(t, () => {
    throw new Error('no fetch expected');
  });
  const env = createEnv({
    DISCORD_CLIENT_ID: 'app',
    DISCORD_USER_ID: 'user',
    PUBLIC_BASE_URL: 'https://custom.example.test/',
    SPOTIFY_CLIENT_ID: 'id',
    SPOTIFY_CLIENT_SECRET: 'secret'
  });
  await setState(env.DB, STATE_KEYS.publicBaseUrl, 'https://stored.example.test');
  await setState(env.DB, STATE_KEYS.spotifyClientId, CLIENT_ID);

  const resolved = await withRuntimeConfig(env, { requestOrigin: ORIGIN });
  assert.equal(resolved.DISCORD_CLIENT_ID, 'app');
  assert.equal(resolved.DISCORD_USER_ID, 'user');
  assert.equal(resolved.PUBLIC_BASE_URL, 'https://custom.example.test');
  assert.equal(resolved.SPOTIFY_REDIRECT_URI, 'https://custom.example.test/spotify/callback');
  assert.equal(resolved.SPOTIFY_CLIENT_ID, 'id');
  assert.equal(resolved.SPOTIFY_CLIENT_SECRET, 'secret');
  assert.equal(calls.length, 0);
});

test('Discord app id and owner come from the bot token and are cached', async (t) => {
  const calls = mockFetch(t, (url, init) => {
    assert.equal(url, 'https://discord.com/api/v10/applications/@me');
    assert.equal(init.headers.Authorization, 'Bot bot-token-1');
    return discordApp();
  });
  const env = createEnv();

  const first = await withRuntimeConfig(env);
  assert.equal(first.DISCORD_CLIENT_ID, '1001');
  assert.equal(first.DISCORD_USER_ID, '42');
  const second = await withRuntimeConfig(env);
  assert.equal(second.DISCORD_USER_ID, '42');
  assert.equal(calls.length, 1);
  assert.equal((await getState(env.DB, STATE_KEYS.discordApp)).includes('bot-token-1'), false);
});

test('a new bot token looks the app up again', async (t) => {
  let owner = '42';
  const calls = mockFetch(t, () => discordApp({ id: owner }));
  const env = createEnv();
  await withRuntimeConfig(env);
  owner = '43';
  const resolved = await withRuntimeConfig({ ...env, DISCORD_TOKEN: 'bot-token-2' });
  assert.equal(resolved.DISCORD_USER_ID, '43');
  assert.equal(calls.length, 2);
});

test('team-owned apps use the team owner', async (t) => {
  mockFetch(t, () => discordApp({ id: '999', username: 'team123' }, { team: { owner_user_id: '77' } }));
  const resolved = await withRuntimeConfig(createEnv());
  assert.equal(resolved.DISCORD_USER_ID, '77');
});

test('a failed Discord lookup leaves the ids unset and is retried later', async (t) => {
  let ok = false;
  const calls = mockFetch(t, () => (ok ? discordApp() : jsonResponse({ message: '401: Unauthorized' }, 401)));
  const env = createEnv();
  const failed = await withRuntimeConfig(env);
  assert.equal(failed.DISCORD_CLIENT_ID, undefined);
  assert.equal(failed.DISCORD_USER_ID, undefined);
  ok = true;
  assert.equal((await withRuntimeConfig(env)).DISCORD_USER_ID, '42');
  assert.equal(calls.length, 2);
});

test('no DISCORD_TOKEN means no lookup', async (t) => {
  const calls = mockFetch(t, () => discordApp());
  const resolved = await withRuntimeConfig(createEnv({ DISCORD_TOKEN: undefined }));
  assert.equal(resolved.DISCORD_CLIENT_ID, undefined);
  assert.equal(calls.length, 0);
});

test('base URL: stored origin, then the request origin, else unset', async () => {
  const env = createEnv({ DISCORD_TOKEN: undefined });
  assert.equal((await withRuntimeConfig(env)).PUBLIC_BASE_URL, undefined);
  assert.equal((await withRuntimeConfig(env)).SPOTIFY_REDIRECT_URI, undefined);
  assert.equal((await withRuntimeConfig(env, { requestOrigin: ORIGIN })).SPOTIFY_REDIRECT_URI, `${ORIGIN}/spotify/callback`);

  assert.equal(await rememberPublicOrigin(env, ORIGIN), true);
  assert.equal(await rememberPublicOrigin(env, ORIGIN), false);
  const resolved = await withRuntimeConfig(env, { requestOrigin: 'https://other.example.test' });
  assert.equal(resolved.PUBLIC_BASE_URL, ORIGIN);
});

test('only https origins are remembered, and not when PUBLIC_BASE_URL is set', async () => {
  const env = createEnv();
  assert.equal(await rememberPublicOrigin(env, 'http://localhost:8787'), false);
  assert.equal(await rememberPublicOrigin(env, 'not a url'), false);
  assert.equal(await rememberPublicOrigin(env, ''), false);
  assert.equal(await rememberPublicOrigin({ ...env, PUBLIC_BASE_URL: ORIGIN }, 'https://x.example.test'), false);
  assert.equal(await getState(env.DB, STATE_KEYS.publicBaseUrl), null);
});

test('parseSpotifyAppInput accepts 32-hex pairs and names the bad fields', () => {
  assert.deepEqual(parseSpotifyAppInput({ clientId: ` ${CLIENT_ID} `, clientSecret: CLIENT_SECRET }), {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  });
  for (const body of [null, {}, { clientId: '', clientSecret: '' }]) {
    assert.throws(() => parseSpotifyAppInput(body), { code: ERROR_CODES.invalidSpotifyApp, details: ['Client ID', 'Client Secret'] });
  }
  assert.throws(() => parseSpotifyAppInput({ clientId: CLIENT_ID, clientSecret: 'x'.repeat(32) }), {
    details: ['Client Secret']
  });
  assert.throws(() => parseSpotifyAppInput({ clientId: `${CLIENT_ID}0`, clientSecret: CLIENT_SECRET }), {
    details: ['Client ID']
  });
});

test('saveSpotifyApp checks the pair with Spotify before saving', async (t) => {
  let status = 400;
  mockFetch(t, (url, init) => {
    assert.equal(url, 'https://accounts.spotify.com/api/token');
    assert.equal(init.headers.Authorization, `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`);
    return jsonResponse(status === 200 ? { access_token: 'x' } : { error: 'invalid_client' }, status);
  });
  const env = createEnv();
  const input = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };

  await assert.rejects(saveSpotifyApp(env, input), { code: ERROR_CODES.spotifyAppRejected, status: 400 });
  assert.equal(await getState(env.DB, STATE_KEYS.spotifyClientId), null);
  status = 503;
  await assert.rejects(saveSpotifyApp(env, input), { code: ERROR_CODES.spotifyTokenFailed, status: 502 });

  status = 200;
  assert.deepEqual(await saveSpotifyApp(env, input), { changedApp: false });
  assert.equal(await getState(env.DB, STATE_KEYS.spotifyClientSecret), CLIENT_SECRET);
  assert.deepEqual(await saveSpotifyApp(env, input), { changedApp: false });
  const other = { clientId: 'a'.repeat(32), clientSecret: CLIENT_SECRET };
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ access_token: 'x' }));
  assert.deepEqual(await saveSpotifyApp(env, other), { changedApp: true });
});

test('saveSpotifyApp refuses when the app is set in Cloudflare', async () => {
  await assert.rejects(saveSpotifyApp(createEnv({ SPOTIFY_CLIENT_ID: CLIENT_ID }), {}), {
    code: ERROR_CODES.spotifyAppFromCloudflare,
    status: 409
  });
});

test('admin API: Spotify app card saves, never returns the secret, and login uses it', async (t) => {
  mockFetch(t, (url) => {
    if (url.startsWith('https://discord.com/')) {
      return discordApp();
    }
    return jsonResponse({ access_token: 'x' });
  });
  const env = createEnv();
  const cookie = await login(env);

  const unconfigured = await handleRequest(new Request(`${ORIGIN}/spotify/login`, { headers: { Cookie: cookie } }), env);
  assert.equal(unconfigured.status, 303);
  assert.equal(unconfigured.headers.get('Location'), '/admin#status');
  assert.equal(unconfigured.headers.get('Set-Cookie'), null);

  const before = await (await handleRequest(new Request(`${ORIGIN}/admin/api/state`, { headers: { Cookie: cookie } }), env)).json();
  assert.deepEqual(before.setup.spotifyApp, {
    clientId: null,
    hasSecret: false,
    configured: false,
    source: 'admin',
    redirectUri: `${ORIGIN}/spotify/callback`
  });
  assert.deepEqual(before.setup.discordApp, {
    applicationId: '1001',
    userId: '42',
    installUrl: 'https://discord.com/oauth2/authorize?client_id=1001&integration_type=1&scope=applications.commands'
  });
  assert.equal(before.setup.publicBaseUrl, ORIGIN);
  assert.equal(before.discordClientId, '1001');

  const bad = await handleRequest(adminPost('/admin/api/spotify-app', { clientId: 'nope' }, cookie), env).catch((error) => error);
  assert.equal(bad.code, ERROR_CODES.invalidSpotifyApp);

  const saved = await (
    await handleRequest(adminPost('/admin/api/spotify-app', { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }, cookie), env)
  ).json();
  assert.equal(saved.changedApp, false);
  assert.equal(saved.setup.spotifyApp.configured, true);
  assert.equal(saved.setup.spotifyApp.clientId, CLIENT_ID);
  assert.equal(JSON.stringify(saved).includes(CLIENT_SECRET), false);

  const after = await handleRequest(new Request(`${ORIGIN}/admin/api/state`, { headers: { Cookie: cookie } }), env);
  assert.equal((await after.text()).includes(CLIENT_SECRET), false);

  const loginRedirect = await handleRequest(new Request(`${ORIGIN}/spotify/login`, { headers: { Cookie: cookie } }), env);
  assert.equal(loginRedirect.status, 302);
  const authorize = new URL(loginRedirect.headers.get('Location'));
  assert.equal(authorize.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(authorize.searchParams.get('redirect_uri'), `${ORIGIN}/spotify/callback`);
});

test('the Spotify app endpoint needs a signed-in, same-origin JSON request', async () => {
  const env = createEnv();
  await assert.rejects(handleRequest(adminPost('/admin/api/spotify-app', {}, ''), env), { status: 401 });
  const cookie = await login(env);
  const crossSite = new Request(`${ORIGIN}/admin/api/spotify-app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: cookie },
    body: '{}'
  });
  await assert.rejects(handleRequest(crossSite, env), { status: 403 });
});

test('the cron run resolves the Discord ids before patching the widget', async (t) => {
  const env = createEnv({ SPOTIFY_CLIENT_ID: CLIENT_ID, SPOTIFY_CLIENT_SECRET: CLIENT_SECRET });
  await setState(env.DB, 'spotify_refresh_token', 'refresh');
  await setState(env.DB, 'spotify_refresh_token_issued_at', new Date().toISOString());
  await setState(env.DB, STATE_KEYS.publicBaseUrl, ORIGIN);
  const patched = [];
  mockFetch(t, (url, init) => {
    if (url === 'https://discord.com/api/v10/applications/@me') {
      return discordApp();
    }
    if (url === 'https://accounts.spotify.com/api/token') {
      return jsonResponse({ access_token: 'access' });
    }
    if (url.startsWith('https://api.spotify.com/v1/me/player/recently-played')) {
      return jsonResponse({ items: [] });
    }
    if (url.includes('/identities/0/profile')) {
      patched.push(url);
      return jsonResponse({});
    }
    throw new Error(`unexpected fetch ${init.method ?? 'GET'} ${url}`);
  });
  await handleScheduled(env, new Date('2026-11-11T03:00:00Z'));
  assert.deepEqual(patched, ['https://discord.com/api/v9/applications/1001/users/42/identities/0/profile']);
});

test('the reauth reminder works before any public URL is known', async (t) => {
  const sent = [];
  mockFetch(t, (url, init) => {
    if (url.endsWith('/users/@me/channels')) {
      return jsonResponse({ id: 'dm' });
    }
    if (url.endsWith('/channels/dm/messages')) {
      sent.push(JSON.parse(init.body).content);
      return jsonResponse({ id: 'm' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  const { runSpotifyReauthReminder } = await import('../worker/lib/reminder.js');
  const env = await withRuntimeConfig(createEnv({ DISCORD_CLIENT_ID: '1001', DISCORD_USER_ID: '42' }));
  assert.equal(env.PUBLIC_BASE_URL, undefined);
  const result = await runSpotifyReauthReminder(env);
  assert.equal(result.sent, true);
  assert.match(sent[0], /Open your admin page/);
  assert.equal(sent[0].includes(ADMIN_TOKEN), false);
});

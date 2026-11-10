import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../worker/app.js';
import { sessionSecret } from '../worker/lib/admin-auth.js';
import { consumeLoginLink, sendLoginLink, userInstallUrl } from '../worker/lib/login-link.js';
import { runSpotifyReauthReminder } from '../worker/lib/reminder.js';
import { setState } from '../worker/lib/state.js';
import { createD1 } from './helpers/d1.js';

const ORIGIN = 'https://stats.example.test';

function createEnv(extra = {}) {
  return { DB: createD1(), DISCORD_TOKEN: 'bot-token', ...extra };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Discord: app lookup, DM channel and message. `dmStatus` lets a test make the DM fail.
function mockDiscord(t, options = {}) {
  const dms = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://discord.com/api/v10/applications/@me') {
      return jsonResponse({ id: '1001', owner: { id: '42' } });
    }
    if (url.endsWith('/users/@me/channels')) {
      assert.equal(JSON.parse(init.body).recipient_id, '42');
      return options.dmStatus ? jsonResponse({ code: 50007 }, options.dmStatus) : jsonResponse({ id: 'dm' });
    }
    if (url.endsWith('/channels/dm/messages')) {
      dms.push(JSON.parse(init.body).content);
      return jsonResponse({ id: 'm' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return dms;
}

function post(pathname, body = {}, headers = {}) {
  return new Request(`${ORIGIN}${pathname}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, ...headers },
    body: new URLSearchParams(body)
  });
}

function linkToken(dm) {
  const match = dm.match(/<(https:\/\/[^>]+)>/);
  assert.ok(match, 'the DM wraps the link in <> so Discord does not preview it');
  const url = new URL(match[1]);
  assert.equal(url.origin + url.pathname, `${ORIGIN}/admin/login/link`);
  return url.searchParams.get('t');
}

test('userInstallUrl builds the add-to-my-apps link', () => {
  assert.equal(userInstallUrl(null), null);
  assert.equal(userInstallUrl(''), null);
  const url = new URL(userInstallUrl('1001'));
  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), '1001');
  assert.equal(url.searchParams.get('integration_type'), '1');
  assert.equal(url.searchParams.get('scope'), 'applications.commands');
});

test('without ADMIN_TOKEN the login page offers only the DM link and the install link', async (t) => {
  mockDiscord(t);
  const html = await (await handleRequest(new Request(`${ORIGIN}/admin`), createEnv())).text();
  assert.match(html, /action="\/admin\/login\/link"/);
  assert.match(html, /integration_type=1/);
  assert.doesNotMatch(html, /name="token"/);
});

test('with ADMIN_TOKEN the password form is offered too', async (t) => {
  mockDiscord(t);
  const html = await (await handleRequest(new Request(`${ORIGIN}/admin`), createEnv({ ADMIN_TOKEN: 'x'.repeat(32) }))).text();
  assert.match(html, /action="\/admin\/login\/link"/);
  assert.match(html, /name="token"/);
});

test('an unreadable bot token shows the noApp notice and no install link', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ message: '401: Unauthorized' }, 401));
  const html = await (await handleRequest(new Request(`${ORIGIN}/admin`), createEnv())).text();
  assert.match(html, /login\.notice\.noApp/);
  assert.doesNotMatch(html, /integration_type/);
  const sent = await handleRequest(post('/admin/login/link'), createEnv());
  assert.equal(sent.status, 500);
  assert.match(await sent.text(), /login\.notice\.noApp/);
});

test('full DM sign-in: send, open (GET does not use it up), confirm, then the link is spent', async (t) => {
  const dms = mockDiscord(t);
  const env = createEnv();

  const sent = await handleRequest(post('/admin/login/link'), env);
  assert.equal(sent.status, 200);
  assert.match(await sent.text(), /login\.notice\.sent/);
  assert.equal(dms.length, 1);
  const token = linkToken(dms[0]);
  assert.match(token, /^[0-9a-f]{64}$/);

  for (let i = 0; i < 2; i += 1) {
    const opened = await handleRequest(new Request(`${ORIGIN}/admin/login/link?t=${token}`), env);
    const html = await opened.text();
    assert.match(html, /action="\/admin\/login\/confirm"/);
    assert.match(html, new RegExp(`name="t" value="${token}"`));
  }

  const confirmed = await handleRequest(post('/admin/login/confirm', { t: token }), env);
  assert.equal(confirmed.status, 303);
  assert.equal(confirmed.headers.get('Location'), '/admin');
  const cookie = confirmed.headers.get('Set-Cookie').split(';')[0];
  const state = await handleRequest(new Request(`${ORIGIN}/admin/api/state`, { headers: { Cookie: cookie } }), env);
  assert.equal(state.status, 200);

  const again = await handleRequest(post('/admin/login/confirm', { t: token }), env);
  assert.equal(again.status, 400);
  assert.match(await again.text(), /login\.notice\.expired/);
});

test('a new link is limited to one per minute, and a failed DM can be retried at once', async (t) => {
  const env = createEnv({ DISCORD_CLIENT_ID: '1001', DISCORD_USER_ID: '42' });
  t.mock.method(globalThis, 'fetch', async (input) =>
    String(input).endsWith('/users/@me/channels') ? jsonResponse({ code: 50007 }, 403) : jsonResponse({ id: 'm' })
  );
  await assert.rejects(sendLoginLink(env, ORIGIN, 1_000_000), { code: 'login_link_dm_failed', status: 502 });

  const dms = mockDiscord(t);
  await sendLoginLink(env, ORIGIN, 1_000_001);
  await assert.rejects(sendLoginLink(env, ORIGIN, 1_030_000), { code: 'login_link_too_soon', status: 429 });
  await sendLoginLink(env, ORIGIN, 1_061_000);
  assert.equal(dms.length, 2);

  // Only the newest link works.
  assert.equal(await consumeLoginLink(env, linkToken(dms[0]), 1_062_000), false);
  assert.equal(await consumeLoginLink(env, linkToken(dms[1]), 1_062_000), true);
});

test('the send page shows tooSoon and dmFailed notices', async (t) => {
  mockDiscord(t, { dmStatus: 403 });
  const env = createEnv();
  const failed = await handleRequest(post('/admin/login/link'), env);
  assert.equal(failed.status, 502);
  assert.match(await failed.text(), /login\.notice\.dmFailed/);

  mockDiscord(t);
  assert.equal((await handleRequest(post('/admin/login/link'), env)).status, 200);
  const tooSoon = await handleRequest(post('/admin/login/link'), env);
  assert.equal(tooSoon.status, 429);
  assert.match(await tooSoon.text(), /login\.notice\.tooSoon/);
});

test('links expire after 10 minutes and reject malformed tokens', async (t) => {
  const dms = mockDiscord(t);
  const env = createEnv({ DISCORD_CLIENT_ID: '1001', DISCORD_USER_ID: '42' });
  await sendLoginLink(env, ORIGIN, 0);
  const token = linkToken(dms[0]);
  assert.equal(await consumeLoginLink(env, token, 10 * 60 * 1000), false);
  for (const bad of [undefined, null, '', 'x', token.toUpperCase().replace(/[0-9]/g, 'g'), `${token}0`]) {
    assert.equal(await consumeLoginLink(env, bad, 1000), false);
  }
  assert.equal(await consumeLoginLink(env, token, 1000), true);
});

test('a malformed link opens the expired notice instead of a confirm button', async (t) => {
  mockDiscord(t);
  const html = await (await handleRequest(new Request(`${ORIGIN}/admin/login/link?t="><script>`), createEnv())).text();
  assert.doesNotMatch(html, /action="\/admin\/login\/confirm"/);
  assert.doesNotMatch(html, /"><script>/);
  assert.match(html, /login\.notice\.expired/);
});

test('sign-in link endpoints refuse cross-site posts and GET on confirm', async (t) => {
  mockDiscord(t);
  const env = createEnv();
  await assert.rejects(handleRequest(post('/admin/login/link', {}, { Origin: 'https://evil.example' }), env), { status: 403 });
  await assert.rejects(handleRequest(post('/admin/login/confirm', { t: 'a'.repeat(64) }, { Origin: 'https://evil.example' }), env), {
    status: 403
  });
  await assert.rejects(handleRequest(new Request(`${ORIGIN}/admin/login/confirm`), env), { status: 405 });
});

test('without ADMIN_TOKEN: password and ?token= sign-in are off, sessions use a stored key', async (t) => {
  mockDiscord(t);
  const env = createEnv();
  const login = await handleRequest(post('/admin/login', { token: 'anything' }), env);
  assert.equal(login.status, 401);
  await assert.rejects(handleRequest(new Request(`${ORIGIN}/admin/api/state?token=undefined`), env), { status: 401 });
  await assert.rejects(handleRequest(new Request(`${ORIGIN}/admin/api/state?token=`), env), { status: 401 });

  const key = await sessionSecret(env);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(await sessionSecret(env), key);
  assert.equal(await sessionSecret({ ...env, ADMIN_TOKEN: 'token' }), 'token');
});

test('reminder without ADMIN_TOKEN points at the admin page, not a token URL', async (t) => {
  const dms = mockDiscord(t);
  const env = createEnv({ DISCORD_CLIENT_ID: '1001', DISCORD_USER_ID: '42', PUBLIC_BASE_URL: ORIGIN });
  await setState(env.DB, 'spotify_refresh_token_issued_at', new Date(Date.now() - 179 * 24 * 3600 * 1000).toISOString());
  const result = await runSpotifyReauthReminder(env);
  assert.equal(result.sent, true);
  assert.match(dms[0], /https:\/\/stats\.example\.test\/admin#status/);
  assert.doesNotMatch(dms[0], /token=/);
});

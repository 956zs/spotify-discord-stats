import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../worker/app.js';
import { verifySession } from '../worker/lib/admin-auth.js';
import { runDueRecapReports } from '../worker/lib/recap-delivery.js';
import { getDefaultSettings, loadSettings, saveSettings } from '../worker/lib/settings.js';
import { setState } from '../worker/lib/state.js';
import { getWidgetData } from '../worker/lib/stats.js';
import { buildWidgetPayload } from '../worker/lib/widget.js';
import { createD1, insertPlay as insertPlayRow } from './helpers/d1.js';

const ORIGIN = 'https://stats.example.test';
const ADMIN_TOKEN = 'test-admin-token-123';
const DAY_MS = 24 * 60 * 60 * 1000;

function insertPlay(db, playedAtMs, trackKey, artistKey) {
  insertPlayRow(db, new Date(playedAtMs).toISOString(), trackKey, artistKey, { album: 'Album' });
}

function settingsWith(statsDays) {
  const settings = getDefaultSettings();
  settings.statsDays = statsDays;
  return settings;
}

async function slotValue(db, settings, index, options) {
  const payload = buildWidgetPayload(await getWidgetData(db, settings, options), settings);
  const name = ['Songs_Played', 'Listening_Time', 'Unique_Songs', 'Different_Artists', 'Different_Albums', 'Top_Album'][index];
  return payload.data.dynamic.find((field) => field.name === name).value;
}

function createEnv() {
  return { DB: createD1(), ADMIN_TOKEN };
}

function request(pathname, options = {}) {
  return new Request(`${ORIGIN}${pathname}`, options);
}

function jsonPost(pathname, body, headers = {}) {
  return request(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify(body)
  });
}

async function login(env) {
  const response = await handleRequest(
    request('/admin/login', {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: new URLSearchParams({ token: ADMIN_TOKEN })
    }),
    env
  );
  assert.equal(response.status, 303);
  return response.headers.get('Set-Cookie').split(';')[0];
}

test('all-time data includes every play while windowed data does not', async () => {
  const env = createEnv();
  const now = Date.now();
  insertPlay(env.DB, now - 400 * DAY_MS, 'old', 'a1');
  insertPlay(env.DB, now - DAY_MS, 'new', 'a2');

  assert.equal(await slotValue(env.DB, settingsWith(28), 0), '1');
  assert.equal(await slotValue(env.DB, settingsWith('all'), 0), '2');
  assert.equal(await slotValue(env.DB, settingsWith('all'), 3), '2');
  const data = await getWidgetData(env.DB, settingsWith('all'));
  assert.equal(data.ranges.all.since, new Date(now - 400 * DAY_MS).toISOString());
  assert.match(data.lastPlayed.value, /Track new/);
});

test('empty database still builds a payload', async () => {
  const env = createEnv();
  assert.equal(await slotValue(env.DB, settingsWith('all'), 0), '0');
  assert.equal(await slotValue(env.DB, settingsWith(28), 5), 'unknown');
});

test('cached range results are reused until a newer play arrives or refresh is forced', async () => {
  const env = createEnv();
  const now = Date.now();
  insertPlay(env.DB, now - DAY_MS, 'a', 'a1');
  assert.equal(await slotValue(env.DB, settingsWith(28), 0), '1');

  // A play older than the newest one (like an import) leaves the cache in place...
  insertPlay(env.DB, now - 2 * DAY_MS, 'imported', 'a1');
  assert.equal(await slotValue(env.DB, settingsWith(28), 0), '1');
  // ...until a refresh is forced.
  assert.equal(await slotValue(env.DB, settingsWith(28), 0, { refresh: true }), '2');

  insertPlay(env.DB, now, 'b', 'a2');
  assert.equal(await slotValue(env.DB, settingsWith(28), 0), '3');
});

test('changing the selected metrics recomputes instead of serving a stale cache', async () => {
  const env = createEnv();
  insertPlay(env.DB, Date.now() - DAY_MS, 'a', 'a1');
  const settings = settingsWith(28);
  await getWidgetData(env.DB, settings);

  settings.widget.slots[0] = { metric: 'topArtist', range: 'global', label: 'Top Artist', value: '{value}' };
  assert.equal(await slotValue(env.DB, settings, 0), 'Artist a1');
});

test('settings fall back to defaults when nothing, garbage, or stale metrics are stored', async () => {
  const env = createEnv();
  assert.deepEqual(await loadSettings(env.DB), getDefaultSettings());

  await setState(env.DB, 'admin_settings', '{not json');
  assert.deepEqual(await loadSettings(env.DB), getDefaultSettings());

  const stale = getDefaultSettings();
  stale.widget.slots[2].metric = 'removedMetric';
  await setState(env.DB, 'admin_settings', JSON.stringify(stale));
  assert.deepEqual(await loadSettings(env.DB), getDefaultSettings());
});

test('saved settings round-trip and invalid input is rejected', async () => {
  const env = createEnv();
  const input = getDefaultSettings();
  input.statsDays = 'all';
  input.widget.slots[0] = { metric: 'newArtists', range: 90, label: 'New Artists', value: '{value}' };
  await saveSettings(env.DB, input);

  const loaded = await loadSettings(env.DB);
  assert.equal(loaded.statsDays, 'all');
  assert.deepEqual(loaded.widget.slots[0], { metric: 'newArtists', range: 90, label: 'New Artists', value: '{value}' });

  await assert.rejects(saveSettings(env.DB, { ...input, statsDays: 0 }), { status: 400 });
});

test('scheduled recaps respect the recap toggle in settings', async () => {
  const env = createEnv();
  const settings = getDefaultSettings();
  settings.recapEnabled = false;
  await saveSettings(env.DB, settings);
  const result = await runDueRecapReports(env, new Date());
  assert.equal(result.reason, 'disabled');
});

test('admin page shows login form until signed in', async () => {
  const env = createEnv();
  const response = await handleRequest(request('/admin'), env);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /name="token"/);
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'nonce-/);
});

test('login rejects a wrong token and cross-origin posts', async () => {
  const env = createEnv();
  const wrong = await handleRequest(
    request('/admin/login', {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: new URLSearchParams({ token: 'nope' })
    }),
    env
  );
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('Set-Cookie'), null);

  await assert.rejects(
    handleRequest(
      request('/admin/login', {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
        body: new URLSearchParams({ token: ADMIN_TOKEN })
      }),
      env
    ),
    { status: 403 }
  );
});

test('cross-site fetch metadata is rejected even with a matching origin', async () => {
  const env = createEnv();
  const cookie = await login(env);
  await assert.rejects(
    handleRequest(
      jsonPost('/admin/api/settings', { settings: getDefaultSettings() }, {
        Cookie: cookie,
        'Sec-Fetch-Site': 'cross-site'
      }),
      env
    ),
    { status: 403 }
  );
  const sameOrigin = await handleRequest(
    jsonPost('/admin/api/settings', { settings: getDefaultSettings() }, {
      Cookie: cookie,
      Origin: 'http://localhost:8799',
      'Sec-Fetch-Site': 'same-origin'
    }),
    env
  );
  assert.equal(sameOrigin.status, 200);
});

test('session cookie is hardened and unlocks the admin api', async () => {
  const env = createEnv();
  const response = await handleRequest(
    request('/admin/login', {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: new URLSearchParams({ token: ADMIN_TOKEN })
    }),
    env
  );
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);

  const cookie = setCookie.split(';')[0];
  const page = await handleRequest(request('/admin', { headers: { Cookie: cookie } }), env);
  assert.match(await page.text(), /id="settings"/);

  const state = await handleRequest(request('/admin/api/state', { headers: { Cookie: cookie } }), env);
  const data = await state.json();
  assert.equal(state.status, 200);
  assert.equal(data.settings.statsDays, getDefaultSettings().statsDays);
  assert.equal(data.fields.slots[0].label, 'Songs_Played_Label');
  assert.ok(data.metrics.some((metric) => metric.id === 'topArtist'));
  assert.ok(data.payload.data.dynamic.some((field) => field.name === 'Songs_Played_Label'));
});

test('admin api rejects missing, tampered, and expired sessions', async () => {
  const env = createEnv();
  await assert.rejects(handleRequest(request('/admin/api/state'), env), { status: 401 });

  const cookie = await login(env);
  const tampered = cookie.replace(/.$/, (char) => (char === '0' ? '1' : '0'));
  await assert.rejects(
    handleRequest(request('/admin/api/state', { headers: { Cookie: tampered } }), env),
    { status: 401 }
  );

  const value = cookie.split('=')[1];
  assert.equal(await verifySession(value, ADMIN_TOKEN), true);
  assert.equal(await verifySession(value, ADMIN_TOKEN, Date.now() + 31 * DAY_MS), false);
  assert.equal(await verifySession(value, 'rotated-token'), false);
  assert.equal(await verifySession('', ADMIN_TOKEN), false);
});

test('query token still works for existing admin routes', async () => {
  const env = createEnv();
  const ok = await handleRequest(request(`/admin/stats?token=${ADMIN_TOKEN}`), env);
  assert.equal(ok.status, 200);
  await assert.rejects(handleRequest(request('/admin/stats?token=wrong'), env), { status: 401 });
});

test('settings api validates, guards origin and content type, then saves', async () => {
  const env = createEnv();
  const cookie = await login(env);
  const settings = getDefaultSettings();
  settings.statsDays = 'all';
  settings.widget.topHeroTitle = '✦ {range} on Spotify';

  await assert.rejects(
    handleRequest(jsonPost('/admin/api/settings', { settings }, { Cookie: cookie, Origin: 'https://evil.example' }), env),
    { status: 403 }
  );
  await assert.rejects(
    handleRequest(
      request('/admin/api/settings', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'text/plain' },
        body: JSON.stringify({ settings })
      }),
      env
    ),
    { status: 415 }
  );
  await assert.rejects(
    handleRequest(jsonPost('/admin/api/settings', { settings: { ...settings, statsDays: -5 } }, { Cookie: cookie }), env),
    { status: 400 }
  );

  const saved = await handleRequest(jsonPost('/admin/api/settings', { settings }, { Cookie: cookie }), env);
  assert.equal(saved.status, 200);
  assert.equal((await loadSettings(env.DB)).statsDays, 'all');
});

test('preview renders unsaved settings without persisting them', async () => {
  const env = createEnv();
  insertPlay(env.DB, Date.now() - 400 * DAY_MS, 'old', 'a1');
  insertPlay(env.DB, Date.now() - DAY_MS, 'new', 'a2');
  const cookie = await login(env);
  const settings = getDefaultSettings();
  settings.statsDays = 'all';
  settings.widget.mainTitle = '{rangeLong}: {count}';

  const response = await handleRequest(jsonPost('/admin/api/preview', { settings }, { Cookie: cookie }), env);
  const { payload } = await response.json();
  const mainTitle = payload.data.dynamic.find((field) => field.name === 'main_title').value;
  assert.equal(mainTitle, 'All Time: 2');
  assert.equal((await loadSettings(env.DB)).statsDays, getDefaultSettings().statsDays);
});

test('logout clears the session cookie', async () => {
  const env = createEnv();
  const response = await handleRequest(request('/admin/logout', { method: 'POST' }), env);
  assert.equal(response.status, 303);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
});

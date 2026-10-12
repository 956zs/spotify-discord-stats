import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handleRequest } from '../worker/app.js';
import { verifySession } from '../worker/lib/admin-auth.js';
import { runDueRecapReports } from '../worker/lib/recap-delivery.js';
import { getDefaultSettings, loadSettings, saveSettings } from '../worker/lib/settings.js';
import { setState } from '../worker/lib/state.js';
import { getWidgetStats } from '../worker/lib/stats.js';

const ORIGIN = 'https://stats.example.test';
const ADMIN_TOKEN = 'test-admin-token-123';
const DAY_MS = 24 * 60 * 60 * 1000;

// Minimal D1 surface (prepare/bind/first/all/run) over an in-memory SQLite database.
function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = new URL('../migrations/', import.meta.url);
  for (const file of fs.readdirSync(migrationsDir).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir.pathname, file), 'utf8'));
  }

  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } })
  });
  return { prepare: (sql) => statement(sql), sqlite };
}

function insertPlay(db, playedAtMs, trackKey, artistKey, albumName = 'Album') {
  const playedAt = new Date(playedAtMs).toISOString();
  db.sqlite
    .prepare(`INSERT INTO plays (played_at, played_at_ms, track_key, track_name, album_key, album_name,
      duration_ms, ms_played, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 60000, 60000, 'test', ?)`)
    .run(playedAt, playedAtMs, trackKey, `Track ${trackKey}`, albumName, albumName, playedAt);
  db.sqlite
    .prepare('INSERT INTO play_artists (played_at, track_key, artist_key, artist_name) VALUES (?, ?, ?, ?)')
    .run(playedAt, trackKey, artistKey, `Artist ${artistKey}`);
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

test('all-time stats include every play while windowed stats do not', async () => {
  const env = createEnv();
  const now = Date.now();
  insertPlay(env.DB, now - 400 * DAY_MS, 'old', 'a1');
  insertPlay(env.DB, now - DAY_MS, 'new', 'a2');

  const windowed = await getWidgetStats(env.DB, 28);
  const allTime = await getWidgetStats(env.DB, 'all');
  assert.equal(windowed.songsPlayed, 1);
  assert.equal(allTime.songsPlayed, 2);
  assert.equal(allTime.differentArtists, 2);
  assert.equal(allTime.since, new Date(now - 400 * DAY_MS).toISOString());
  assert.equal(allTime.lastPlayed.value.includes('Track new'), true);
});

test('all-time stats on an empty database return zeros', async () => {
  const env = createEnv();
  const stats = await getWidgetStats(env.DB, 'all');
  assert.equal(stats.songsPlayed, 0);
  assert.equal(stats.topAlbum, 'unknown');
});

test('all-time cache is reused until a newer play arrives or refresh is forced', async () => {
  const env = createEnv();
  const now = Date.now();
  insertPlay(env.DB, now - DAY_MS, 'a', 'a1');
  assert.equal((await getWidgetStats(env.DB, 'all')).songsPlayed, 1);

  // An imported play older than the newest one does not invalidate the cache...
  insertPlay(env.DB, now - 900 * DAY_MS, 'imported', 'a1');
  assert.equal((await getWidgetStats(env.DB, 'all')).songsPlayed, 1);
  // ...but an explicit refresh does.
  assert.equal((await getWidgetStats(env.DB, 'all', { refresh: true })).songsPlayed, 2);

  insertPlay(env.DB, now, 'b', 'a2');
  assert.equal((await getWidgetStats(env.DB, 'all')).songsPlayed, 3);
});

test('settings fall back to defaults when nothing or garbage is stored', async () => {
  const env = createEnv();
  assert.deepEqual(await loadSettings(env.DB), getDefaultSettings());

  await setState(env.DB, 'admin_settings', '{not json');
  assert.deepEqual(await loadSettings(env.DB), getDefaultSettings());
});

test('saved settings round-trip and invalid input is rejected', async () => {
  const env = createEnv();
  const input = getDefaultSettings();
  input.statsDays = 'all';
  input.widget.stats.songsPlayed.label = 'All Songs';
  await saveSettings(env.DB, input);

  const loaded = await loadSettings(env.DB);
  assert.equal(loaded.statsDays, 'all');
  assert.equal(loaded.widget.stats.songsPlayed.label, 'All Songs');

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
  assert.equal(data.fields.labels.songsPlayed, 'Songs_Played_Label');
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

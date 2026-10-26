import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../worker/app.js';
import { getDefaultSettings, saveSettings } from '../worker/lib/settings.js';
import { readFileSync } from 'node:fs';
import { HERO_TEMPLATE_PATH, heroTemplateBytes } from '../worker/lib/hero-template.js';
import { MAX_WIDGET_IMAGE_BYTES, detectImageType } from '../worker/lib/widget-images.js';
import { createD1, insertPlay } from './helpers/d1.js';

const ORIGIN = 'https://stats.example.test';
const ADMIN_TOKEN = 'test-admin-token-123';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2]);
const GIF = new TextEncoder().encode('GIF89a\x01\x00\x01\x00');
const WEBP = new Uint8Array([...new TextEncoder().encode('RIFF'), 4, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8 ')]);

function createEnv(extra = {}) {
  return { DB: createD1(), ADMIN_TOKEN, PUBLIC_BASE_URL: ORIGIN, ...extra };
}

function request(pathname, options = {}) {
  return new Request(`${ORIGIN}${pathname}`, options);
}

async function login(env) {
  const response = await handleRequest(
    request('/admin/login', { method: 'POST', headers: { Origin: ORIGIN }, body: new URLSearchParams({ token: ADMIN_TOKEN }) }),
    env
  );
  return response.headers.get('Set-Cookie').split(';')[0];
}

function upload(bytes, contentType, headers = {}) {
  return request('/admin/api/hero-image', {
    method: 'POST',
    headers: { 'Content-Type': contentType, Origin: ORIGIN, ...headers },
    body: bytes
  });
}

function deleteRequest(headers = {}) {
  return request('/admin/api/hero-image/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: '{}'
  });
}

async function adminState(env, cookie) {
  return (await handleRequest(request('/admin/api/state', { headers: { Cookie: cookie } }), env)).json();
}

test('detectImageType recognises the four allowed signatures only', () => {
  assert.equal(detectImageType(PNG), 'image/png');
  assert.equal(detectImageType(JPEG), 'image/jpeg');
  assert.equal(detectImageType(GIF), 'image/gif');
  assert.equal(detectImageType(WEBP), 'image/webp');
  assert.equal(detectImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectImageType(new Uint8Array()), null);
  assert.equal(detectImageType(new TextEncoder().encode('RIFF\0\0\0\0WAVE')), null);
});

test('hero upload requires an admin session and same-origin requests', async () => {
  const env = createEnv();
  await assert.rejects(handleRequest(upload(PNG, 'image/png'), env), { status: 401 });
  await assert.rejects(handleRequest(deleteRequest(), env), { status: 401 });

  const cookie = await login(env);
  await assert.rejects(
    handleRequest(upload(PNG, 'image/png', { Cookie: cookie, Origin: 'https://evil.example' }), env),
    { status: 403 }
  );
  await assert.rejects(
    handleRequest(upload(PNG, 'image/png', { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' }), env),
    { status: 403 }
  );
  await assert.rejects(
    handleRequest(request('/admin/api/hero-image', { headers: { Cookie: cookie } }), env),
    { status: 405 }
  );
});

test('hero upload rejects other types, mismatched bytes, empty and oversized files', async () => {
  const env = createEnv();
  const cookie = await login(env);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await assert.rejects(handleRequest(upload(svg, 'image/svg+xml', { Cookie: cookie }), env), { status: 415, code: 'image_type' });
  await assert.rejects(handleRequest(upload(PNG, 'text/html', { Cookie: cookie }), env), { status: 415, code: 'image_type' });
  await assert.rejects(
    handleRequest(upload(PNG, 'image/jpeg', { Cookie: cookie }), env),
    { status: 400, code: 'image_mismatch', message: /格式不符/ }
  );
  await assert.rejects(handleRequest(upload(svg, 'image/png', { Cookie: cookie }), env), { status: 400, code: 'image_mismatch' });
  await assert.rejects(handleRequest(upload(new Uint8Array(), 'image/png', { Cookie: cookie }), env), { status: 400, code: 'image_empty' });

  const big = new Uint8Array(MAX_WIDGET_IMAGE_BYTES + 1);
  big.set(PNG);
  await assert.rejects(handleRequest(upload(big, 'image/png', { Cookie: cookie }), env), { status: 413, code: 'image_too_large', message: /圖片太大/ });

  const exact = new Uint8Array(MAX_WIDGET_IMAGE_BYTES);
  exact.set(PNG);
  assert.equal((await handleRequest(upload(exact, 'image/png', { Cookie: cookie }), env)).status, 200);
});

test('uploaded hero is served publicly with type, caching headers and ETag', async () => {
  const env = createEnv();
  const cookie = await login(env);
  assert.equal((await handleRequest(request('/widget/hero'), env)).status, 404);

  const response = await handleRequest(upload(PNG, 'image/png; charset=binary', { Cookie: cookie }), env);
  assert.equal(response.status, 200);
  const { heroImage } = await response.json();
  assert.equal(heroImage.upload.contentType, 'image/png');
  assert.equal(heroImage.upload.size, PNG.length);
  assert.match(heroImage.upload.url, /^\/widget\/hero\?v=[0-9a-f]{12}$/);
  assert.equal(heroImage.publicBaseUrl, ORIGIN);

  const served = await handleRequest(request(heroImage.upload.url), env);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('Content-Type'), 'image/png');
  assert.equal(served.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(served.headers.get('ETag'), `"${heroImage.upload.sha256}"`);
  assert.equal(served.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), PNG);

  const notModified = await handleRequest(
    request('/widget/hero', { headers: { 'If-None-Match': `"${heroImage.upload.sha256}"` } }),
    env
  );
  assert.equal(notModified.status, 304);
  await assert.rejects(handleRequest(request('/widget/hero', { method: 'POST' }), env), { status: 405 });

  // A new upload replaces the file and changes the version.
  const second = await (await handleRequest(upload(JPEG, 'image/jpeg', { Cookie: cookie }), env)).json();
  assert.notEqual(second.heroImage.upload.url, heroImage.upload.url);
  const replaced = await handleRequest(request('/widget/hero'), env);
  assert.equal(replaced.headers.get('Content-Type'), 'image/jpeg');
  assert.deepEqual(new Uint8Array(await replaced.arrayBuffer()), JPEG);
});

test('upload mode payload points at the versioned public URL until the image is deleted', async () => {
  const env = createEnv();
  const cookie = await login(env);
  const settings = getDefaultSettings();
  settings.widget.heroImage = 'upload';
  await saveSettings(env.DB, settings);

  const heroField = (payload) => payload.data.dynamic.find((field) => field.name === 'hero_image');
  assert.equal(heroField((await adminState(env, cookie)).payload), undefined);

  const { heroImage } = await (await handleRequest(upload(GIF, 'image/gif', { Cookie: cookie }), env)).json();
  const state = await adminState(env, cookie);
  assert.deepEqual(heroField(state.payload), {
    type: 3,
    name: 'hero_image',
    value: { url: `${ORIGIN}${heroImage.upload.url}` }
  });
  assert.equal(state.heroImage.upload.sha256, heroImage.upload.sha256);

  await assert.rejects(handleRequest(deleteRequest({ Cookie: cookie, Origin: 'https://evil.example' }), env), { status: 403 });
  const deleted = await (await handleRequest(deleteRequest({ Cookie: cookie }), env)).json();
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.heroImage.upload, null);
  assert.equal((await handleRequest(request('/widget/hero'), env)).status, 404);
  assert.equal(heroField((await adminState(env, cookie)).payload), undefined);

  const again = await (await handleRequest(deleteRequest({ Cookie: cookie }), env)).json();
  assert.equal(again.deleted, false);
});

test('upload mode without PUBLIC_BASE_URL or SPOTIFY_REDIRECT_URI acts like asset', async () => {
  const env = createEnv({ PUBLIC_BASE_URL: undefined });
  const cookie = await login(env);
  const settings = getDefaultSettings();
  settings.widget.heroImage = 'upload';
  await saveSettings(env.DB, settings);
  await handleRequest(upload(PNG, 'image/png', { Cookie: cookie }), env);
  const state = await adminState(env, cookie);
  assert.equal(state.heroImage.publicBaseUrl, null);
  assert.equal(state.payload.data.dynamic.some((field) => field.name === 'hero_image'), false);

  const withRedirect = { ...env, SPOTIFY_REDIRECT_URI: 'https://other.example.test/spotify/callback' };
  const redirected = await adminState(withRedirect, cookie);
  assert.match(
    redirected.payload.data.dynamic.find((field) => field.name === 'hero_image').value.url,
    /^https:\/\/other\.example\.test\/widget\/hero\?v=/
  );
});

test('album mode uses the last played album artwork from D1', async () => {
  const env = createEnv();
  const cookie = await login(env);
  const settings = getDefaultSettings();
  settings.widget.heroImage = 'album';
  await saveSettings(env.DB, settings);

  insertPlay(env.DB, new Date(Date.now() - 60_000).toISOString(), 'no-art', 'a1');
  const noArt = await adminState(env, cookie);
  assert.equal(noArt.payload.data.dynamic.some((field) => field.name === 'hero_image'), false);
  assert.equal(noArt.albumImageUrl, null);

  insertPlay(env.DB, new Date().toISOString(), 'with-art', 'a1');
  env.DB.sqlite.prepare("UPDATE plays SET album_image_url = 'https://i.scdn.co/image/abc' WHERE track_key = 'with-art'").run();
  const withArt = await adminState(env, cookie);
  assert.deepEqual(
    withArt.payload.data.dynamic.find((field) => field.name === 'hero_image'),
    { type: 3, name: 'hero_image', value: { url: 'https://i.scdn.co/image/abc' } }
  );
  // The admin page shows the cover on the album mode card in every mode.
  assert.equal(withArt.albumImageUrl, 'https://i.scdn.co/image/abc');
  const preview = await handleRequest(
    request('/admin/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ settings: getDefaultSettings() })
    }),
    env
  );
  assert.equal((await preview.json()).albumImageUrl, 'https://i.scdn.co/image/abc');
});

test('admin state exposes the Discord client id, or null without one', async () => {
  const withId = createEnv({ DISCORD_CLIENT_ID: '123456789012345678' });
  assert.equal((await adminState(withId, await login(withId))).discordClientId, '123456789012345678');
  const withoutId = createEnv();
  assert.equal((await adminState(withoutId, await login(withoutId))).discordClientId, null);
  const emptyId = createEnv({ DISCORD_CLIENT_ID: '' });
  assert.equal((await adminState(emptyId, await login(emptyId))).discordClientId, null);
});

test('hero editor confirmation round-trips through the settings api', async () => {
  const env = createEnv();
  const cookie = await login(env);
  assert.equal((await adminState(env, cookie)).settings.widget.heroEditorConfirmed, false);
  const settings = getDefaultSettings();
  settings.widget.heroImage = 'upload';
  settings.widget.heroEditorConfirmed = true;
  const saved = await handleRequest(
    request('/admin/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ settings })
    }),
    env
  );
  assert.equal(saved.status, 200);
  assert.equal((await adminState(env, cookie)).settings.widget.heroEditorConfirmed, true);
});

test('hero template is served publicly and matches the PNG in docs', async () => {
  const png = new Uint8Array(readFileSync(new URL('../docs/images/templates/hero-guide-1300x1200.png', import.meta.url)));
  assert.deepEqual(heroTemplateBytes(), png);

  const env = createEnv();
  const response = await handleRequest(request(HERO_TEMPLATE_PATH), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.match(response.headers.get('Cache-Control'), /^public, max-age=\d+$/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);

  const etag = response.headers.get('ETag');
  const notModified = await handleRequest(request(HERO_TEMPLATE_PATH, { headers: { 'If-None-Match': etag } }), env);
  assert.equal(notModified.status, 304);
  const head = await handleRequest(request(HERO_TEMPLATE_PATH, { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  await assert.rejects(handleRequest(request(HERO_TEMPLATE_PATH, { method: 'POST' }), env), { status: 405 });
});

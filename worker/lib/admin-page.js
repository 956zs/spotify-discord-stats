import { cryptoRandomHex } from './crypto.js';

const NONCE_BYTES = 16;

export function adminPageResponse() {
  return page('Spotify Stats Admin', ADMIN_BODY, ADMIN_SCRIPT);
}

export function loginPageResponse(status = 200, failed = false) {
  const message = failed ? '<p class="error">Token 不正確</p>' : '';
  return page(
    'Spotify Stats Admin',
    `<main class="login">
      <h1>Spotify Stats Admin</h1>
      ${message}
      <form method="post" action="/admin/login">
        <label>ADMIN_TOKEN<input type="password" name="token" autocomplete="current-password" required autofocus></label>
        <button type="submit">登入</button>
      </form>
    </main>`,
    '',
    status
  );
}

function page(title, body, script, status = 200) {
  const nonce = cryptoRandomHex(NONCE_BYTES);
  const scriptTag = script ? `<script nonce="${nonce}">${script}</script>` : '';
  return new Response(
    `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
${body}
${scriptTag}
</body>
</html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': [
          "default-src 'none'",
          `script-src 'nonce-${nonce}'`,
          `style-src 'nonce-${nonce}'`,
          "img-src 'self' https://i.scdn.co",
          "connect-src 'self'",
          "form-action 'self'",
          "base-uri 'none'",
          "frame-ancestors 'none'"
        ].join('; ')
      }
    }
  );
}

const STYLE = `
:root { color-scheme: dark; --bg:#111214; --panel:#1e1f22; --line:#2e3035; --text:#dbdee1; --muted:#949ba4; --accent:#5865f2; --ok:#23a55a; --bad:#f23f43; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 system-ui, sans-serif; }
h1 { font-size:20px; margin:0 0 16px; }
h2 { font-size:15px; margin:0 0 12px; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
.login { max-width:360px; padding-top:15vh; }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:20px; align-items:start; }
@media (max-width: 860px) { .layout { grid-template-columns:1fr; } }
section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:16px; }
label { display:block; color:var(--muted); font-size:12px; margin-bottom:10px; }
input, select { display:block; width:100%; margin-top:4px; padding:8px 10px; background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:6px; font:inherit; }
input:focus, select:focus { outline:2px solid var(--accent); border-color:transparent; }
.row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.check { display:flex; align-items:center; gap:8px; color:var(--text); font-size:14px; }
.check input { width:auto; margin:0; }
button, a.button { padding:8px 14px; text-decoration:none; border:0; border-radius:6px; background:var(--line); color:var(--text); font:inherit; cursor:pointer; }
button.primary { background:var(--accent); color:#fff; }
button:disabled { opacity:.5; cursor:default; }
.actions { display:flex; flex-wrap:wrap; gap:8px; }
.actions.header { justify-content:space-between; align-items:center; margin-bottom:12px; }
.actions.spaced { margin-top:12px; }
.hidden { visibility:hidden; }
.hint { color:var(--muted); font-size:12px; margin:0 0 12px; }
code { background:var(--bg); padding:1px 5px; border-radius:4px; }
.error { color:var(--bad); }
.status { min-height:20px; margin-top:10px; font-size:13px; white-space:pre-wrap; }
.status.ok { color:var(--ok); } .status.bad { color:var(--bad); }
.sticky { position:sticky; top:16px; }
.card { background:#232428; border-radius:8px; overflow:hidden; }
.card-top { padding:14px; border-bottom:1px solid var(--line); }
.card-user { font-size:11px; color:var(--muted); }
.card-hero { font-size:17px; font-weight:600; margin:6px 0 2px; }
.card-small { font-size:11px; color:var(--muted); word-break:break-word; }
.card-main { font-size:13px; margin-top:8px; }
.card-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:14px; }
.stat-value { font-size:13px; word-break:break-word; }
.stat-label { font-size:10px; color:var(--muted); }
details { margin-top:12px; } summary { cursor:pointer; color:var(--muted); font-size:12px; }
pre { overflow:auto; max-height:320px; font-size:11px; background:var(--bg); padding:10px; border-radius:6px; }
dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; font-size:13px; }
dt { color:var(--muted); }
dd { margin:0; }
`;

const STAT_ROWS = [
  ['songsPlayed', 'Songs Played'],
  ['listeningTime', 'Listening Time'],
  ['uniqueSongs', 'Unique Songs'],
  ['differentArtists', 'Different Artists'],
  ['differentAlbums', 'Different Albums'],
  ['topAlbum', 'Top Album']
];

const ADMIN_BODY = `<main>
  <div class="actions header">
    <h1>Spotify Stats Admin</h1>
    <form method="post" action="/admin/logout"><button type="submit">登出</button></form>
  </div>
  <div class="layout">
    <div>
      <form id="settings">
        <section>
          <h2>統計區間</h2>
          <div class="row">
            <label>區間
              <select name="rangeChoice">
                <option value="7">最近 7 天</option>
                <option value="28">最近 28 天（4w）</option>
                <option value="90">最近 90 天</option>
                <option value="365">最近 365 天</option>
                <option value="all">全部歷史</option>
                <option value="custom">自訂天數</option>
              </select>
            </label>
            <label id="customDaysWrap">自訂天數<input name="customDays" type="number" min="1" max="3650" step="1"></label>
          </div>
          <label class="check"><input type="checkbox" name="recapEnabled"> 自動發送週報 / 月報 DM</label>
        </section>
        <section>
          <h2>Widget 文字</h2>
          <p class="hint">可用變數：<code>{range}</code> → 4w / all time、<code>{rangeLong}</code> → 4 Weeks / All Time、<code>{count}</code> → 播放次數；數值欄另有 <code>{value}</code>。</p>
          <label>Username<input name="username" maxlength="80"></label>
          <label>Hero 標題（top_hero_title）<input name="topHeroTitle" maxlength="256"></label>
          <label>主標題（main_title）<input name="mainTitle" maxlength="256"></label>
          <label>更新時間前綴（last_updated）<input name="lastUpdatedPrefix" maxlength="256"></label>
        </section>
        <section>
          <h2>統計欄位</h2>
          ${STAT_ROWS.map(([key, name]) => `<div class="row">
            <label>${name} 標籤<input name="${key}.label" maxlength="256"></label>
            <label>${name} 數值<input name="${key}.value" maxlength="256"></label>
          </div>`).join('')}
        </section>
        <div class="actions">
          <button type="submit" class="primary" id="saveBtn">儲存並推送到 Discord</button>
          <button type="button" id="saveOnlyBtn">只儲存</button>
          <button type="button" id="resetBtn">填回預設值</button>
        </div>
        <div id="saveStatus" class="status"></div>
      </form>
    </div>
    <div class="sticky">
      <section>
        <h2>預覽</h2>
        <div class="card">
          <div class="card-top">
            <div class="card-user" id="pUser"></div>
            <div class="card-hero" id="pHero"></div>
            <div class="card-small" id="pDuring"></div>
            <div class="card-small" id="pUpdated"></div>
            <div class="card-small" id="pSong"></div>
            <div class="card-main" id="pMain"></div>
          </div>
          <div class="card-stats" id="pStats"></div>
        </div>
        <details><summary>Payload JSON</summary><pre id="pJson"></pre></details>
        <div id="previewStatus" class="status"></div>
      </section>
      <section>
        <h2>狀態與操作</h2>
        <dl id="statusList"></dl>
        <div class="actions spaced">
          <button type="button" id="syncBtn">立即同步</button>
          <button type="button" id="weeklyBtn">發送週報</button>
          <button type="button" id="monthlyBtn">發送月報</button>
          <a class="button" href="/spotify/login">Spotify 重新授權</a>
        </div>
        <div id="actionStatus" class="status"></div>
      </section>
    </div>
  </div>
</main>`;

const ADMIN_SCRIPT = `
const STAT_KEYS = ${JSON.stringify(STAT_ROWS.map(([key]) => key))};
const PRESET_DAYS = ['7', '28', '90', '365'];
const form = document.getElementById('settings');
let defaults = null;
let previewTimer = null;
let previewSeq = 0;

const $ = (id) => document.getElementById(id);
const input = (name) => form.elements.namedItem(name);

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) {
    location.reload();
    throw new Error('登入已過期');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'HTTP ' + response.status);
  }
  return data;
}

function setStatus(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.className = 'status ' + (ok === undefined ? '' : ok ? 'ok' : 'bad');
}

function fillForm(settings) {
  const days = String(settings.statsDays);
  if (days === 'all' || PRESET_DAYS.includes(days)) {
    input('rangeChoice').value = days;
  } else {
    input('rangeChoice').value = 'custom';
    input('customDays').value = days;
  }
  input('recapEnabled').checked = settings.recapEnabled;
  for (const name of ['username', 'topHeroTitle', 'mainTitle', 'lastUpdatedPrefix']) {
    input(name).value = settings.widget[name];
  }
  for (const key of STAT_KEYS) {
    input(key + '.label').value = settings.widget.stats[key].label;
    input(key + '.value').value = settings.widget.stats[key].value;
  }
  toggleCustomDays();
}

function readForm() {
  const choice = input('rangeChoice').value;
  const stats = {};
  for (const key of STAT_KEYS) {
    stats[key] = { label: input(key + '.label').value, value: input(key + '.value').value };
  }
  return {
    statsDays: choice === 'all' ? 'all' : Number(choice === 'custom' ? input('customDays').value : choice),
    recapEnabled: input('recapEnabled').checked,
    widget: {
      username: input('username').value,
      topHeroTitle: input('topHeroTitle').value,
      mainTitle: input('mainTitle').value,
      lastUpdatedPrefix: input('lastUpdatedPrefix').value,
      stats
    }
  };
}

function toggleCustomDays() {
  $('customDaysWrap').classList.toggle('hidden', input('rangeChoice').value !== 'custom');
}

function renderPreview(payload, map) {
  const fields = Object.fromEntries(payload.data.dynamic.map((field) => [field.name, field.value]));
  $('pUser').textContent = payload.username;
  $('pHero').textContent = fields[map.topHeroTitle];
  $('pDuring').textContent = fields[map.during];
  $('pUpdated').textContent = fields[map.lastUpdated];
  $('pSong').textContent = fields[map.song];
  $('pMain').textContent = fields[map.mainTitle];
  const statsEl = $('pStats');
  statsEl.replaceChildren();
  for (const key of STAT_KEYS) {
    const cell = document.createElement('div');
    const value = document.createElement('div');
    const label = document.createElement('div');
    value.className = 'stat-value';
    label.className = 'stat-label';
    value.textContent = fields[map[key]];
    label.textContent = fields[map.labels[key]];
    cell.append(value, label);
    statsEl.append(cell);
  }
  $('pJson').textContent = JSON.stringify({ username: payload.username, data: payload.data }, null, 2);
}

function renderStatus(status) {
  const list = $('statusList');
  list.replaceChildren();
  for (const [name, value] of status) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = name;
    dd.textContent = value ?? '—';
    list.append(dt, dd);
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
}

async function refreshPreview() {
  const seq = ++previewSeq;
  try {
    const data = await api('/admin/api/preview', { settings: readForm() });
    if (seq !== previewSeq) return;
    renderPreview(data.payload, data.fields);
    setStatus('previewStatus', '');
  } catch (error) {
    if (seq !== previewSeq) return;
    setStatus('previewStatus', error.message, false);
  }
}

async function save(push) {
  const buttons = [$('saveBtn'), $('saveOnlyBtn')];
  buttons.forEach((button) => (button.disabled = true));
  try {
    await api('/admin/api/settings', { settings: readForm() });
    if (push) {
      setStatus('saveStatus', '已儲存，推送中…');
      const result = await api('/admin/api/push', {});
      setStatus('saveStatus', result.discord?.patched ? '已儲存並推送到 Discord' : '已儲存（推送結果：' + (result.discord?.reason || 'unknown') + '）', true);
      await loadState();
    } else {
      setStatus('saveStatus', '已儲存，下次同步（10 分鐘內）會套用', true);
    }
  } catch (error) {
    setStatus('saveStatus', error.message, false);
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
}

async function runAction(button, path, confirmText) {
  if (confirmText && !confirm(confirmText)) return;
  button.disabled = true;
  setStatus('actionStatus', '執行中…');
  try {
    const result = await api(path, {});
    setStatus('actionStatus', JSON.stringify(result, null, 2), true);
    await loadState();
  } catch (error) {
    setStatus('actionStatus', error.message, false);
  } finally {
    button.disabled = false;
  }
}

async function loadState() {
  const data = await api('/admin/api/state');
  defaults = data.defaults;
  renderStatus(data.status);
  return data;
}

form.addEventListener('input', () => { toggleCustomDays(); schedulePreview(); });
form.addEventListener('submit', (event) => { event.preventDefault(); save(true); });
$('saveOnlyBtn').addEventListener('click', () => save(false));
$('resetBtn').addEventListener('click', () => { fillForm(defaults); schedulePreview(); setStatus('saveStatus', '已填回預設值（尚未儲存）'); });
$('syncBtn').addEventListener('click', (event) => runAction(event.currentTarget, '/admin/api/push'));
$('weeklyBtn').addEventListener('click', (event) => runAction(event.currentTarget, '/admin/recap/weekly/send', '要立即發送週報 DM 嗎？'));
$('monthlyBtn').addEventListener('click', (event) => runAction(event.currentTarget, '/admin/recap/monthly/send', '要立即發送月報 DM 嗎？'));

loadState()
  .then((data) => { fillForm(data.settings); renderPreview(data.payload, data.fields); })
  .catch((error) => setStatus('previewStatus', error.message, false));
`;

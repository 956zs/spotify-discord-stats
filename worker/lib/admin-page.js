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
        <button type="submit" class="primary wide">登入</button>
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
:root { color-scheme: dark; --bg:#111214; --panel:#1e1f22; --raised:#26272b; --line:#2e3035; --text:#dbdee1; --muted:#949ba4; --accent:#5865f2; --accent-soft:rgba(88,101,242,.18); --ok:#23a55a; --bad:#f23f43; --warn:#f0b232; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 system-ui, sans-serif; }
h1 { font-size:20px; margin:0; }
h2 { font-size:15px; margin:0 0 12px; }
main { max-width:1120px; margin:0 auto; padding:24px 16px 96px; }
.login { max-width:360px; padding-top:15vh; }
.login h1 { margin-bottom:16px; }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:20px; align-items:start; }
section { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:16px; }
label { display:block; color:var(--muted); font-size:12px; margin-bottom:10px; }
input, select { display:block; width:100%; margin-top:4px; padding:7px 10px; background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:6px; font:inherit; min-width:0; }
input:focus, select:focus { outline:2px solid var(--accent); outline-offset:-1px; border-color:transparent; }
.row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.check { display:flex; align-items:center; gap:8px; color:var(--text); font-size:14px; margin:4px 0 0; }
.check input { width:auto; margin:0; }
button, a.button { display:inline-block; padding:7px 14px; text-decoration:none; border:0; border-radius:6px; background:var(--line); color:var(--text); font:inherit; cursor:pointer; white-space:nowrap; }
button:hover:not(:disabled), a.button:hover { filter:brightness(1.2); }
button.primary { background:var(--accent); color:#fff; }
button.wide { width:100%; }
button:disabled { opacity:.4; cursor:default; }
.actions { display:flex; flex-wrap:wrap; gap:8px; }
.header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.spaced { margin-top:12px; }
.gone { display:none !important; }
.hidden { visibility:hidden; }
.hint { color:var(--muted); font-size:12px; margin:0 0 12px; }
.error { color:var(--bad); }
.chips { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:0 0 12px; font-size:12px; color:var(--muted); }
.chip { padding:2px 8px; border-radius:999px; background:var(--raised); border:1px solid var(--line); color:var(--text); font:12px ui-monospace, monospace; }
.chip:hover { border-color:var(--accent); }
.status { font-size:13px; white-space:pre-wrap; }
.status.ok { color:var(--ok); } .status.bad { color:var(--bad); } .status.warn { color:var(--warn); }
.sticky { position:sticky; top:16px; }
.card { background:#232428; border-radius:8px; overflow:hidden; transition:opacity .15s; }
.card.loading { opacity:.45; }
.card-top { padding:14px; border-bottom:1px solid var(--line); }
.card-user { font-size:11px; color:var(--muted); }
.card-hero { font-size:17px; font-weight:600; margin:6px 0 2px; }
.card-small { font-size:11px; color:var(--muted); word-break:break-word; }
.card-main { font-size:13px; margin-top:8px; }
.card-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:10px; }
.card-stat { padding:6px; border-radius:6px; cursor:pointer; border:1px solid transparent; }
.card-stat:hover, .card-stat.linked { background:var(--accent-soft); border-color:var(--accent); }
.stat-value { font-size:13px; word-break:break-word; }
.stat-label { font-size:10px; color:var(--muted); }
details { margin-top:10px; } summary { cursor:pointer; color:var(--muted); font-size:12px; }
pre { overflow:auto; max-height:280px; font-size:11px; background:var(--bg); padding:10px; border-radius:6px; margin:8px 0 0; }
dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; font-size:13px; }
dt { color:var(--muted); } dd { margin:0; }
.slot-head { display:grid; grid-template-columns:28px minmax(0,2fr) minmax(0,1fr) 64px; gap:8px; padding:0 10px 4px; color:var(--muted); font-size:11px; }
.slot { border:1px solid var(--line); border-radius:8px; padding:10px; margin-bottom:8px; background:var(--raised); transition:border-color .15s, box-shadow .15s; }
.slot.linked { border-color:var(--accent); }
.slot.flash { box-shadow:0 0 0 3px var(--accent-soft); }
.slot-main, .slot-text { display:grid; gap:8px; align-items:center; }
.slot-main { grid-template-columns:28px minmax(0,2fr) minmax(0,1fr) 64px; }
.slot-main.custom { grid-template-columns:28px minmax(0,2fr) minmax(0,1fr) 72px 64px; }
.slot-text { grid-template-columns:28px minmax(0,1fr) minmax(0,1fr); margin-top:8px; }
.slot input, .slot select { margin:0; }
.slot-num { width:24px; height:24px; border-radius:50%; background:var(--line); display:grid; place-items:center; font-size:12px; font-weight:600; cursor:help; }
.slot-move { display:flex; gap:4px; justify-content:flex-end; }
.slot-move button { padding:4px 9px; }
.savebar { position:fixed; left:0; right:0; bottom:0; background:rgba(30,31,34,.96); border-top:1px solid var(--line); backdrop-filter:blur(6px); z-index:10; }
.savebar-inner { max-width:1120px; margin:0 auto; padding:10px 16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.savebar .status { flex:1; min-width:160px; }
.kbd { color:var(--muted); font-size:11px; }
@media (max-width: 860px) {
  .layout { grid-template-columns:1fr; }
  .sticky { position:static; }
  main { padding:16px 10px 128px; }
  section { padding:12px; }
  .slot-head { display:none; }
  .slot-main, .slot-main.custom { grid-template-columns:28px minmax(0,1fr) 64px; }
  .slot-num { grid-column:1; grid-row:1; }
  .slot-metric { grid-column:2; grid-row:1; }
  .slot-move { grid-column:3; grid-row:1; }
  .slot-range { grid-column:2 / 4; grid-row:2; }
  .slot-custom { grid-column:2 / 4; grid-row:3; }
  .slot-text { grid-template-columns:28px minmax(0,1fr); }
  .slot-text .spacer { grid-row:1 / 3; }
  .slot-label, .slot-value { grid-column:2; }
  .kbd { display:none; }
}
`;

const ADMIN_BODY = `<main>
  <div class="header">
    <h1>Spotify Stats Admin</h1>
    <form method="post" action="/admin/logout"><button type="submit">登出</button></form>
  </div>
  <div class="layout">
    <div>
      <form id="settings">
        <section>
          <h2>統計區間</h2>
          <div class="row">
            <label>全域區間
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
          <div class="chips">點一下插入變數：
            <button type="button" class="chip" data-insert="{range}" title="4w / 90d / all time">{range}</button>
            <button type="button" class="chip" data-insert="{rangeLong}" title="4 Weeks / All Time">{rangeLong}</button>
            <button type="button" class="chip" data-insert="{count}" title="播放次數">{count}</button>
            <button type="button" class="chip" data-insert="{value}" title="統計格的數值（只用在數值格式）">{value}</button>
          </div>
          <div class="row">
            <label>Username<input name="username" maxlength="80"></label>
            <label>更新時間前綴（last_updated）<input name="lastUpdatedPrefix" maxlength="256"></label>
          </div>
          <label>Hero 標題（top_hero_title）<input name="topHeroTitle" maxlength="256"></label>
          <label>主標題（main_title）<input name="mainTitle" maxlength="256"></label>
        </section>
        <section>
          <h2>統計格</h2>
          <p class="hint">統計格內的變數套用該格自己的區間。換統計項目時，若標籤還是預設文字會自動換成新的預設標籤。點預覽裡的格子可以跳到對應設定。</p>
          <div class="slot-head"><span>#</span><span>統計項目</span><span>區間</span><span></span></div>
          <div id="slots"></div>
        </section>
      </form>
    </div>
    <div class="sticky">
      <section>
        <h2>預覽</h2>
        <div class="card" id="pCard">
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
        <div id="previewStatus" class="status spaced"></div>
        <details><summary>Payload JSON</summary><pre id="pJson"></pre></details>
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
        <div id="actionStatus" class="status spaced"></div>
        <details id="actionDetails" class="gone"><summary>原始回應</summary><pre id="actionJson"></pre></details>
      </section>
    </div>
  </div>
</main>
<div class="savebar">
  <div class="savebar-inner">
    <div id="saveStatus" class="status"></div>
    <span class="kbd">Ctrl/⌘ + S 儲存並推送</span>
    <button type="button" id="resetBtn">填回預設值</button>
    <button type="button" id="saveOnlyBtn">只儲存</button>
    <button type="button" class="primary" id="saveBtn">儲存並推送到 Discord</button>
  </div>
</div>`;

const ADMIN_SCRIPT = `
const PRESET_DAYS = ['7', '28', '90', '365'];
const SLOT_RANGES = [
  ['global', '跟隨全域'], ['7', '7 天'], ['28', '28 天'], ['90', '90 天'], ['180', '180 天'],
  ['365', '365 天'], ['all', '全部歷史'], ['custom', '自訂天數']
];
const form = document.getElementById('settings');
let defaults = null;
let metrics = [];
let fieldMap = null;
let savedSnapshot = null;
let previewTimer = null;
let previewSeq = 0;
let lastTextInput = null;
let busy = false;

const $ = (id) => document.getElementById(id);
const input = (name) => form.elements.namedItem(name);

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) {
    savedSnapshot = null;
    location.reload();
    throw new Error('登入已過期');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'HTTP ' + response.status);
  }
  return data;
}

function setStatus(id, text, tone) {
  const el = $(id);
  el.textContent = text;
  el.className = el.className.replace(/\\b(ok|bad|warn)\\b/g, '').trim() + (tone ? ' ' + tone : '');
}

function element(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...children);
  return el;
}

// ---- form <-> settings ----

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
  renderSlots(settings.widget.slots);
  toggleCustomDays();
}

function readForm() {
  const choice = input('rangeChoice').value;
  return {
    statsDays: choice === 'all' ? 'all' : Number(choice === 'custom' ? input('customDays').value : choice),
    recapEnabled: input('recapEnabled').checked,
    widget: {
      username: input('username').value,
      topHeroTitle: input('topHeroTitle').value,
      mainTitle: input('mainTitle').value,
      lastUpdatedPrefix: input('lastUpdatedPrefix').value,
      slots: readSlots()
    }
  };
}

function toggleCustomDays() {
  $('customDaysWrap').classList.toggle('hidden', input('rangeChoice').value !== 'custom');
}

// ---- slots ----

function metricLabel(id) {
  return metrics.find((metric) => metric.id === id)?.label ?? '';
}

function metricSelect(selected) {
  const select = element('select', { className: 'slot-metric', title: '統計項目' });
  select.setAttribute('aria-label', '統計項目');
  const groups = new Map();
  for (const metric of metrics) {
    if (!groups.has(metric.group)) {
      groups.set(metric.group, element('optgroup', { label: metric.group }));
      select.append(groups.get(metric.group));
    }
    groups.get(metric.group).append(element('option', { value: metric.id, textContent: metric.name }));
  }
  select.value = selected;
  select.dataset.previous = selected;
  return select;
}

function rangeSelect(range) {
  const select = element('select', { className: 'slot-range', title: '區間' });
  select.setAttribute('aria-label', '區間');
  for (const [value, text] of SLOT_RANGES) {
    select.append(element('option', { value, textContent: text }));
  }
  const known = SLOT_RANGES.some(([value]) => value === String(range));
  select.value = known ? String(range) : 'custom';
  return select;
}

function textInput(className, value, placeholder) {
  const el = element('input', { className, maxLength: 256, value, placeholder, title: placeholder });
  el.setAttribute('aria-label', placeholder);
  return el;
}

function renderSlots(slots) {
  const container = $('slots');
  container.replaceChildren();
  slots.forEach((slot, index) => {
    const range = rangeSelect(slot.range);
    const custom = element('input', {
      className: 'slot-custom', type: 'number', min: 1, max: 3650, step: 1, placeholder: '天數',
      value: typeof slot.range === 'number' ? slot.range : ''
    });
    custom.setAttribute('aria-label', '自訂天數');
    const up = element('button', { type: 'button', textContent: '↑', disabled: index === 0, title: '上移' });
    const down = element('button', { type: 'button', textContent: '↓', disabled: index === slots.length - 1, title: '下移' });
    up.addEventListener('click', () => moveSlot(index, -1));
    down.addEventListener('click', () => moveSlot(index, 1));
    const field = fieldMap?.slots?.[index]?.value ?? '';

    const main = element('div', { className: 'slot-main' }, [
      element('span', { className: 'slot-num', textContent: String(index + 1), title: 'Discord 欄位：' + field }),
      metricSelect(slot.metric),
      range,
      custom,
      element('div', { className: 'slot-move' }, [up, down])
    ]);
    const row = element('div', { className: 'slot' }, [
      main,
      element('div', { className: 'slot-text' }, [
        element('span', { className: 'spacer' }),
        textInput('slot-label', slot.label, '標籤'),
        textInput('slot-value', slot.value, '數值格式，例如 {value}')
      ])
    ]);
    row.dataset.index = String(index);
    row.addEventListener('mouseenter', () => linkSlot(index, true));
    row.addEventListener('mouseleave', () => linkSlot(index, row.contains(document.activeElement)));
    row.addEventListener('focusin', () => linkSlot(index, true));
    row.addEventListener('focusout', (event) => {
      if (!row.contains(event.relatedTarget)) linkSlot(index, false);
    });
    syncCustomVisibility(row);
    container.append(row);
  });
}

function syncCustomVisibility(row) {
  const isCustom = row.querySelector('.slot-range').value === 'custom';
  row.querySelector('.slot-custom').classList.toggle('gone', !isCustom);
  row.querySelector('.slot-main').classList.toggle('custom', isCustom);
}

function readSlots() {
  return [...$('slots').children].map((row) => {
    const range = row.querySelector('.slot-range').value;
    return {
      metric: row.querySelector('.slot-metric').value,
      range: range === 'global' || range === 'all'
        ? range
        : Number(range === 'custom' ? row.querySelector('.slot-custom').value : range),
      label: row.querySelector('.slot-label').value,
      value: row.querySelector('.slot-value').value
    };
  });
}

function moveSlot(index, offset) {
  const slots = readSlots();
  const target = index + offset;
  [slots[index], slots[target]] = [slots[target], slots[index]];
  renderSlots(slots);
  const moved = $('slots').children[target];
  moved.querySelector(offset < 0 ? '[title="上移"]' : '[title="下移"]')?.focus();
  flash(moved);
  onFormChanged();
}

// Swap in the new metric's default label unless the user already customised it.
function onSlotChange(event) {
  const row = event.target.closest('.slot');
  if (!row) return;
  if (event.target.classList.contains('slot-metric')) {
    const label = row.querySelector('.slot-label');
    const previous = event.target.dataset.previous;
    if (label.value.trim() === '' || label.value === metricLabel(previous)) {
      label.value = metricLabel(event.target.value);
    }
    event.target.dataset.previous = event.target.value;
    onFormChanged();
  }
  if (event.target.classList.contains('slot-range')) {
    syncCustomVisibility(row);
    if (event.target.value === 'custom') row.querySelector('.slot-custom').focus();
  }
}

function linkSlot(index, on) {
  $('slots').children[index]?.classList.toggle('linked', on);
  $('pStats').children[index]?.classList.toggle('linked', on);
}

function flash(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 700);
}

// ---- preview ----

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
  map.slots.forEach((slot, index) => {
    const cell = element('div', { className: 'card-stat', title: '跳到第 ' + (index + 1) + ' 格' }, [
      element('div', { className: 'stat-value', textContent: fields[slot.value] ?? '' }),
      element('div', { className: 'stat-label', textContent: fields[slot.label] ?? '' })
    ]);
    cell.addEventListener('click', () => {
      const row = $('slots').children[index];
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.querySelector('.slot-metric').focus({ preventScroll: true });
      flash(row);
    });
    statsEl.append(cell);
  });
  $('pJson').textContent = JSON.stringify({ username: payload.username, data: payload.data }, null, 2);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  $('pCard').classList.add('loading');
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
    setStatus('previewStatus', error.message, 'bad');
  } finally {
    if (seq === previewSeq) $('pCard').classList.remove('loading');
  }
}

// ---- save state ----

function isDirty() {
  return savedSnapshot !== null && JSON.stringify(readForm()) !== savedSnapshot;
}

function markSaved() {
  savedSnapshot = JSON.stringify(readForm());
}

function onFormChanged() {
  toggleCustomDays();
  schedulePreview();
  if (!busy) {
    setStatus('saveStatus', isDirty() ? '● 有未儲存的變更' : '已是最新', isDirty() ? 'warn' : '');
  }
}

async function save(push) {
  if (busy) return;
  busy = true;
  const buttons = [$('saveBtn'), $('saveOnlyBtn'), $('resetBtn')];
  buttons.forEach((button) => (button.disabled = true));
  try {
    setStatus('saveStatus', '儲存中…');
    await api('/admin/api/settings', { settings: readForm() });
    markSaved();
    if (push) {
      setStatus('saveStatus', '已儲存，推送中…');
      let result;
      try {
        result = await api('/admin/api/push', {});
      } catch (error) {
        setStatus('saveStatus', '✓ 已儲存，但推送失敗：' + error.message, 'warn');
        return;
      }
      showActionResult(result, syncSummary(result));
      setStatus(
        'saveStatus',
        result.discord?.patched ? '✓ 已儲存並推送到 Discord' : '✓ 已儲存（' + syncSummary(result) + '）',
        result.discord?.error ? 'warn' : 'ok'
      );
      await loadState();
    } else {
      setStatus('saveStatus', '✓ 已儲存，下次同步（10 分鐘內）會套用', 'ok');
    }
  } catch (error) {
    setStatus('saveStatus', error.message, 'bad');
  } finally {
    busy = false;
    buttons.forEach((button) => (button.disabled = false));
  }
}

// ---- status & actions ----

function renderStatus(status) {
  const list = $('statusList');
  list.replaceChildren();
  for (const [name, value] of status) {
    list.append(element('dt', { textContent: name }), element('dd', { textContent: value ?? '—' }));
  }
}

function syncSummary(result) {
  const plays = result.recentlyPlayed;
  const fetched = plays ? '抓到 ' + plays.fetched + ' 筆、新增 ' + plays.inserted + ' 筆' : '';
  const discord = result.discord?.patched
    ? 'Discord 已更新'
    : result.discord?.error
      ? 'widget 推送失敗：' + result.discord.error
      : 'Discord 未更新：' + (result.discord?.reason || 'unknown');
  return [fetched, discord].filter(Boolean).join('；');
}

function recapSummary(result) {
  return result.sent ? '已發送 ' + result.messages + ' 則 DM' : '未發送：' + (result.reason || 'unknown');
}

function showActionResult(result, summary) {
  setStatus('actionStatus', summary, result.discord?.error ? 'warn' : 'ok');
  $('actionJson').textContent = JSON.stringify(result, null, 2);
  $('actionDetails').classList.remove('gone');
}

async function runAction(button, path, summarize, confirmText) {
  if (confirmText && !confirm(confirmText)) return;
  button.disabled = true;
  setStatus('actionStatus', '執行中…');
  try {
    const result = await api(path, {});
    showActionResult(result, summarize(result));
    await loadState();
  } catch (error) {
    setStatus('actionStatus', error.message, 'bad');
  } finally {
    button.disabled = false;
  }
}

async function loadState() {
  const data = await api('/admin/api/state');
  defaults = data.defaults;
  metrics = data.metrics;
  fieldMap = data.fields;
  renderStatus(data.status);
  return data;
}

// ---- variable chips ----

document.addEventListener('focusin', (event) => {
  const el = event.target;
  if (el.tagName === 'INPUT' && el.type !== 'number' && el.type !== 'checkbox' && form.contains(el)) {
    lastTextInput = el;
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('mousedown', (event) => event.preventDefault());
  chip.addEventListener('click', () => {
    const target = lastTextInput;
    if (!target) {
      setStatus('saveStatus', '先點一下要插入的文字欄位', 'warn');
      return;
    }
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(chip.dataset.insert, start, end, 'end');
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

// ---- wiring ----

form.addEventListener('change', onSlotChange);
form.addEventListener('input', onFormChanged);
form.addEventListener('submit', (event) => { event.preventDefault(); save(true); });
$('saveBtn').addEventListener('click', () => save(true));
$('saveOnlyBtn').addEventListener('click', () => save(false));
$('resetBtn').addEventListener('click', () => {
  fillForm(defaults);
  onFormChanged();
  setStatus('saveStatus', '已填回預設值（尚未儲存）', 'warn');
});
$('syncBtn').addEventListener('click', (event) => runAction(event.currentTarget, '/admin/api/push', syncSummary));
$('weeklyBtn').addEventListener('click', (event) =>
  runAction(event.currentTarget, '/admin/recap/weekly/send', recapSummary, '要立即發送週報 DM 嗎？'));
$('monthlyBtn').addEventListener('click', (event) =>
  runAction(event.currentTarget, '/admin/recap/monthly/send', recapSummary, '要立即發送月報 DM 嗎？'));

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save(true);
  }
});

window.addEventListener('beforeunload', (event) => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

loadState()
  .then((data) => {
    fillForm(data.settings);
    renderPreview(data.payload, data.fields);
    markSaved();
    setStatus('saveStatus', '已是最新');
  })
  .catch((error) => setStatus('previewStatus', error.message, 'bad'));
`;

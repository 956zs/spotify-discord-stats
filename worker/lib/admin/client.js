// Browser scripts for the admin and login pages, sent inline under the CSP nonce.
// They expect `BOOT` (see admin-page.js) to be declared first. Plain ES2022, no
// inline handlers; every listener is attached with addEventListener.

// Shared by both pages: language detection, lookup, live switching.
export const I18N_RUNTIME = String.raw`
const I18N = BOOT.messages;
const LANG_STORAGE_KEY = 'sds-admin-lang';
const langListeners = [];

function detectLang() {
  let stored = null;
  try { stored = localStorage.getItem(LANG_STORAGE_KEY); } catch {}
  if (stored && I18N[stored]) return stored;
  return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

let lang = detectLang();

function hasMessage(key) {
  return Boolean(I18N[lang] && Object.prototype.hasOwnProperty.call(I18N[lang], key));
}

function t(key, vars) {
  const table = I18N[lang] || {};
  const template = table[key] ?? I18N['zh-TW'][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    }
  });
  document.querySelectorAll('[data-lang]').forEach((button) => {
    const on = button.dataset.lang === lang;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

function setLang(next) {
  if (!I18N[next]) return;
  lang = next;
  try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch {}
  applyI18n();
  langListeners.forEach((listener) => listener());
}

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => setLang(button.dataset.lang));
});
applyI18n();
`;

export const ADMIN_CLIENT = String.raw`
const PRESET_DAYS = ['7', '28', '90', '365'];
const HERO_PATH = BOOT.heroPath;
const HERO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const HERO_MAX_BYTES = BOOT.heroMaxBytes;
const CROP_WIDTH = BOOT.crop.width;
const CROP_HEIGHT = BOOT.crop.height;
const CROP_MAX_ZOOM = BOOT.crop.maxZoom;
// Tried in order when the cropped PNG is over the upload limit.
const CROP_FALLBACKS = [['image/webp', 0.92], ['image/webp', 0.85], ['image/jpeg', 0.9]];
const IMAGE_FORMAT_NAMES = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/gif': 'GIF' };
const EDITOR_HOME = 'https://discord.com/developers/applications';
const SLOT_RANGES = ['global', '7', '28', '90', '180', '365', 'all', 'custom'];
const TABS = ['widget', 'hero', 'recap', 'status'];
const TEXT_FIELDS = ['username', 'topHeroTitle', 'mainTitle', 'lastUpdatedPrefix'];
// Settings text field -> key in the widget field map (username is the payload's own field).
const FIELD_NAMES = { topHeroTitle: 'topHeroTitle', mainTitle: 'mainTitle', lastUpdatedPrefix: 'lastUpdated' };
const PREVIEW_DELAY_MS = 400;
const TOAST_MS = 4500;
const FLASH_MS = 900;
const narrow = matchMedia('(max-width: 899px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const form = document.getElementById('settings');
let defaults = null;
let metrics = [];
let fieldMap = null;
let heroState = { upload: null, publicBaseUrl: null };
let albumImageUrl = null;
let discordClientId = null;
let recapSchedule = null;
let statusData = null;
let heroStepsOpen = false;
let crop = null;
let cropFrame = 0;
let lastPayload = null;
let savedSettings = null;
let previewTimer = null;
let previewSeq = 0;
let lastTextInput = null;
let busy = false;
let toastTimer = 0;
// Status lines keep their message (text or a function of the language) so they can be
// re-rendered when the language changes.
const statusLines = new Map();
const results = {};

const $ = (id) => document.getElementById(id);
const input = (name) => form.elements.namedItem(name);

function element(tag, props = {}, children = [], attrs = {}) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.append(...children);
  return el;
}

function svgIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'i');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

function scrollBehavior() {
  return reducedMotion.matches ? 'auto' : 'smooth';
}

function locale() {
  return lang === 'en' ? 'en' : 'zh-TW';
}

// ---- errors ----

class ApiError extends Error {
  constructor(data, status) {
    super(data.error || 'HTTP ' + status);
    this.code = data.code || null;
    this.details = Array.isArray(data.details) ? data.details : null;
    this.status = status;
    this.serverMessage = data.error || null;
    this.raw = data;
  }
}

function networkError() {
  const error = new Error('network');
  error.network = true;
  return error;
}

// Translated by code when the page knows it, else the server's own message.
function errorText(error) {
  if (!error) return '';
  if (error.network) return t('err.network');
  if (error.code && hasMessage('err.' + error.code)) {
    const message = t('err.' + error.code);
    return error.details?.length ? t('err.withDetails', { message, details: error.details.join('; ') }) : message;
  }
  if (error.status && !error.serverMessage) return t('err.http', { status: error.status });
  return error.message || String(error);
}

async function api(path, body, options = {}) {
  let response;
  try {
    response = await fetch(path, body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': options.type || 'application/json' },
      body: options.raw ? body : JSON.stringify(body)
    });
  } catch {
    throw networkError();
  }
  if (response.status === 401) {
    // Session expired: reload shows the sign-in page.
    savedSettings = null;
    location.reload();
    throw new ApiError({ error: 'unauthorized', code: 'unauthorized' }, 401);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data, response.status);
  return data;
}

// ---- status lines ----

function resolveMessage(message) {
  return typeof message === 'function' ? message() : (message ?? '');
}

function setStatus(id, message, tone = '') {
  statusLines.set(id, { message, tone });
  renderStatusLine(id);
}

function renderStatusLine(id) {
  const el = $(id);
  const line = statusLines.get(id) || { message: '', tone: '' };
  el.textContent = resolveMessage(line.message);
  el.classList.remove('ok', 'bad', 'warn');
  if (line.tone) el.classList.add(line.tone);
}

function statusTone(id) {
  return statusLines.get(id)?.tone || '';
}

function showToast(text) {
  $('toastText').textContent = text;
  $('toast').classList.remove('gone');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('gone'), TOAST_MS);
}

// ---- formatting ----

function daysText(n) {
  return t(Math.abs(n) === 1 ? 'unit.day' : 'unit.days', { n });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(date);
}

function isToday(date) {
  return date.toDateString() === new Date().toDateString();
}

function formatShort(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const options = isToday(date)
    ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  return new Intl.DateTimeFormat(locale(), options).format(date);
}

function formatAgo(value) {
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const minutes = Math.round(ms / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

// ---- tabs ----

function showTab(name, options = {}) {
  const tab = TABS.includes(name) ? name : 'widget';
  for (const id of TABS) {
    const on = id === tab;
    const button = $('tab-' + id);
    button.classList.toggle('on', on);
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
    $('pane-' + id).hidden = !on;
  }
  if (options.focus) $('tab-' + tab).focus();
  if (options.updateHash !== false && location.hash !== '#' + tab) {
    history.replaceState(null, '', '#' + tab);
  }
  return tab;
}

function activeTab() {
  return TABS.find((id) => !$('pane-' + id).hidden) || 'widget';
}

function onTabKey(event) {
  const index = TABS.indexOf(activeTab());
  const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 };
  if (!(event.key in moves)) return;
  event.preventDefault();
  const next = (moves[event.key] + TABS.length) % TABS.length;
  showTab(TABS[next], { focus: true });
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
  input('heroImage').value = settings.widget.heroImage || 'asset';
  input('heroEditorConfirmed').checked = settings.widget.heroEditorConfirmed === true;
  heroStepsOpen = false;
  for (const name of TEXT_FIELDS) {
    input(name).value = settings.widget[name];
  }
  renderSlots(settings.widget.slots);
  syncRangeControls();
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
      heroImage: heroMode(),
      heroEditorConfirmed: input('heroEditorConfirmed').checked,
      slots: readSlots()
    }
  };
}

function syncRangeControls() {
  const custom = input('rangeChoice').value === 'custom';
  $('customDaysWrap').classList.toggle('off', !custom);
  input('customDays').disabled = !custom;
  $('rangeSeg').querySelectorAll('label').forEach((label) => {
    label.classList.toggle('on', label.querySelector('input').checked);
  });
}

// ---- hero image ----

function heroMode() {
  return input('heroImage').value || 'asset';
}

// Upload/album modes need the widget editor change, which the Worker cannot check.
function heroPending() {
  return heroMode() !== 'asset' && !input('heroEditorConfirmed').checked;
}

// The payload points at the public URL (PUBLIC_BASE_URL); the preview loads the same
// file from this origin so it also works on wrangler dev.
function heroPreviewSrc(url) {
  try {
    const parsed = new URL(url, location.origin);
    return parsed.pathname === HERO_PATH ? parsed.pathname + parsed.search : parsed.href;
  } catch {
    return '';
  }
}

function heroFieldUrl(payload, map) {
  const field = payload?.data?.dynamic?.find((entry) => entry.name === map?.heroImage && entry.type === 3);
  return field?.value?.url || '';
}

// Swaps an <img> into a box only when the source changes, else shows the empty text.
function setThumb(box, src, alt, emptyText) {
  const current = box.querySelector('img');
  if (src) {
    if (current && current.getAttribute('src') === src) {
      current.alt = alt;
      return;
    }
    box.replaceChildren(element('img', { src, alt }));
  } else {
    box.replaceChildren(emptyText);
  }
}

function renderHero() {
  const mode = heroMode();
  const upload = heroState.upload;
  document.querySelectorAll('.mode').forEach((card) => {
    card.classList.toggle('on', card.dataset.mode === mode);
  });
  setThumb($('modeThumbUpload'), upload?.url, '', t('hero.thumb.noUpload'));
  setThumb($('modeThumbAlbum'), albumImageUrl ? heroPreviewSrc(albumImageUrl) : '', '', t('hero.thumb.noAlbum'));
  $('heroUploadBox').classList.toggle('gone', mode !== 'upload');
  setThumb($('heroThumb'), upload?.url, t('hero.current'), t('hero.thumb.noUpload'));
  $('heroMeta').textContent = upload
    ? t('hero.meta', {
      type: IMAGE_FORMAT_NAMES[upload.contentType] || upload.contentType,
      size: formatSize(upload.size),
      date: formatDateTime(upload.updatedAt)
    })
    : '';
  $('heroMeta').classList.toggle('gone', !upload);
  $('heroDeleteBtn').disabled = !upload;
  renderHeroEditorNote(mode);
  $('heroBadge').classList.toggle('gone', !heroPending());

  const hasImage = Boolean(heroFieldUrl(lastPayload, fieldMap));
  let warning = '';
  if (mode === 'upload' && !heroState.publicBaseUrl) {
    warning = 'hero.warn.noBaseUrl';
  } else if (mode === 'upload' && !upload) {
    warning = 'hero.warn.noUpload';
  } else if (mode === 'album' && lastPayload && !hasImage) {
    warning = 'hero.warn.noAlbum';
  }
  // Keep a fresh upload/delete result; only replace an earlier warning.
  if (warning) {
    setStatus('heroStatus', () => t(warning), 'warn');
  } else if (statusTone('heroStatus') === 'warn') {
    setStatus('heroStatus', '');
  }
}

function widgetEditorUrl(clientId) {
  return /^\d+$/.test(clientId || '') ? EDITOR_HOME + '/' + clientId + '/widget' : EDITOR_HOME;
}

function renderHeroEditorNote(mode) {
  const confirmed = input('heroEditorConfirmed').checked;
  const collapsed = confirmed && !heroStepsOpen;
  const box = $('heroEditorBox');
  box.classList.toggle('gone', mode === 'asset');
  box.classList.toggle('done', collapsed);
  $('heroEditorSteps').classList.toggle('gone', collapsed);
  $('heroEditorDone').classList.toggle('gone', !collapsed);
  $('heroEditorLink').href = widgetEditorUrl(discordClientId);
  $('heroEditorField').textContent = fieldMap?.heroImage || 'hero_image';
}

function checkHeroFile(file) {
  if (!HERO_TYPES.includes(file.type)) return () => t('err.image_type');
  if (file.size > HERO_MAX_BYTES) {
    const size = formatSize(file.size);
    return () => t('hero.tooBig', { size });
  }
  return null;
}

// Uploads through the same route and server-side checks for cropped and original files.
async function sendHero(body, type, done) {
  const data = await api('/admin/api/hero-image', body, { type, raw: true });
  heroState = data.heroImage;
  $('heroFile').value = '';
  renderHero();
  setStatus('heroStatus', () => '✓ ' + t('hero.uploaded', { what: done() }), 'ok');
  schedulePreview();
}

// ---- hero crop tool ----

async function openCrop(file) {
  if (!HERO_TYPES.includes(file.type)) {
    setStatus('heroStatus', () => t('err.image_type'), 'bad');
    $('heroFile').value = '';
    return;
  }
  let bitmap;
  try {
    // Decoding the file directly keeps object URLs (and a blob: img-src) out of the CSP.
    bitmap = await createImageBitmap(file);
  } catch {
    setStatus('heroStatus', () => t('hero.unreadable'), 'bad');
    $('heroFile').value = '';
    return;
  }
  releaseCrop();
  const baseScale = Math.max(CROP_WIDTH / bitmap.width, CROP_HEIGHT / bitmap.height);
  crop = { file, bitmap, baseScale, zoom: 1, x: 0, y: 0, drag: null };
  centerCrop();
  setZoomControl(1);
  $('cropGifHint').classList.toggle('gone', file.type !== 'image/gif');
  const source = { w: bitmap.width, h: bitmap.height, size: formatSize(file.size), ow: CROP_WIDTH, oh: CROP_HEIGHT };
  setStatus('cropStatus', () => t('crop.source', source));
  setCropBusy(false);
  drawCrop();
  if (!$('cropDialog').open) $('cropDialog').showModal();
  $('cropStage').focus();
}

function releaseCrop() {
  crop?.bitmap.close();
  crop = null;
}

function closeCrop() {
  releaseCrop();
  if ($('cropDialog').open) $('cropDialog').close();
  $('heroFile').value = '';
}

function cancelCrop() {
  if ($('cropApplyBtn').disabled) return;
  closeCrop();
  setStatus('heroStatus', () => t('hero.cancelled'));
  $('heroUploadBtn').focus();
}

function cropScale() {
  return crop.baseScale * crop.zoom;
}

function centerCrop() {
  crop.x = (CROP_WIDTH - crop.bitmap.width * cropScale()) / 2;
  crop.y = (CROP_HEIGHT - crop.bitmap.height * cropScale()) / 2;
}

// The image always covers the whole frame, so the output never has empty edges.
function clampCrop() {
  const width = crop.bitmap.width * cropScale();
  const height = crop.bitmap.height * cropScale();
  crop.x = Math.min(0, Math.max(CROP_WIDTH - width, crop.x));
  crop.y = Math.min(0, Math.max(CROP_HEIGHT - height, crop.y));
}

function paintCrop(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, CROP_WIDTH, CROP_HEIGHT);
  ctx.drawImage(crop.bitmap, crop.x, crop.y, crop.bitmap.width * cropScale(), crop.bitmap.height * cropScale());
}

function drawCrop() {
  cancelAnimationFrame(cropFrame);
  cropFrame = requestAnimationFrame(() => {
    if (crop) paintCrop($('cropCanvas').getContext('2d'));
  });
}

function setZoomControl(zoom) {
  $('cropZoom').value = String(zoom);
  $('cropZoomValue').textContent = zoom.toFixed(1) + '×';
}

// Zooms around a point of the frame (in output pixels), keeping that point still.
function zoomCrop(zoom, anchorX = CROP_WIDTH / 2, anchorY = CROP_HEIGHT / 2) {
  if (!crop) return;
  const next = Math.min(CROP_MAX_ZOOM, Math.max(1, zoom));
  const ratio = (crop.baseScale * next) / cropScale();
  crop.x = anchorX - (anchorX - crop.x) * ratio;
  crop.y = anchorY - (anchorY - crop.y) * ratio;
  crop.zoom = next;
  clampCrop();
  setZoomControl(next);
  drawCrop();
}

function moveCrop(dx, dy) {
  crop.x += dx;
  crop.y += dy;
  clampCrop();
  drawCrop();
}

// Display pixels -> output pixels.
function stageFactor() {
  return CROP_WIDTH / $('cropStage').clientWidth;
}

function stagePoint(event) {
  const rect = $('cropStage').getBoundingClientRect();
  return [(event.clientX - rect.left) * stageFactor(), (event.clientY - rect.top) * stageFactor()];
}

function onCropPointerDown(event) {
  if (!crop || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  $('cropStage').setPointerCapture(event.pointerId);
  $('cropStage').classList.add('dragging');
  crop.drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: crop.x, y: crop.y };
}

function onCropPointerMove(event) {
  const drag = crop?.drag;
  if (!drag || drag.id !== event.pointerId) return;
  crop.x = drag.x + (event.clientX - drag.clientX) * stageFactor();
  crop.y = drag.y + (event.clientY - drag.clientY) * stageFactor();
  clampCrop();
  drawCrop();
}

function onCropPointerUp(event) {
  if (crop?.drag?.id !== event.pointerId) return;
  crop.drag = null;
  $('cropStage').classList.remove('dragging');
}

function onCropWheel(event) {
  if (!crop) return;
  event.preventDefault();
  const [x, y] = stagePoint(event);
  zoomCrop(crop.zoom * Math.exp(-event.deltaY * 0.0015), x, y);
}

function onCropKey(event) {
  if (!crop) return;
  const step = event.shiftKey ? 60 : 15;
  const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (moves[event.key]) {
    event.preventDefault();
    moveCrop(...moves[event.key]);
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    zoomCrop(crop.zoom * 1.1);
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault();
    zoomCrop(crop.zoom / 1.1);
  }
}

function setCropBusy(on) {
  for (const id of ['cropApplyBtn', 'cropRawBtn', 'cropCancelBtn', 'cropCloseBtn', 'cropZoom']) {
    $(id).disabled = on;
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// PNG first; over the limit, lossy formats in order. A browser that cannot encode a
// type returns PNG instead, so the blob's own type is checked.
async function encodeCrop(canvas) {
  const png = await canvasBlob(canvas, 'image/png');
  if (png && png.size <= HERO_MAX_BYTES) return png;
  for (const [type, quality] of CROP_FALLBACKS) {
    const blob = await canvasBlob(canvas, type, quality);
    if (blob && blob.type === type && blob.size <= HERO_MAX_BYTES) return blob;
  }
  return null;
}

async function applyCrop() {
  if (!crop) return;
  setCropBusy(true);
  setStatus('cropStatus', () => t('crop.working'));
  try {
    const canvas = element('canvas', { width: CROP_WIDTH, height: CROP_HEIGHT });
    paintCrop(canvas.getContext('2d'));
    const blob = await encodeCrop(canvas);
    if (!blob) {
      setStatus('cropStatus', () => t('crop.tooBig'), 'bad');
      return;
    }
    const summary = IMAGE_FORMAT_NAMES[blob.type] + ' ' + CROP_WIDTH + '×' + CROP_HEIGHT + ', ' + formatSize(blob.size);
    setStatus('cropStatus', () => t('crop.uploadingSummary', { summary }));
    await sendHero(blob, blob.type, () => t('hero.uploadedCrop', { summary }));
    closeCrop();
  } catch (error) {
    setStatus('cropStatus', () => errorText(error), 'bad');
  } finally {
    setCropBusy(false);
  }
}

// The original file as before (keeps GIF animation); same type and size checks.
async function uploadRawHero() {
  if (!crop) return;
  const file = crop.file;
  const problem = checkHeroFile(file);
  if (problem) {
    setStatus('cropStatus', problem, 'bad');
    return;
  }
  setCropBusy(true);
  setStatus('cropStatus', () => t('crop.uploading'));
  try {
    const summary = IMAGE_FORMAT_NAMES[file.type] + ', ' + formatSize(file.size);
    await sendHero(file, file.type, () => t('hero.uploadedRaw', { summary }));
    closeCrop();
  } catch (error) {
    setStatus('cropStatus', () => errorText(error), 'bad');
  } finally {
    setCropBusy(false);
  }
}

async function deleteHero() {
  if (!confirm(t('hero.deleteConfirm'))) return;
  const button = $('heroDeleteBtn');
  button.disabled = true;
  try {
    const data = await api('/admin/api/hero-image/delete', {});
    heroState = data.heroImage;
    renderHero();
    setStatus('heroStatus', () => '✓ ' + t('hero.deleted'), 'ok');
    schedulePreview();
  } catch (error) {
    setStatus('heroStatus', () => errorText(error), 'bad');
    button.disabled = !heroState.upload;
  }
}

// ---- slots ----

function metricLabel(id) {
  return metrics.find((metric) => metric.id === id)?.label ?? '';
}

function metricName(metric) {
  return lang === 'en' ? metric.nameEn || metric.name : metric.name;
}

function metricGroup(metric) {
  return lang === 'en' ? metric.groupEn || metric.group : metric.group;
}

function slotRangeText(value) {
  if (value === 'global') return t('slotRange.global');
  if (value === 'all') return t('slotRange.all');
  if (value === 'custom') return t('slotRange.custom');
  return t('slotRange.days', { n: value });
}

function metricSelect(selected, index) {
  const select = element('select', { className: 'inp sm slot-metric' }, [], { 'aria-label': t('slots.metric') + ' ' + (index + 1) });
  const groups = new Map();
  for (const metric of metrics) {
    if (!groups.has(metric.group)) {
      groups.set(metric.group, element('optgroup', { label: metricGroup(metric) }));
      select.append(groups.get(metric.group));
    }
    groups.get(metric.group).append(element('option', { value: metric.id, textContent: metricName(metric) }));
  }
  select.value = selected;
  select.dataset.previous = selected;
  return select;
}

function rangeSelect(range, index) {
  const select = element('select', { className: 'inp sm slot-range' }, [], { 'aria-label': t('slots.range') + ' ' + (index + 1) });
  for (const value of SLOT_RANGES) {
    select.append(element('option', { value, textContent: slotRangeText(value) }));
  }
  select.value = SLOT_RANGES.includes(String(range)) ? String(range) : 'custom';
  return select;
}

function slotInput(className, value, placeholder, label) {
  return element('input', { className: 'inp sm ' + className, type: 'text', maxLength: 256, value, placeholder, spellcheck: false },
    [], { 'aria-label': label, autocomplete: 'off' });
}

function renderSlots(slots) {
  const container = $('slots');
  container.replaceChildren();
  slots.forEach((slot, index) => {
    const n = index + 1;
    const custom = element('input', {
      className: 'inp sm slot-custom', type: 'number', min: 1, max: 3650, step: 1, placeholder: t('slots.days'),
      value: typeof slot.range === 'number' ? slot.range : ''
    }, [], { 'aria-label': t('slotRange.custom') + ' ' + n, inputmode: 'numeric' });
    const up = element('button', { type: 'button', className: 'btn ghost icon sm', disabled: index === 0, title: t('slots.up') },
      [svgIcon('up')], { 'aria-label': t('slots.up') + ' ' + n, 'data-dir': 'up' });
    const down = element('button', { type: 'button', className: 'btn ghost icon sm', disabled: index === slots.length - 1, title: t('slots.down') },
      [svgIcon('down')], { 'aria-label': t('slots.down') + ' ' + n, 'data-dir': 'down' });
    up.addEventListener('click', () => moveSlot(index, -1));
    down.addEventListener('click', () => moveSlot(index, 1));
    const field = fieldMap?.slots?.[index]?.value ?? '';

    const row = element('div', { className: 'slotrow' }, [
      element('span', { className: 'num', textContent: String(n), title: t('slots.field', { field }) }),
      metricSelect(slot.metric, index),
      element('div', { className: 'rangecell' }, [rangeSelect(slot.range, index), custom]),
      slotInput('slot-label', slot.label, t('slots.label'), t('field.slotLabel', { n })),
      slotInput('mono slot-value', slot.value, t('slots.valuePlaceholder'), t('field.slotValue', { n })),
      element('div', { className: 'move' }, [up, down])
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
  if (lastTextInput && !document.contains(lastTextInput)) {
    lastTextInput = null;
    renderChipTarget();
  }
}

function syncCustomVisibility(row) {
  const isCustom = row.querySelector('.slot-range').value === 'custom';
  row.querySelector('.slot-custom').classList.toggle('gone', !isCustom);
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
  const button = moved.querySelector(offset < 0 ? '[data-dir="up"]' : '[data-dir="down"]');
  (button && !button.disabled ? button : moved.querySelector('.slot-metric')).focus();
  flash(moved);
  onFormChanged();
}

// Swap in the new metric's default label unless the user already customised it.
function onFormChange(event) {
  const target = event.target;
  if (target.name === 'rangeChoice') {
    syncRangeControls();
    if (target.value === 'custom') input('customDays').focus();
    return;
  }
  if (target.name === 'heroEditorConfirmed') {
    heroStepsOpen = false;
    renderHero();
    return;
  }
  const row = target.closest('.slotrow');
  if (!row) return;
  if (target.classList.contains('slot-metric')) {
    const label = row.querySelector('.slot-label');
    const previous = target.dataset.previous;
    if (label.value.trim() === '' || label.value === metricLabel(previous)) {
      label.value = metricLabel(target.value);
    }
    target.dataset.previous = target.value;
    onFormChanged();
  }
  if (target.classList.contains('slot-range')) {
    syncCustomVisibility(row);
    if (target.value === 'custom') row.querySelector('.slot-custom').focus();
  }
}

function linkSlot(index, on) {
  $('slots').children[index]?.classList.toggle('linked', on);
  $('pStats').children[index]?.classList.toggle('linked', on);
}

function flash(el) {
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), FLASH_MS);
}

// ---- preview ----

function renderPreview(payload, map) {
  lastPayload = payload;
  const heroUrl = heroFieldUrl(payload, map);
  const heroImg = $('pHeroImg');
  heroImg.classList.toggle('gone', !heroUrl);
  $('pTop').classList.toggle('with-hero', Boolean(heroUrl));
  if (heroUrl) {
    const src = heroPreviewSrc(heroUrl);
    if (heroImg.getAttribute('src') !== src) heroImg.src = src;
    heroImg.title = t('preview.jumpHero');
  } else {
    heroImg.removeAttribute('src');
  }
  const fields = Object.fromEntries(payload.data.dynamic.map((field) => [field.name, field.value]));
  const parts = [
    ['pUser', payload.username, 'field.username'],
    ['pHero', fields[map.topHeroTitle], 'field.topHeroTitle'],
    ['pDuring', fields[map.during], null],
    ['pUpdated', fields[map.lastUpdated], 'field.lastUpdatedPrefix'],
    ['pSong', fields[map.song], null],
    ['pMain', fields[map.mainTitle], 'field.mainTitle']
  ];
  for (const [id, value, key] of parts) {
    const el = $(id);
    el.textContent = value ?? '';
    el.title = key ? t('preview.jumpField', { field: t(key) }) : t('preview.autoTitle');
  }
  $('pDuring').title = t('preview.jumpRange');
  const statsEl = $('pStats');
  statsEl.replaceChildren();
  map.slots.forEach((slot, index) => {
    const linked = $('slots').children[index]?.classList.contains('linked');
    const cell = element('div', { className: 'wstat jump' + (linked ? ' linked' : ''), tabIndex: 0, title: t('preview.jumpSlot', { n: index + 1 }) }, [
      element('div', { className: 'wval', textContent: fields[slot.value] ?? '' }),
      element('div', { className: 'wlab', textContent: fields[slot.label] ?? '' })
    ], { role: 'button', 'data-jump': 'slot', 'data-index': String(index) });
    statsEl.append(cell);
  });
  renderJson(payload);
  renderPeek(fields, map, heroUrl);
  renderHero();
}

function renderPeek(fields, map, heroUrl) {
  $('peekTitle').textContent = fields[map.topHeroTitle] ?? '';
  const values = map.slots.slice(0, 3).map((slot) => fields[slot.value]).filter(Boolean);
  $('peekStats').textContent = values.join(' · ') + (map.slots.length > 3 ? ' …' : '');
  const thumb = $('peekThumb');
  if (heroUrl) {
    setThumb(thumb, heroPreviewSrc(heroUrl), '', '');
  } else if (thumb.querySelector('img') || !thumb.firstChild) {
    thumb.replaceChildren(svgIcon('image'));
  }
}

// JSON with token colours, built from text nodes (never innerHTML).
function renderJson(payload) {
  const text = JSON.stringify({ username: payload.username, data: payload.data }, null, 2);
  const pre = $('pJson');
  pre.replaceChildren();
  const tokens = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g;
  let last = 0;
  for (const match of text.matchAll(tokens)) {
    pre.append(text.slice(last, match.index));
    if (match[1]) {
      pre.append(element('span', { className: match[2] ? 'k' : 's', textContent: match[1] }));
      if (match[2]) pre.append(match[2]);
    } else {
      pre.append(element('span', { className: 'n', textContent: match[3] }));
    }
    last = match.index + match[0].length;
  }
  pre.append(text.slice(last));
}

function setPreviewView(json) {
  $('pCard').classList.toggle('gone', json);
  $('pJson').classList.toggle('gone', !json);
  $('viewCard').classList.toggle('on', !json);
  $('viewJson').classList.toggle('on', json);
  $('viewCard').setAttribute('aria-pressed', String(!json));
  $('viewJson').setAttribute('aria-pressed', String(json));
}

function schedulePreview() {
  clearTimeout(previewTimer);
  setPreviewLoading(true);
  previewTimer = setTimeout(refreshPreview, PREVIEW_DELAY_MS);
}

function setPreviewLoading(on) {
  $('pCard').classList.toggle('loading', on);
  $('previewSide').classList.toggle('loading', on);
}

async function refreshPreview() {
  const seq = ++previewSeq;
  try {
    const data = await api('/admin/api/preview', { settings: readForm() });
    if (seq !== previewSeq) return;
    albumImageUrl = data.albumImageUrl ?? null;
    renderPreview(data.payload, data.fields);
    setStatus('previewStatus', '');
  } catch (error) {
    if (seq !== previewSeq) return;
    setStatus('previewStatus', () => errorText(error), 'bad');
  } finally {
    if (seq === previewSeq) setPreviewLoading(false);
  }
}

// ---- mobile preview sheet ----

function setSheet(open) {
  $('previewSide').classList.toggle('open', open);
  $('peekBtn').setAttribute('aria-expanded', String(open));
}

// ---- click-to-jump from the preview ----

function focusField(el, highlight) {
  el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  el.focus({ preventScroll: true });
  flash(highlight || el);
}

function jumpTo(target, index) {
  if (narrow.matches) setSheet(false);
  if (target === 'song') {
    showToast(t('preview.autoSong'));
    return;
  }
  if (target === 'hero') {
    showTab('hero');
    const checked = form.querySelector('input[name="heroImage"]:checked') || form.querySelector('input[name="heroImage"]');
    $('heroPanel').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    checked.focus({ preventScroll: true });
    flash($('heroPanel'));
    return;
  }
  showTab('widget');
  if (target === 'slot') {
    const row = $('slots').children[index];
    if (!row) return;
    linkSlot(index, true);
    focusField(row.querySelector('.slot-metric'), row);
    return;
  }
  if (target === 'during') {
    const radio = form.querySelector('input[name="rangeChoice"]:checked') || form.querySelector('input[name="rangeChoice"]');
    focusField(radio, $('rangePanel'));
    showToast(t('preview.autoDuring'));
    return;
  }
  const field = input(target);
  if (field) focusField(field, field.closest('.field'));
}

function onPreviewActivate(event) {
  const part = event.target.closest('[data-jump]');
  if (!part) return;
  if (event.type === 'keydown') {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
  }
  jumpTo(part.dataset.jump, Number(part.dataset.index));
}

// ---- save state ----

function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? prefix + '.' + key : key, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

// Number of changed leaf settings (text fields, slot parts, toggles) since the last save.
function dirtyCount() {
  if (savedSettings === null) return 0;
  const now = flatten(readForm());
  const saved = flatten(savedSettings);
  let count = 0;
  for (const key of new Set([...Object.keys(now), ...Object.keys(saved)])) {
    if (!Object.is(now[key], saved[key])) count += 1;
  }
  return count;
}

function isDirty() {
  return dirtyCount() > 0;
}

function markSaved() {
  savedSettings = readForm();
}

function renderSaveStatus() {
  if (busy) return;
  const count = dirtyCount();
  if (count > 0) {
    setStatus('saveStatus', () => {
      const n = dirtyCount();
      return n === 1 ? t('save.dirtyOne') : t('save.dirty', { n });
    }, 'warn');
  } else {
    setStatus('saveStatus', () => t('save.clean'));
  }
}

function onFormChanged() {
  syncRangeControls();
  renderHero();
  schedulePreview();
  renderSaveStatus();
}

async function save(push) {
  if (busy) return;
  busy = true;
  const buttons = [$('saveBtn'), $('saveOnlyBtn'), $('resetBtn')];
  buttons.forEach((button) => (button.disabled = true));
  try {
    setStatus('saveStatus', () => t('save.saving'));
    await api('/admin/api/settings', { settings: readForm() });
    markSaved();
    if (push) {
      setStatus('saveStatus', () => t('save.pushing'));
      let result;
      try {
        result = await api('/admin/api/push', {});
      } catch (error) {
        setStatus('saveStatus', () => t('save.pushFailed', { error: errorText(error) }), 'warn');
        showResult('action', 'bad', () => errorText(error), error.raw ?? { error: error.message });
        return;
      }
      showResult('action', result.discord?.error ? 'warn' : 'ok', () => syncSummary(result), result);
      setStatus(
        'saveStatus',
        () => (result.discord?.patched ? t('save.pushed') : t('save.savedWith', { summary: syncSummary(result) })),
        result.discord?.error ? 'warn' : 'ok'
      );
      await loadState();
    } else {
      setStatus('saveStatus', () => t('save.saved'), 'ok');
    }
  } catch (error) {
    setStatus('saveStatus', () => errorText(error), 'bad');
  } finally {
    busy = false;
    buttons.forEach((button) => (button.disabled = false));
  }
}

// ---- status & actions ----

function authTone(spotify) {
  if (!spotify.authorizedAt || spotify.daysLeft === null) return 'bad';
  if (spotify.daysLeft <= 0) return 'bad';
  return spotify.daysLeft <= spotify.remindDays ? 'warn' : 'ok';
}

function setPill(id, tone, text, value) {
  const pill = $(id);
  pill.classList.remove('ok', 'warn', 'bad');
  if (tone) pill.classList.add(tone);
  pill.querySelector('.pill-text').textContent = text;
  pill.querySelector('.pill-value').textContent = value;
}

function renderStatus(status) {
  statusData = status;
  const spotify = status.spotify;
  const tone = authTone(spotify);
  if (!spotify.authorizedAt || spotify.daysLeft === null) {
    setPill('pillAuth', tone, t('pill.authNone'), '');
  } else if (spotify.daysLeft <= 0) {
    setPill('pillAuth', tone, t('pill.authExpired'), '');
  } else {
    setPill('pillAuth', tone, t('pill.auth'), daysText(spotify.daysLeft));
  }
  const pushedAt = status.discord.lastPushedAt;
  setPill('pillPush', '', pushedAt ? t('pill.pushed') : t('pill.never'), pushedAt ? formatShort(pushedAt) : '');

  const list = $('statusList');
  list.replaceChildren();
  const row = (key, ...content) => list.append(element('dt', { textContent: t(key) }), element('dd', {}, content));

  if (spotify.daysLeft === null) {
    row('status.authLeft', element('span', { className: 'note bad', textContent: t('status.notConnected') }));
  } else {
    const share = Math.max(0, Math.min(1, spotify.daysLeft / spotify.validDays));
    const fill = element('i');
    fill.style.width = (share * 100).toFixed(1) + '%';
    const note = tone === 'ok' ? null : element('span', {
      className: 'note ' + tone,
      textContent: t(spotify.daysLeft <= 0 ? 'status.expired' : 'status.soon')
    });
    row('status.authLeft', element('b', { textContent: daysText(spotify.daysLeft) }), ...(note ? [note] : []),
      element('div', { className: 'meter ' + tone }, [fill]));
  }
  row('status.authAt', spotify.authorizedAt ? formatDateTime(spotify.authorizedAt) : '—');
  row('status.expiresAt', spotify.expiresAt ? formatDateTime(spotify.expiresAt) : '—');
  if (pushedAt) {
    row('status.lastPushed', formatDateTime(pushedAt), element('span', { className: 'faint', textContent: t('status.ago', { ago: formatAgo(pushedAt) }) }));
  } else {
    row('status.lastPushed', '—');
  }
  $('reauthHint').textContent = t('status.reauthHint', { days: spotify.validDays, remind: spotify.remindDays });
}

function renderRecapSchedule() {
  if (!recapSchedule) return;
  const time = pad2(recapSchedule.hour) + ':' + pad2(recapSchedule.minute);
  // 2024-01-07 was a Sunday, so day N of that week is weekday N.
  const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 7 + recapSchedule.weeklyDay)));
  const zone = recapSchedule.timeZone;
  $('recapWeeklyText').textContent = t('recap.weekly', { weekday, time, zone });
  $('recapMonthlyText').textContent = t('recap.monthly', { day: recapSchedule.monthlyDay, time, zone });
}

function syncSummary(result) {
  const plays = result.recentlyPlayed;
  const fetched = plays ? t('sync.fetched', { fetched: plays.fetched, inserted: plays.inserted }) : '';
  const discord = result.discord?.patched
    ? t('sync.patched')
    : result.discord?.error
      ? t('sync.failed', { error: result.discord.error })
      : t('sync.notPatched', { reason: result.discord?.reason || 'unknown' });
  return [fetched, discord].filter(Boolean).join(t('list.sep'));
}

function recapSummary(result) {
  if (!result.sent) return t('recap.notSent', { reason: result.reason || 'unknown' });
  return result.messages === 1 ? t('recap.sentOne') : t('recap.sent', { n: result.messages });
}

const RESULT_ICONS = { ok: 'okcircle', warn: 'alert', bad: 'xcircle', plain: 'clock' };

function showResult(scope, tone, message, raw) {
  results[scope] = { tone, message, raw };
  renderResult(scope);
}

function renderResult(scope) {
  const box = $(scope + 'Result');
  const result = results[scope];
  if (!result) {
    box.replaceChildren(scope === 'action' ? element('p', { className: 'hint', textContent: t('status.noAction') }) : '');
    return;
  }
  const line = element('div', { className: 'tone ' + result.tone }, [svgIcon(RESULT_ICONS[result.tone]),
    element('span', { textContent: resolveMessage(result.message) })], { role: result.tone === 'bad' ? 'alert' : 'status' });
  const children = [line];
  if (result.raw !== undefined) {
    children.push(element('details', {}, [
      element('summary', { textContent: t('action.raw') }),
      element('pre', { className: 'json', textContent: JSON.stringify(result.raw, null, 2) })
    ]));
  }
  box.replaceChildren(...children);
}

async function runAction(button, path, summarize, confirmKey, scopes) {
  if (confirmKey && !confirm(t(confirmKey))) return;
  button.disabled = true;
  scopes.forEach((scope) => showResult(scope, 'plain', () => t('action.running')));
  try {
    const result = await api(path, {});
    const tone = result.discord?.error || result.sent === false ? 'warn' : 'ok';
    scopes.forEach((scope) => showResult(scope, tone, () => summarize(result), result));
    await loadState();
  } catch (error) {
    scopes.forEach((scope) => showResult(scope, 'bad', () => errorText(error), error.raw ?? { error: error.message }));
  } finally {
    button.disabled = false;
  }
}

async function loadState() {
  const data = await api('/admin/api/state');
  defaults = data.defaults;
  metrics = data.metrics;
  fieldMap = data.fields;
  heroState = data.heroImage || heroState;
  albumImageUrl = data.albumImageUrl ?? null;
  discordClientId = data.discordClientId || null;
  recapSchedule = data.recapSchedule || null;
  renderStatus(data.status);
  renderRecapSchedule();
  // Show the Discord field names from config next to the text inputs.
  for (const key of document.querySelectorAll('[data-field]')) {
    const field = fieldMap?.[FIELD_NAMES[key.dataset.field]];
    if (field) key.textContent = field;
  }
  return data;
}

// ---- variable chips ----

function describeField(el) {
  if (TEXT_FIELDS.includes(el.name)) return t('field.' + el.name);
  const row = el.closest('.slotrow');
  const n = row ? Number(row.dataset.index) + 1 : '?';
  return t(el.classList.contains('slot-value') ? 'field.slotValue' : 'field.slotLabel', { n });
}

function renderChipTarget() {
  $('chipTarget').textContent = lastTextInput ? describeField(lastTextInput) : t('text.targetNone');
}

document.addEventListener('focusin', (event) => {
  const el = event.target;
  if (el.tagName === 'INPUT' && el.type === 'text' && form.contains(el)) {
    lastTextInput = el;
    renderChipTarget();
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('mousedown', (event) => event.preventDefault());
  chip.addEventListener('click', () => {
    const target = lastTextInput;
    if (!target) {
      setStatus('saveStatus', () => t('chips.needTarget'), 'warn');
      return;
    }
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(chip.dataset.insert, start, end, 'end');
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

// ---- language ----

function relocalize() {
  if (metrics.length) renderSlots(readSlots());
  renderChipTarget();
  if (lastPayload && fieldMap) renderPreview(lastPayload, fieldMap);
  renderHero();
  if (statusData) renderStatus(statusData);
  renderRecapSchedule();
  for (const id of statusLines.keys()) renderStatusLine(id);
  renderResult('action');
  if (results.recap) renderResult('recap');
  if (!$('toast').classList.contains('gone')) $('toast').classList.add('gone');
}

langListeners.push(relocalize);

// ---- wiring ----

form.addEventListener('change', onFormChange);
form.addEventListener('input', onFormChanged);
form.addEventListener('submit', (event) => { event.preventDefault(); save(true); });
$('tablist').addEventListener('keydown', onTabKey);
document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});
document.querySelectorAll('[data-goto]').forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.goto, { focus: true }));
});
window.addEventListener('hashchange', () => showTab(location.hash.slice(1), { updateHash: false }));
$('saveBtn').addEventListener('click', () => save(true));
$('saveOnlyBtn').addEventListener('click', () => save(false));
$('resetBtn').addEventListener('click', () => {
  fillForm(defaults);
  onFormChanged();
  setStatus('saveStatus', () => t('save.resetDone'), 'warn');
});
$('heroUploadBtn').addEventListener('click', () => $('heroFile').click());
$('heroFile').addEventListener('change', () => {
  const file = $('heroFile').files[0];
  if (file) openCrop(file);
});
$('heroEditorShowBtn').addEventListener('click', () => {
  heroStepsOpen = true;
  renderHero();
  input('heroEditorConfirmed').focus();
});
$('heroDeleteBtn').addEventListener('click', deleteHero);
$('cropStage').addEventListener('pointerdown', onCropPointerDown);
$('cropStage').addEventListener('pointermove', onCropPointerMove);
$('cropStage').addEventListener('pointerup', onCropPointerUp);
$('cropStage').addEventListener('pointercancel', onCropPointerUp);
$('cropStage').addEventListener('wheel', onCropWheel, { passive: false });
$('cropStage').addEventListener('keydown', onCropKey);
$('cropZoom').addEventListener('input', (event) => zoomCrop(Number(event.target.value)));
$('cropGuidesToggle').addEventListener('change', (event) => $('cropGuides').classList.toggle('gone', !event.target.checked));
$('cropApplyBtn').addEventListener('click', applyCrop);
$('cropRawBtn').addEventListener('click', uploadRawHero);
$('cropCancelBtn').addEventListener('click', cancelCrop);
$('cropCloseBtn').addEventListener('click', cancelCrop);
// Esc closes the dialog through "cancel"; route it through cancelCrop for cleanup.
$('cropDialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelCrop();
});
$('syncBtn').addEventListener('click', (event) =>
  runAction(event.currentTarget, '/admin/api/push', syncSummary, null, ['action']));
$('weeklyBtn').addEventListener('click', (event) =>
  runAction(event.currentTarget, '/admin/recap/weekly/send', recapSummary, 'recap.confirmWeekly', ['recap', 'action']));
$('monthlyBtn').addEventListener('click', (event) =>
  runAction(event.currentTarget, '/admin/recap/monthly/send', recapSummary, 'recap.confirmMonthly', ['recap', 'action']));
$('viewCard').addEventListener('click', () => setPreviewView(false));
$('viewJson').addEventListener('click', () => setPreviewView(true));
$('pCard').addEventListener('click', onPreviewActivate);
$('pCard').addEventListener('keydown', onPreviewActivate);
$('pStats').addEventListener('mouseover', (event) => {
  const cell = event.target.closest('.wstat');
  if (cell) linkSlot(Number(cell.dataset.index), true);
});
$('pStats').addEventListener('mouseout', (event) => {
  const cell = event.target.closest('.wstat');
  if (cell && !cell.contains(event.relatedTarget)) {
    const index = Number(cell.dataset.index);
    linkSlot(index, $('slots').children[index]?.contains(document.activeElement) ?? false);
  }
});
$('peekBtn').addEventListener('click', () => setSheet(!$('previewSide').classList.contains('open')));
narrow.addEventListener('change', () => setSheet(false));
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--savebar-h', $('savebar').offsetHeight + 'px');
}).observe($('savebar'));

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save(true);
  } else if (event.key === 'Escape' && narrow.matches && $('previewSide').classList.contains('open') && !$('cropDialog').open) {
    setSheet(false);
    $('peekBtn').focus();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

showTab(location.hash.slice(1), { updateHash: Boolean(location.hash) });
renderResult('action');
renderChipTarget();
loadState()
  .then((data) => {
    fillForm(data.settings);
    renderPreview(data.payload, data.fields);
    markSaved();
    renderSaveStatus();
  })
  .catch((error) => setStatus('previewStatus', () => errorText(error), 'bad'));
`;


// Page markup. Text is rendered server-side with `t` (the request's language) and
// tagged with data-i18n / data-i18n-attr so the page script can switch languages live.
// Attribute format: data-i18n-attr="aria-label:key;title:key2".
import { icon, iconSprite } from './icons.js';

const LANG_LABELS = [
  ['zh-TW', '中文'],
  ['en', 'EN']
];

export function langSwitch(t) {
  const buttons = LANG_LABELS.map(
    ([code, label]) => `<button type="button" data-lang="${code}" lang="${code}" aria-pressed="false">${label}</button>`
  ).join('');
  return `<div class="lang" role="group" aria-label="${t('lang.label')}" data-i18n-attr="aria-label:lang.label">${icon('globe')}${buttons}</div>`;
}

function tx(t, key, tag = 'span', attrs = '') {
  return `<${tag} data-i18n="${key}"${attrs ? ` ${attrs}` : ''}>${t(key)}</${tag}>`;
}

const LOGIN_NOTICES = {
  failed: ['bad', 'xcircle'],
  sent: ['ok', 'okcircle'],
  tooSoon: ['warn', 'alert'],
  dmFailed: ['bad', 'xcircle'],
  expired: ['warn', 'alert'],
  noApp: ['bad', 'xcircle']
};
const LOGIN_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// Sign-in page. Without ADMIN_TOKEN the only way in is a one-time link the bot
// DMs you; `confirmToken` renders the page that link opens (a POST button, so
// link previews cannot use up the link).
export function loginMarkup(t, options = {}) {
  const { notice = null, passwordLogin = false, installUrl = null, confirmToken = null } = options;
  const tone = LOGIN_NOTICES[notice];
  const noticeLine = tone
    ? `<p class="tone ${tone[0]}" role="${tone[0] === 'ok' ? 'status' : 'alert'}">${icon(tone[1])}${tx(t, `login.notice.${notice}`)}</p>`
    : '';
  let content;
  if (confirmToken && LOGIN_TOKEN_PATTERN.test(confirmToken)) {
    content = `${tx(t, 'login.confirmHint', 'p', 'class="hint"')}
    <form method="post" action="/admin/login/confirm">
      <input type="hidden" name="t" value="${confirmToken}">
      <button type="submit" class="btn primary lg wide" autofocus>${tx(t, 'login.confirm')}</button>
    </form>`;
  } else {
    const install = installUrl
      ? `<li>${tx(t, 'login.step1')}<a class="btn sm" href="${installUrl}" target="_blank" rel="noopener noreferrer">${icon('external')}${tx(t, 'login.install')}</a></li>`
      : '';
    const password = passwordLogin
      ? `<div class="or">${tx(t, 'login.or')}</div>
    <form method="post" action="/admin/login">
      <label class="field"><span class="lab">ADMIN_TOKEN</span><input class="inp" type="password" name="token" autocomplete="current-password" required></label>
      <button type="submit" class="btn lg wide">${tx(t, 'login.submit')}</button>
    </form>`
      : '';
    content = `${tx(t, 'login.hint', 'p', 'class="hint"')}
    ${noticeLine}
    <ol class="steps login-steps">
      ${install}
      <li>${tx(t, 'login.step2')}<form method="post" action="/admin/login/link"><button type="submit" class="btn primary wide">${icon('send')}${tx(t, 'login.sendLink')}</button></form></li>
    </ol>
    ${tx(t, 'login.dmNote', 'p', 'class="hint"')}
    ${password}`;
    return loginShell(t, content);
  }
  return loginShell(t, `${noticeLine}${content}`);
}

function loginShell(t, content) {
  return `${iconSprite()}
<main class="login">
  <div class="login-card">
    <div class="login-top"><span class="logo">${icon('music')}</span><h1>Spotify Stats <span class="faint">Admin</span></h1>${langSwitch(t)}</div>
    ${content}
  </div>
</main>`;
}

const TABS = [
  ['widget', 'type', 'tab.widget'],
  ['hero', 'image', 'tab.hero'],
  ['recap', 'mail', 'tab.recap'],
  ['status', 'activity', 'tab.status']
];

const RANGE_CHOICES = ['7', '28', '90', '365', 'all', 'custom'];

const TEXT_FIELDS = [
  ['username', 'field.username', 'username', 80],
  ['topHeroTitle', 'field.topHeroTitle', 'top_hero_title', 256],
  ['mainTitle', 'field.mainTitle', 'main_title', 256],
  ['lastUpdatedPrefix', 'field.lastUpdatedPrefix', 'last_updated', 256]
];

function header(t) {
  return `<header class="top">
  <div class="brand"><span class="logo">${icon('music')}</span><h1>Spotify Stats <span class="faint">Admin</span></h1></div>
  <div class="pills">
    <button type="button" class="pill" id="pillAuth" data-goto="status" title="${t('pill.open')}" data-i18n-attr="title:pill.open"><span class="dot"></span><span class="pill-text"></span><b class="pill-value"></b></button>
    <button type="button" class="pill" id="pillPush" data-goto="status" title="${t('pill.open')}" data-i18n-attr="title:pill.open"><span class="dot"></span><span class="pill-text"></span><b class="pill-value"></b></button>
  </div>
  <div class="right">
    ${langSwitch(t)}
    ${tx(t, 'header.signedIn', 'span', 'class="who"')}
    <form method="post" action="/admin/logout"><button type="submit" class="btn ghost sm" title="${t('header.logout')}" data-i18n-attr="title:header.logout">${icon('logout')}${tx(t, 'header.logout', 'span', 'class="logout-text"')}</button></form>
  </div>
</header>`;
}

function tabBar(t) {
  const tabs = TABS.map(([id, iconName, key]) => {
    const badge = id === 'hero'
      ? `<span class="badge gone" id="heroBadge"><span class="sr" data-i18n="tab.heroPending">${t('tab.heroPending')}</span></span>`
      : '';
    return `<button type="button" class="tab" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="pane-${id}" aria-selected="false" tabindex="-1">${icon(iconName)}${tx(t, key)}${badge}</button>`;
  }).join('');
  return `<nav class="tabs" aria-label="${t('tabs.label')}" data-i18n-attr="aria-label:tabs.label"><div class="tabs-in" role="tablist" id="tablist">${tabs}</div></nav>`;
}

function widgetPane(t) {
  const ranges = RANGE_CHOICES.map(
    (value) => `<label><input type="radio" name="rangeChoice" value="${value}">${tx(t, `range.${value}`)}</label>`
  ).join('');
  const fields = TEXT_FIELDS.map(
    ([name, key, field, max]) =>
      `<label class="field"><span class="lab">${tx(t, key)}<span class="key" data-field="${name}">${field}</span></span><input class="inp" type="text" name="${name}" maxlength="${max}" autocomplete="off" spellcheck="false"></label>`
  ).join('');
  return `<section class="pane" id="pane-widget" role="tabpanel" aria-labelledby="tab-widget" tabindex="0" hidden>
  <div class="panel" id="rangePanel">
    <div class="panel-h"><h2 id="rangeTitle" data-i18n="range.title">${t('range.title')}</h2>${tx(t, 'range.hint', 'p', 'class="hint"')}</div>
    <div class="rangerow">
      <div class="seg" role="radiogroup" aria-labelledby="rangeTitle" id="rangeSeg">${ranges}</div>
      <label class="field custom-days off" id="customDaysWrap">${tx(t, 'range.customDays', 'span', 'class="lab"')}<input class="inp sm" name="customDays" type="number" min="1" max="3650" step="1" inputmode="numeric" placeholder="1–3650" disabled></label>
    </div>
  </div>
  <div class="panel">
    <div class="panel-h"><h2 data-i18n="text.title">${t('text.title')}</h2></div>
    <div class="chipbar">
      <div class="chips">${tx(t, 'text.insert', 'span', 'class="small faint"')}
        <button type="button" class="chip" data-insert="{range}">{range}<span class="d">4w / all time</span></button>
        <button type="button" class="chip" data-insert="{rangeLong}">{rangeLong}<span class="d">4 Weeks / All Time</span></button>
        <button type="button" class="chip" data-insert="{count}">{count}${tx(t, 'chip.count', 'span', 'class="d"')}</button>
        <button type="button" class="chip" data-insert="{value}" title="${t('chip.valueTitle')}" data-i18n-attr="title:chip.valueTitle">{value}${tx(t, 'chip.value', 'span', 'class="d"')}</button>
      </div>
      <span class="target" aria-live="polite">${tx(t, 'text.target')}<b id="chipTarget">${t('text.targetNone')}</b></span>
    </div>
    <div class="grid2">${fields}</div>
  </div>
  <div class="panel">
    <div class="panel-h"><h2 data-i18n="slots.title">${t('slots.title')}</h2>${tx(t, 'slots.hint', 'p', 'class="hint"')}</div>
    <div class="slots-h" aria-hidden="true"><span>#</span>${tx(t, 'slots.metric')}${tx(t, 'slots.range')}${tx(t, 'slots.label')}${tx(t, 'slots.value')}<span></span></div>
    <div id="slots"></div>
  </div>
</section>`;
}

function templateFigure(t, templatePath) {
  return `<figure class="tpl">
    <img src="${templatePath}" alt="${t('hero.template.alt')}" data-i18n-attr="alt:hero.template.alt" width="1300" height="1200" loading="lazy">
    <figcaption>${tx(t, 'hero.template.caption')} <a href="${templatePath}" download="hero-guide-1300x1200.png">${icon('download')} ${tx(t, 'hero.template.download')}</a></figcaption>
  </figure>`;
}

function heroPane(t, templatePath) {
  const mode = (value, thumb) =>
    `<label class="mode" data-mode="${value}"><input class="sr" type="radio" name="heroImage" value="${value}">${thumb}<span class="mt"><span class="radio"></span>${tx(t, `hero.mode.${value}`)}</span></label>`;
  return `<section class="pane" id="pane-hero" role="tabpanel" aria-labelledby="tab-hero" tabindex="0" hidden>
  <div class="panel stack" id="heroPanel">
    <div class="panel-h"><h2 data-i18n="hero.title">${t('hero.title')}</h2>${tx(t, 'hero.hint', 'p', 'class="hint"')}</div>
    <div class="modes" role="radiogroup" aria-label="${t('hero.modes')}" data-i18n-attr="aria-label:hero.modes">
      ${mode('asset', `<span class="mthumb asset" aria-hidden="true">${icon('layers')}${tx(t, 'hero.thumb.asset')}</span>`)}
      ${mode('upload', '<span class="mthumb" id="modeThumbUpload" aria-hidden="true"></span>')}
      ${mode('album', '<span class="mthumb" id="modeThumbAlbum" aria-hidden="true"></span>')}
    </div>
    <div id="heroEditorBox" class="remind gone" role="note">
      <div id="heroEditorSteps">
        <strong>${icon('alert')}${tx(t, 'hero.editor.title')}</strong>
        <ol>
          <li>${tx(t, 'hero.editor.step1')}</li>
          <li>${tx(t, 'hero.editor.step2a')} <code id="heroEditorField">hero_image</code>${tx(t, 'hero.editor.step2b')}</li>
          <li>${tx(t, 'hero.editor.step3')}</li>
        </ol>
        ${tx(t, 'hero.editor.note', 'p', 'class="small muted"')}
        <div class="row">
          <a id="heroEditorLink" href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">${icon('external')} ${tx(t, 'hero.editor.open')}</a>
          <label class="cb"><input type="checkbox" name="heroEditorConfirmed">${tx(t, 'hero.editor.confirm')}</label>
        </div>
      </div>
      <p id="heroEditorDone" class="done-line gone">${icon('check')}${tx(t, 'hero.editor.done')}<button type="button" class="btn ghost sm" id="heroEditorShowBtn">${tx(t, 'hero.editor.showAgain')}</button></p>
    </div>
    <div id="heroUploadBox" class="upload gone">
      <div class="thumb" id="heroThumb"></div>
      <div>
        <input type="file" id="heroFile" class="sr" tabindex="-1" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="${t('hero.fileLabel')}" data-i18n-attr="aria-label:hero.fileLabel">
        <div class="actions">
          <button type="button" class="btn primary sm" id="heroUploadBtn">${icon('upload')}${tx(t, 'hero.choose')}</button>
          <button type="button" class="btn danger-ghost sm" id="heroDeleteBtn">${icon('trash')}${tx(t, 'hero.delete')}</button>
        </div>
        <p class="meta"><span id="heroMeta"></span><br>${tx(t, 'hero.limits')}</p>
        ${templateFigure(t, templatePath)}
      </div>
    </div>
    <div id="heroStatus" class="status boxed" role="status" aria-live="polite"></div>
  </div>
</section>`;
}

function recapPane(t) {
  return `<section class="pane" id="pane-recap" role="tabpanel" aria-labelledby="tab-recap" tabindex="0" hidden>
  <div class="panel stack">
    <div class="panel-h"><h2 data-i18n="recap.title">${t('recap.title')}</h2></div>
    <label class="switch"><input type="checkbox" name="recapEnabled" role="switch"><span class="track"></span>${tx(t, 'recap.toggle')}</label>
    ${tx(t, 'recap.toggleHint', 'p', 'class="hint"')}
    <div class="sched">
      <h3 data-i18n="recap.scheduleTitle">${t('recap.scheduleTitle')}</h3>
      <ul><li id="recapWeeklyText"></li><li id="recapMonthlyText"></li></ul>
      ${tx(t, 'recap.dmNote', 'p', 'class="hint"')}
    </div>
    <hr class="divider">
    <h3 data-i18n="recap.testTitle">${t('recap.testTitle')}</h3>
    ${tx(t, 'recap.testHint', 'p', 'class="hint"')}
    <div class="actions">
      <button type="button" class="btn" id="weeklyBtn">${icon('mail')}${tx(t, 'recap.sendWeekly')}</button>
      <button type="button" class="btn" id="monthlyBtn">${icon('calendar')}${tx(t, 'recap.sendMonthly')}</button>
    </div>
    <div class="result" id="recapResult" aria-live="polite"></div>
  </div>
</section>`;
}

// The Spotify app inputs belong to their own form (form="spotifyAppForm"), so Enter
// saves the app instead of the widget settings, and readForm() never sees them.
function spotifyAppPanel(t) {
  return `<div class="panel stack" id="spotifyAppPanel">
    <div class="panel-h"><h2 data-i18n="setup.title">${t('setup.title')}</h2>${tx(t, 'setup.hint', 'p', 'class="hint" id="spotifyAppHint"')}</div>
    <p id="spotifyAppDone" class="done-line gone">${icon('check')}<span id="spotifyAppDoneText"></span><button type="button" class="btn ghost sm" id="spotifyAppChangeBtn">${tx(t, 'setup.change')}</button></p>
    <p id="spotifyAppCloudflare" class="hint gone">${tx(t, 'setup.cloudflare')}</p>
    <div id="spotifyAppSteps" class="stack">
      <ol class="steps">
        <li>${tx(t, 'setup.step1')} <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">${icon('external')} ${tx(t, 'setup.dashboard')}</a></li>
        <li>${tx(t, 'setup.step2')}
          <span class="copyline"><code id="spotifyRedirectUri"></code><button type="button" class="btn sm" id="spotifyRedirectCopyBtn">${tx(t, 'setup.copy')}</button></span></li>
        <li>${tx(t, 'setup.step3')}</li>
      </ol>
      <div class="grid2" id="spotifyAppFields">
        <label class="field">${tx(t, 'setup.clientId', 'span', 'class="lab"')}<input class="inp mono" form="spotifyAppForm" name="clientId" maxlength="64" autocomplete="off" spellcheck="false" required></label>
        <label class="field">${tx(t, 'setup.clientSecret', 'span', 'class="lab"')}<input class="inp mono" form="spotifyAppForm" name="clientSecret" type="password" maxlength="64" autocomplete="off" spellcheck="false" required></label>
      </div>
      <div class="actions">
        <button type="submit" form="spotifyAppForm" class="btn primary" id="spotifyAppSaveBtn">${icon('check')}${tx(t, 'setup.save')}</button>
        <button type="button" class="btn ghost gone" id="spotifyAppCancelBtn">${tx(t, 'setup.cancel')}</button>
      </div>
      <div id="spotifyAppStatus" class="status" role="status" aria-live="polite"></div>
    </div>
  </div>`;
}

function statusPane(t) {
  return `<section class="pane" id="pane-status" role="tabpanel" aria-labelledby="tab-status" tabindex="0" hidden>
  ${spotifyAppPanel(t)}
  <div class="panel stack">
    <div class="panel-h"><h2 data-i18n="status.title">${t('status.title')}</h2></div>
    <dl class="kv" id="statusList"></dl>
    <div class="actions">
      <button type="button" class="btn" id="syncBtn">${icon('refresh')}${tx(t, 'status.sync')}</button>
      <a class="btn ghost" href="/spotify/login" id="reauthLink">${icon('key')}${tx(t, 'status.reauth')}</a>
    </div>
    <p class="hint"><span data-i18n="status.syncHint">${t('status.syncHint')}</span> <span id="reauthHint"></span></p>
    <hr class="divider">
    <h3 data-i18n="status.lastAction">${t('status.lastAction')}</h3>
    <div class="result" id="actionResult" aria-live="polite"></div>
  </div>
</section>`;
}

function preview(t) {
  return `<aside class="side" id="previewSide" aria-labelledby="previewTitle">
  <div class="panel">
    <div class="sheet-grab" aria-hidden="true"></div>
    <button type="button" class="peek" id="peekBtn" aria-expanded="false" aria-controls="sheetBody" title="${t('preview.toggle')}" data-i18n-attr="title:preview.toggle">
      <span class="peek-thumb" id="peekThumb">${icon('image')}</span>
      <span class="pt"><b><span data-i18n="preview.title">${t('preview.title')}</span> · <span id="peekTitle"></span></b><span id="peekStats"></span></span>
      ${icon('up', 'chev')}
    </button>
    <div class="sheet-body" id="sheetBody">
      <div class="prev-h"><h2 id="previewTitle" data-i18n="preview.title">${t('preview.title')}</h2><span class="loading-flag" id="loadingFlag" data-i18n="preview.loading">${t('preview.loading')}</span>
        <div class="seg" role="group" aria-label="${t('preview.view')}" data-i18n-attr="aria-label:preview.view">
          <button type="button" id="viewCard" class="on" aria-pressed="true" data-i18n="preview.card">${t('preview.card')}</button>
          <button type="button" id="viewJson" aria-pressed="false" data-i18n="preview.json">${t('preview.json')}</button>
        </div>
      </div>
      <div class="wcard" id="pCard">
        <div class="wtop" id="pTop">
          <img class="whero jump gone" id="pHeroImg" alt="${t('preview.heroAlt')}" data-i18n-attr="alt:preview.heroAlt" data-jump="hero" tabindex="0" role="button">
          <div class="wuser jump" id="pUser" data-jump="username" tabindex="0" role="button"></div>
          <div class="wtitle jump" id="pHero" data-jump="topHeroTitle" tabindex="0" role="button"></div>
          <div class="wsmall jump auto" id="pDuring" data-jump="during" tabindex="0" role="button"></div>
          <div class="wsmall jump" id="pUpdated" data-jump="lastUpdatedPrefix" tabindex="0" role="button"></div>
          <div class="wsmall jump auto" id="pSong" data-jump="song" tabindex="0" role="button"></div>
          <div class="wmain jump" id="pMain" data-jump="mainTitle" tabindex="0" role="button"></div>
        </div>
        <div class="wstats" id="pStats"></div>
      </div>
      <pre class="json gone" id="pJson" tabindex="0"></pre>
      <p class="loading-note">${icon('info')}${tx(t, 'preview.hint')}</p>
      <div id="previewStatus" class="status boxed" role="status"></div>
    </div>
  </div>
</aside>`;
}

function saveBar(t) {
  return `<footer class="savebar" id="savebar">
  <div class="savebar-in">
    <div id="saveStatus" class="save-status" role="status" aria-live="polite"></div>
    <span class="kbdhint"><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>S</kbd> ${tx(t, 'save.kbd')}</span>
    <button type="button" class="btn ghost" id="resetBtn" title="${t('save.reset')}" data-i18n-attr="title:save.reset">${icon('rotate')}${tx(t, 'save.reset', 'span', 'class="lbl"')}</button>
    <button type="button" class="btn" id="saveOnlyBtn">${tx(t, 'save.only')}</button>
    <button type="button" class="btn primary" id="saveBtn">${icon('send')}${tx(t, 'save.push', 'span', 'class="long"')}${tx(t, 'save.pushShort', 'span', 'class="short"')}</button>
  </div>
</footer>`;
}

function cropDialog(t, templatePath, crop) {
  return `<dialog id="cropDialog" class="crop" aria-labelledby="cropTitle" aria-describedby="cropHint">
  <div class="crop-head">
    <div><h2 id="cropTitle" data-i18n="crop.title">${t('crop.title')}</h2>${tx(t, 'crop.hint', 'p', 'class="hint" id="cropHint"')}</div>
    <button type="button" class="btn ghost icon" id="cropCloseBtn" aria-label="${t('crop.close')}" data-i18n-attr="aria-label:crop.close;title:crop.close" title="${t('crop.close')}">${icon('x')}</button>
  </div>
  <div class="crop-grid">
    <div>
      <div class="crop-stage" id="cropStage" tabindex="0" aria-label="${t('crop.stage')}" data-i18n-attr="aria-label:crop.stage">
        <canvas id="cropCanvas" width="${crop.width}" height="${crop.height}"></canvas>
        <div class="crop-guides" id="cropGuides" aria-hidden="true">
          <div class="g-top">${tx(t, 'crop.guide.top')}</div>
          <div class="g-heavy">${tx(t, 'crop.guide.heavy')}</div>
          <div class="g-minor">${tx(t, 'crop.guide.minor')}</div>
          <div class="g-line g-line1"><span>subtitle 1</span></div>
          <div class="g-line g-line2"><span>subtitle 2</span></div>
          <div class="g-line g-line3"><span>subtitle 3</span></div>
        </div>
      </div>
      <div class="crop-ctl">
        <label class="crop-zoom">${tx(t, 'crop.zoom')}<input type="range" id="cropZoom" min="1" max="${crop.maxZoom}" step="0.01" value="1"><output id="cropZoomValue" for="cropZoom">1.0×</output></label>
        <label class="cb"><input type="checkbox" id="cropGuidesToggle" checked>${tx(t, 'crop.guides')}</label>
      </div>
    </div>
    <aside class="crop-side">${templateFigure(t, templatePath)}</aside>
  </div>
  <div id="cropStatus" class="status" role="status"></div>
  <div class="crop-foot">
    ${tx(t, 'crop.gifHint', 'p', 'class="hint gone" id="cropGifHint"')}
    <div class="actions">
      <button type="button" class="btn ghost" id="cropCancelBtn">${tx(t, 'crop.cancel')}</button>
      <button type="button" class="btn" id="cropRawBtn">${tx(t, 'crop.raw')}</button>
      <button type="button" class="btn primary" id="cropApplyBtn">${icon('crop')}${tx(t, 'crop.apply')}</button>
    </div>
  </div>
</dialog>`;
}

export function adminMarkup(t, { templatePath, crop }) {
  return `${iconSprite()}
${header(t)}
${tabBar(t)}
<main class="wrap" id="main">
  <form id="settings" class="panes" novalidate>
${widgetPane(t)}
${heroPane(t, templatePath)}
${recapPane(t)}
${statusPane(t)}
  </form>
  <form id="spotifyAppForm" novalidate hidden></form>
${preview(t)}
</main>
${saveBar(t)}
<div class="toast gone" id="toast" role="status" aria-live="polite">${icon('info')}<span id="toastText"></span></div>
${cropDialog(t, templatePath, crop)}`;
}

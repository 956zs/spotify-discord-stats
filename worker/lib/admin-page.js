import { cryptoRandomHex } from './crypto.js';
import { HERO_TEMPLATE_PATH } from './hero-template.js';
import { MAX_WIDGET_IMAGE_BYTES } from './widget-images.js';

const NONCE_BYTES = 16;
// The hero crop tool outputs exactly the size Discord shows the Widget Top image at.
const CROP_WIDTH = 1300;
const CROP_HEIGHT = 1200;
const CROP_MAX_ZOOM = 4;

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
          "img-src 'self' https://i.scdn.co https://*.scdn.co https://*.spotifycdn.com",
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
.card { background:#232428; border-radius:8px; container-type:inline-size; transition:opacity .15s; }
.card.loading { opacity:.45; }
.card-hero-img { position:absolute; right:0; bottom:0; width:49.5cqw; aspect-ratio:13 / 12; object-fit:cover; -webkit-mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 17%, #000 35%); mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 17%, #000 35%); pointer-events:none; }
/* Discord sizes the top area to the image: 1300x1200, right half of the card, top 4% may rise above the card edge. */
.card-top.with-hero { min-height:43.9cqw; }
.card-top.with-hero > :not(.card-hero-img) { position:relative; max-width:58%; }
.hero-modes { display:flex; flex-wrap:wrap; gap:6px 18px; margin-bottom:10px; }
.hero-modes .check { margin:0; }
.hero-upload { display:grid; grid-template-columns:120px minmax(0,1fr); gap:12px; align-items:start; padding:10px; border:1px solid var(--line); border-radius:8px; background:var(--raised); margin-bottom:10px; }
.hero-thumb { width:120px; aspect-ratio:13 / 12; border-radius:6px; background:var(--bg); border:1px dashed var(--line); display:grid; place-items:center; color:var(--muted); font-size:11px; overflow:hidden; }
.hero-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.hero-upload input[type=file] { margin:0 0 8px; padding:5px; }
.hero-template { display:flex; gap:10px; align-items:flex-start; margin:10px 0 0; font-size:12px; color:var(--muted); }
.hero-template img { width:96px; height:auto; aspect-ratio:13 / 12; flex:none; border-radius:6px; border:1px solid var(--line); background:var(--bg); }
.hero-template figcaption a, .warn-box a { color:#949cf7; }
.warn-box { border:1px solid rgba(240,178,50,.55); background:rgba(240,178,50,.08); border-radius:8px; padding:10px 12px; margin-bottom:10px; font-size:13px; }
.warn-box.done { border-color:var(--line); background:var(--raised); padding:6px 12px; }
.warn-box strong { color:var(--warn); }
.warn-box p { margin:4px 0 8px; }
.warn-box .check { margin-top:8px; }
.note-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0; color:var(--muted); font-size:12px; }
.note-line button { padding:2px 10px; font-size:12px; }
code { font:12px ui-monospace, monospace; background:var(--bg); padding:1px 5px; border-radius:4px; }
dialog.crop { width:min(1000px, calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 24px); padding:16px; background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:10px; }
dialog.crop::backdrop { background:rgba(0,0,0,.72); }
.crop-layout { display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:16px; align-items:start; }
.crop-stage { position:relative; width:min(100%, calc((100vh - 250px) * 13 / 12)); aspect-ratio:13 / 12; margin:0 auto; background:#000; border-radius:6px; overflow:hidden; touch-action:none; user-select:none; cursor:grab; }
.crop-stage.dragging { cursor:grabbing; }
.crop-stage:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.crop-stage canvas { display:block; width:100%; height:100%; }
.crop-guides { position:absolute; inset:0; pointer-events:none; font-size:11px; line-height:1.3; color:#fff; }
.crop-guides span { position:absolute; padding:1px 5px; border-radius:3px; background:rgba(0,0,0,.6); white-space:nowrap; }
.g-top { position:absolute; left:0; right:0; top:0; height:4%; background:rgba(242,63,67,.38); border-bottom:1px dashed #f23f43; }
.g-top span { left:50%; top:100%; transform:translateX(-50%); margin-top:2px; }
.g-heavy, .g-minor { position:absolute; top:4%; bottom:0; }
.g-heavy { left:0; width:17%; background:rgba(0,0,0,.55); border-right:1px dashed rgba(255,255,255,.6); }
.g-minor { left:17%; width:18%; background:rgba(0,0,0,.25); border-right:1px dashed rgba(255,255,255,.45); }
.g-heavy span, .g-minor span { left:50%; top:40%; transform:translateX(-50%); }
.g-line { position:absolute; left:0; right:0; border-top:2px dashed #23a55a; }
.g-line span { right:6px; bottom:2px; background:rgba(35,165,90,.85); }
.g-line1 { top:69.6%; } .g-line2 { top:80%; } .g-line3 { top:90%; }
.crop-controls { display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-top:10px; }
.crop-controls label { margin:0; }
.crop-zoom { display:flex; align-items:center; gap:8px; flex:1; min-width:200px; color:var(--text); font-size:13px; }
.crop-zoom input { margin:0; padding:0; flex:1; }
.crop-side .hero-template { flex-direction:column; margin:0; }
.crop-side .hero-template img { width:100%; }
.crop-actions { margin-top:12px; justify-content:flex-end; }
.card-top { position:relative; padding:14px; border-bottom:1px solid var(--line); }
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
  .hero-upload { grid-template-columns:1fr; }
  dialog.crop { padding:12px; }
  .crop-layout { grid-template-columns:1fr; }
  .crop-stage { width:100%; }
  .crop-side .hero-template { flex-direction:row; }
  .crop-side .hero-template img { width:96px; }
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
          <h2>Widget 大圖</h2>
          <p class="hint">Widget Top 最上面的大圖（hero_image）。建議 1300×1200 的圖。Discord 可能會快取圖片，換圖後要等一下才會看到。</p>
          <div class="hero-modes">
            <label class="check"><input type="radio" name="heroImage" value="asset"> 固定素材</label>
            <label class="check"><input type="radio" name="heroImage" value="upload"> 自訂上傳</label>
            <label class="check"><input type="radio" name="heroImage" value="album"> 最近播放的專輯封面</label>
          </div>
          <div id="heroEditorBox" class="warn-box gone">
            <div id="heroEditorSteps">
              <strong>還要改 widget 編輯器，Discord 才會換圖</strong>
              <p>到 Discord Developer Portal 的 widget 編輯器，把 Widget Top 的 Image 改成 Value Type「User Data」、Data Field 填 <code id="heroEditorField">hero_image</code>、打開 Fallback 並選回原本的圖片素材，然後按 Save changes（已發佈的 widget 會再問一次，按 Update）。沒改的話 Discord 會一直顯示原本的圖。</p>
              <a id="heroEditorLink" href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">打開 widget 編輯器 ↗</a>
              <label class="check"><input type="checkbox" name="heroEditorConfirmed"> 我已經在 widget 編輯器設定好了</label>
            </div>
            <p id="heroEditorDone" class="note-line gone">✓ 已在 widget 編輯器設定好大圖 <button type="button" id="heroEditorShowBtn">再看一次步驟</button></p>
          </div>
          <div id="heroUploadBox" class="hero-upload gone">
            <div class="hero-thumb" id="heroThumb">尚未上傳</div>
            <div>
              <input type="file" id="heroFile" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="選擇圖片">
              <div class="actions">
                <button type="button" id="heroUploadBtn">裁切並上傳</button>
                <button type="button" id="heroDeleteBtn">刪除</button>
              </div>
              <p class="hint spaced" id="heroMeta">PNG、JPEG、WebP 或 GIF，最大 1.5 MB。上傳和刪除會立即生效。</p>
              ${templateFigure()}
            </div>
          </div>
          <div id="heroStatus" class="status"></div>
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
          <div class="card-top" id="pTop">
            <img class="card-hero-img gone" id="pHeroImg" alt="Widget 大圖">
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
</div>
<dialog id="cropDialog" class="crop" aria-labelledby="cropTitle" aria-describedby="cropHint">
  <h2 id="cropTitle">裁切 Widget 大圖</h2>
  <p class="hint" id="cropHint">拖曳移動圖片，用滑桿或滑鼠滾輪縮放（鍵盤：方向鍵移動、+ / − 縮放）。輸出固定 1300×1200；參考線不會出現在上傳的圖上。<span id="cropGifHint" class="gone">GIF 裁切後會變成靜態圖片；要保留動畫請按「不裁切直接上傳」。</span></p>
  <div class="crop-layout">
    <div>
      <div class="crop-stage" id="cropStage" tabindex="0" aria-label="裁切範圍：拖曳或用方向鍵移動，+ / − 縮放">
        <canvas id="cropCanvas" width="${CROP_WIDTH}" height="${CROP_HEIGHT}"></canvas>
        <div class="crop-guides" id="cropGuides" aria-hidden="true">
          <div class="g-top"><span>BOUNDARIES AREA（會超出卡片上緣）</span></div>
          <div class="g-heavy"><span>強淡出</span></div>
          <div class="g-minor"><span>弱淡出</span></div>
          <div class="g-line g-line1"><span>subtitle 1</span></div>
          <div class="g-line g-line2"><span>subtitle 2</span></div>
          <div class="g-line g-line3"><span>subtitle 3</span></div>
        </div>
      </div>
      <div class="crop-controls">
        <label class="crop-zoom">縮放<input type="range" id="cropZoom" min="1" max="${CROP_MAX_ZOOM}" step="0.01" value="1"></label>
        <label class="check"><input type="checkbox" id="cropGuidesToggle" checked> 顯示參考線</label>
      </div>
    </div>
    <aside class="crop-side">${templateFigure()}</aside>
  </div>
  <div id="cropStatus" class="status spaced"></div>
  <div class="actions crop-actions">
    <button type="button" id="cropCancelBtn">取消</button>
    <button type="button" id="cropRawBtn">不裁切直接上傳</button>
    <button type="button" class="primary" id="cropApplyBtn">套用並上傳</button>
  </div>
</dialog>`;

function templateFigure() {
  return `<figure class="hero-template">
    <img src="${HERO_TEMPLATE_PATH}" alt="大圖範本：1300×1200 參考線" width="1300" height="1200" loading="lazy">
    <figcaption>範本：1300×1200，左邊兩段會淡出，最上面 4% 會超出卡片。<a href="${HERO_TEMPLATE_PATH}" download="hero-guide-1300x1200.png">下載範本</a></figcaption>
  </figure>`;
}

const ADMIN_SCRIPT = `
const PRESET_DAYS = ['7', '28', '90', '365'];
const HERO_PATH = '/widget/hero';
const HERO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const HERO_MAX_BYTES = ${MAX_WIDGET_IMAGE_BYTES};
const CROP_WIDTH = ${CROP_WIDTH};
const CROP_HEIGHT = ${CROP_HEIGHT};
const CROP_MAX_ZOOM = ${CROP_MAX_ZOOM};
// Tried in order when the cropped PNG is over the upload limit.
const CROP_FALLBACKS = [['image/webp', 0.92], ['image/webp', 0.85], ['image/jpeg', 0.9]];
const IMAGE_FORMAT_NAMES = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/gif': 'GIF' };
const EDITOR_HOME = 'https://discord.com/developers/applications';
const SLOT_RANGES = [
  ['global', '跟隨全域'], ['7', '7 天'], ['28', '28 天'], ['90', '90 天'], ['180', '180 天'],
  ['365', '365 天'], ['all', '全部歷史'], ['custom', '自訂天數']
];
const form = document.getElementById('settings');
let defaults = null;
let metrics = [];
let fieldMap = null;
let heroState = { upload: null, publicBaseUrl: null };
let discordClientId = null;
let heroStepsOpen = false;
let crop = null;
let cropFrame = 0;
let lastPayload = null;
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
  input('heroImage').value = settings.widget.heroImage || 'asset';
  input('heroEditorConfirmed').checked = settings.widget.heroEditorConfirmed === true;
  heroStepsOpen = false;
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
      heroImage: input('heroImage').value || 'asset',
      heroEditorConfirmed: input('heroEditorConfirmed').checked,
      slots: readSlots()
    }
  };
}

function toggleCustomDays() {
  $('customDaysWrap').classList.toggle('hidden', input('rangeChoice').value !== 'custom');
}

// ---- hero image ----

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

function renderHero() {
  const mode = input('heroImage').value || 'asset';
  $('heroUploadBox').classList.toggle('gone', mode !== 'upload');
  const upload = heroState.upload;
  const thumb = $('heroThumb');
  if (upload) {
    thumb.replaceChildren(element('img', { src: upload.url, alt: '目前的大圖' }));
    $('heroMeta').textContent = upload.contentType + '，' + (upload.size / 1024).toFixed(0) + ' KB，更新於 ' +
      new Date(upload.updatedAt).toLocaleString();
  } else {
    thumb.replaceChildren('尚未上傳');
    $('heroMeta').textContent = 'PNG、JPEG、WebP 或 GIF，最大 1.5 MB。上傳和刪除會立即生效。';
  }
  $('heroDeleteBtn').disabled = !upload;
  renderHeroEditorNote(mode);

  const hasImage = Boolean(heroFieldUrl(lastPayload, fieldMap));
  let text = '';
  if (mode === 'upload' && !heroState.publicBaseUrl) {
    text = '沒有設定 PUBLIC_BASE_URL，Discord 抓不到上傳的圖，會顯示固定素材';
  } else if (mode === 'upload' && !upload) {
    text = '還沒上傳圖片，目前會顯示固定素材';
  } else if (mode === 'album' && lastPayload && !hasImage) {
    text = '最近播放的歌沒有專輯封面，目前會顯示固定素材';
  }
  // Keep a fresh upload/delete result; only replace an earlier warning.
  if (text) {
    setStatus('heroStatus', text, 'warn');
  } else if ($('heroStatus').classList.contains('warn')) {
    setStatus('heroStatus', '');
  }
}

// The widget editor has to read hero_image from User Data, which the Worker cannot
// check, so upload and album modes show the steps until they are confirmed.
function widgetEditorUrl(clientId) {
  return /^\\d+$/.test(clientId || '') ? EDITOR_HOME + '/' + clientId + '/widget' : EDITOR_HOME;
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

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function checkHeroFile(file) {
  if (!HERO_TYPES.includes(file.type)) return '只接受 PNG、JPEG、WebP 或 GIF 圖片';
  if (file.size > HERO_MAX_BYTES) return '圖片太大了（' + formatSize(file.size) + '），上限是 1.5 MB，請先壓縮或縮小尺寸';
  return '';
}

// Uploads through the same route and server-side checks for cropped and original files.
async function sendHero(body, type, doneText) {
  const response = await fetch('/admin/api/hero-image', {
    method: 'POST',
    headers: { 'Content-Type': type },
    body
  });
  if (response.status === 401) {
    location.reload();
    throw new Error('登入已過期');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
  heroState = data.heroImage;
  $('heroFile').value = '';
  renderHero();
  setStatus('heroStatus', '✓ ' + doneText + '；下次同步（或按「立即同步」）會更新 Discord', 'ok');
  schedulePreview();
}

function startHeroCrop() {
  const file = $('heroFile').files[0];
  if (!file) {
    setStatus('heroStatus', '先選一張圖片', 'warn');
    return;
  }
  openCrop(file);
}

// ---- hero crop tool ----

async function openCrop(file) {
  if (!HERO_TYPES.includes(file.type)) {
    setStatus('heroStatus', '只接受 PNG、JPEG、WebP 或 GIF 圖片', 'bad');
    $('heroFile').value = '';
    return;
  }
  let bitmap;
  try {
    // Decoding the file directly keeps object URLs (and a blob: img-src) out of the CSP.
    bitmap = await createImageBitmap(file);
  } catch {
    setStatus('heroStatus', '讀不到這張圖片，換一張試試', 'bad');
    $('heroFile').value = '';
    return;
  }
  releaseCrop();
  const baseScale = Math.max(CROP_WIDTH / bitmap.width, CROP_HEIGHT / bitmap.height);
  crop = { file, bitmap, baseScale, zoom: 1, x: 0, y: 0, drag: null };
  centerCrop();
  $('cropZoom').value = '1';
  $('cropGifHint').classList.toggle('gone', file.type !== 'image/gif');
  setStatus('cropStatus', '原圖 ' + bitmap.width + '×' + bitmap.height + '，' + formatSize(file.size) + '，輸出 ' +
    CROP_WIDTH + '×' + CROP_HEIGHT);
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
  setStatus('heroStatus', '已取消，沒有上傳');
  $('heroFile').focus();
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

// Zooms around a point of the frame (in output pixels), keeping that point still.
function zoomCrop(zoom, anchorX = CROP_WIDTH / 2, anchorY = CROP_HEIGHT / 2) {
  if (!crop) return;
  const next = Math.min(CROP_MAX_ZOOM, Math.max(1, zoom));
  const ratio = (crop.baseScale * next) / cropScale();
  crop.x = anchorX - (anchorX - crop.x) * ratio;
  crop.y = anchorY - (anchorY - crop.y) * ratio;
  crop.zoom = next;
  clampCrop();
  $('cropZoom').value = String(next);
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
  for (const id of ['cropApplyBtn', 'cropRawBtn', 'cropCancelBtn', 'cropZoom']) {
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
  setStatus('cropStatus', '裁切中…');
  try {
    const canvas = element('canvas', { width: CROP_WIDTH, height: CROP_HEIGHT });
    paintCrop(canvas.getContext('2d'));
    const blob = await encodeCrop(canvas);
    if (!blob) {
      setStatus('cropStatus', '裁切後的圖還是超過 1.5 MB，請換一張比較簡單的圖', 'bad');
      return;
    }
    const summary = IMAGE_FORMAT_NAMES[blob.type] + ' ' + CROP_WIDTH + '×' + CROP_HEIGHT + '，' + formatSize(blob.size);
    setStatus('cropStatus', '上傳中…（' + summary + '）');
    await sendHero(blob, blob.type, '已上傳裁切後的圖（' + summary + '）');
    closeCrop();
  } catch (error) {
    setStatus('cropStatus', error.message, 'bad');
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
  setStatus('cropStatus', '上傳中…');
  try {
    await sendHero(file, file.type, '已上傳原圖（' + IMAGE_FORMAT_NAMES[file.type] + '，' + formatSize(file.size) + '）');
    closeCrop();
  } catch (error) {
    setStatus('cropStatus', error.message, 'bad');
  } finally {
    setCropBusy(false);
  }
}

async function deleteHero() {
  if (!confirm('要刪除上傳的大圖嗎？刪除後會顯示固定素材。')) return;
  const button = $('heroDeleteBtn');
  button.disabled = true;
  try {
    const data = await api('/admin/api/hero-image/delete', {});
    heroState = data.heroImage;
    renderHero();
    setStatus('heroStatus', '✓ 已刪除', 'ok');
    schedulePreview();
  } catch (error) {
    setStatus('heroStatus', error.message, 'bad');
    button.disabled = !heroState.upload;
  }
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
  lastPayload = payload;
  const heroUrl = heroFieldUrl(payload, map);
  const heroImg = $('pHeroImg');
  heroImg.classList.toggle('gone', !heroUrl);
  $('pTop').classList.toggle('with-hero', Boolean(heroUrl));
  if (heroUrl) {
    heroImg.src = heroPreviewSrc(heroUrl);
  } else {
    heroImg.removeAttribute('src');
  }
  renderHero();
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
  renderHero();
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
  heroState = data.heroImage || heroState;
  discordClientId = data.discordClientId || null;
  renderStatus(data.status);
  return data;
}

// ---- variable chips ----

document.addEventListener('focusin', (event) => {
  const el = event.target;
  if (el.tagName === 'INPUT' && el.type === 'text' && form.contains(el)) {
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
$('heroUploadBtn').addEventListener('click', startHeroCrop);
$('heroFile').addEventListener('change', () => {
  const file = $('heroFile').files[0];
  if (file) openCrop(file);
});
input('heroEditorConfirmed').addEventListener('change', () => {
  heroStepsOpen = false;
  renderHero();
});
$('heroEditorShowBtn').addEventListener('click', () => {
  heroStepsOpen = true;
  renderHero();
  input('heroEditorConfirmed').focus();
});
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
// Esc closes the dialog through "cancel"; route it through cancelCrop for cleanup.
$('cropDialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelCrop();
});
$('heroDeleteBtn').addEventListener('click', deleteHero);
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

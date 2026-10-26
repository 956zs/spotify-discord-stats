// Styles for the admin and login pages, served inline under the page's CSP nonce.
// Dark Discord-like palette; no external fonts. Layout: tabs + settings on the left,
// preview pinned on the right; under 900px the preview becomes a bottom sheet.

const BASE = `
:root {
  color-scheme: dark;
  --bg0:#1e1f22; --bg1:#2b2d31; --bg2:#313338; --bg3:#383a40; --input:#1e1f22; --card:#232428;
  --line:#3f4147; --line-soft:#2e3035;
  --text:#f2f3f5; --text2:#dbdee1; --muted:#b5bac1; --faint:#949ba4;
  --accent:#5865f2; --accent-hover:#4752c4; --accent-soft:rgba(88,101,242,.16); --accent-text:#c9cdfb; --link:#949cf7;
  --ok:#23a55a; --ok-soft:rgba(35,165,90,.14); --ok-text:#57d28a;
  --warn:#f0b232; --warn-soft:rgba(240,178,50,.12); --warn-text:#f5c665;
  --bad:#f23f43; --bad-soft:rgba(242,63,67,.13); --bad-text:#fa777c;
  --r1:4px; --r2:8px; --r3:12px; --r4:16px;
  --font: system-ui, -apple-system, "Segoe UI", "Noto Sans TC", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
  --mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
  --savebar-h:64px;
}
* { box-sizing:border-box; }
html, body { margin:0; }
body { background:var(--bg0); color:var(--text2); font:14px/1.5 var(--font); -webkit-font-smoothing:antialiased; }
h1, h2, h3 { color:var(--text); margin:0; font-weight:600; }
h1 { font-size:16px; } h2 { font-size:15px; } h3 { font-size:13px; }
p { margin:0; }
a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
[hidden], .gone { display:none !important; }
.sprite { position:absolute; width:0; height:0; overflow:hidden; }
.i { width:16px; height:16px; flex:none; vertical-align:-3px; }
.muted { color:var(--muted); } .faint { color:var(--faint); }
.small { font-size:12px; }
.sr { position:absolute !important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
code, .mono { font:12px var(--mono); }
code { background:var(--input); padding:1px 6px; border-radius:var(--r1); color:var(--text2); }
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

/* buttons */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:32px; padding:0 14px; border:0; border-radius:var(--r1);
  background:#4e5058; color:#fff; font:500 14px/1 var(--font); cursor:pointer; white-space:nowrap; text-decoration:none; transition:background .15s, color .15s; }
.btn:hover { background:#6d6f78; text-decoration:none; }
.btn.primary { background:var(--accent); } .btn.primary:hover { background:var(--accent-hover); }
.btn.ghost { background:transparent; color:var(--text2); } .btn.ghost:hover { background:var(--bg3); }
.btn.danger-ghost { background:transparent; color:var(--bad-text); } .btn.danger-ghost:hover { background:var(--bad-soft); }
.btn.sm { height:28px; padding:0 10px; font-size:13px; gap:6px; }
.btn.lg { height:40px; padding:0 18px; }
.btn.icon { width:32px; padding:0; } .btn.icon.sm { width:28px; }
.btn.wide { width:100%; }
.btn:disabled { opacity:.45; cursor:default; }
.btn:disabled:hover { background:#4e5058; } .btn.ghost:disabled:hover, .btn.danger-ghost:disabled:hover { background:transparent; } .btn.primary:disabled:hover { background:var(--accent); }

/* fields */
.field { display:flex; flex-direction:column; gap:6px; min-width:0; }
.field > .lab { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.02em; }
.key { font:11px var(--mono); color:var(--faint); background:var(--bg0); border:1px solid var(--line-soft); padding:0 6px; border-radius:var(--r1); font-weight:400; letter-spacing:0; }
.inp { width:100%; height:36px; padding:0 10px; background:var(--input); color:var(--text); border:1px solid transparent; border-radius:var(--r1); font:14px var(--font); min-width:0; }
.inp:hover { border-color:var(--line); }
.inp:focus { outline:2px solid var(--accent); outline-offset:-2px; border-color:transparent; }
.inp.sm { height:32px; font-size:13px; }
.inp.mono { font-family:var(--mono); font-size:13px; }
.inp::placeholder { color:#868a93; }
select.inp { appearance:none; padding-right:30px; cursor:pointer;
  background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position:calc(100% - 15px) 52%, calc(100% - 10px) 52%; background-size:5px 5px; background-repeat:no-repeat; }
select.inp option, select.inp optgroup { background:var(--bg2); color:var(--text); }
.hint { font-size:12px; color:var(--faint); margin:0; }

/* language switch */
.lang { display:inline-flex; align-items:center; gap:2px; background:var(--input); border-radius:999px; padding:3px; }
.lang .i { margin:0 4px 0 6px; color:var(--faint); width:14px; height:14px; }
.lang button { white-space:nowrap; height:24px; padding:0 10px; border:0; border-radius:999px; background:transparent; color:var(--muted); font:600 12px var(--font); cursor:pointer; }
.lang button:hover { color:var(--text); }
.lang button.on { background:var(--bg3); color:var(--text); }

/* tone lines */
.tone { display:flex; gap:8px; align-items:flex-start; font-size:13px; padding:8px 12px; border-radius:var(--r2); }
.tone .i { margin-top:2px; }
.tone.ok { color:var(--ok-text); background:var(--ok-soft); } .tone.warn { color:var(--warn-text); background:var(--warn-soft); } .tone.bad { color:var(--bad-text); background:var(--bad-soft); }
.tone.plain { color:var(--muted); background:var(--bg2); }
.logo { width:32px; height:32px; border-radius:var(--r2); background:var(--accent); display:grid; place-items:center; color:#fff; flex:none; }
.logo .i { width:18px; height:18px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition:none !important; animation:none !important; scroll-behavior:auto !important; } }
`;

const LOGIN = `
.login { min-height:100vh; display:grid; place-items:center; padding:24px 16px; }
.login-card { width:min(380px, 100%); background:var(--bg1); border-radius:var(--r3); padding:24px; display:flex; flex-direction:column; gap:16px; box-shadow:0 16px 48px rgba(0,0,0,.35); }
.login-top { display:flex; align-items:center; gap:12px; }
.login-top .lang { margin-left:auto; }
.login form { display:flex; flex-direction:column; gap:16px; }
`;

const ADMIN = `
/* keep focused fields clear of the sticky tabs and the fixed save bar */
html { scroll-padding-top:64px; scroll-padding-bottom:calc(var(--savebar-h) + 16px); }

/* header */
.top { min-height:56px; display:flex; align-items:center; gap:16px; padding:0 32px; background:var(--bg1); border-bottom:1px solid var(--bg0); }
.brand { display:flex; align-items:center; gap:12px; min-width:0; }
.brand h1 { white-space:nowrap; }
.brand h1 .faint { font-weight:400; }
.pills { display:flex; gap:8px; margin-left:16px; flex-wrap:wrap; }
.pill { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border:0; border-radius:999px; font:12px var(--font); background:var(--bg2); color:var(--muted); white-space:nowrap; cursor:pointer; }
.pill:hover { background:var(--bg3); }
.pill .dot { width:8px; height:8px; border-radius:50%; background:var(--faint); flex:none; }
.pill.ok .dot { background:var(--ok); } .pill.warn .dot { background:var(--warn); } .pill.bad .dot { background:var(--bad); }
.pill b { color:var(--text); font-weight:600; }
.top .right { margin-left:auto; display:flex; align-items:center; gap:12px; }
.who { font-size:12px; color:var(--faint); display:flex; align-items:center; gap:6px; white-space:nowrap; }
.who::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--ok); }
.top form { margin:0; }

/* tabs */
.tabs { position:sticky; top:0; z-index:15; background:var(--bg0); border-bottom:1px solid var(--line-soft); }
.tabs-in { max-width:1376px; margin:0 auto; padding:0 32px; display:flex; gap:4px; }
.tab { height:48px; padding:0 16px; display:inline-flex; align-items:center; gap:8px; border:0; background:none; color:var(--muted); font:500 14px var(--font); cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; }
.tab:hover { color:var(--text); }
.tab.on { color:var(--text); border-bottom-color:var(--accent); }
.tab:focus-visible { outline-offset:-4px; }
.tab .badge { width:8px; height:8px; border-radius:50%; background:var(--warn); }

/* layout */
.wrap { max-width:1376px; margin:0 auto; padding:24px 32px calc(var(--savebar-h) + 40px); display:grid; grid-template-columns:minmax(0,1fr) 420px; gap:24px; align-items:start; }
.panes { margin:0; min-width:0; }
.pane:focus-visible { outline:none; }
.panel { background:var(--bg1); border-radius:var(--r3); padding:20px 24px; margin-bottom:16px; transition:box-shadow .2s; }
.panel-h { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
.panel-h h2 { flex:none; white-space:nowrap; }
.panel-h .hint { margin-left:auto; text-align:right; min-width:0; }
.panel.stack > * + * { margin-top:16px; }
.panel.stack > .panel-h { margin-bottom:0; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.actions { display:flex; gap:8px; flex-wrap:wrap; }
.divider { border:0; border-top:1px solid var(--line-soft); margin:20px 0 0; }
.flash { box-shadow:0 0 0 3px var(--accent) !important; }
.field.flash { border-radius:var(--r1); box-shadow:0 0 0 4px var(--accent-soft) !important; }

/* range */
.rangerow { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
.seg { display:inline-flex; background:var(--input); border-radius:var(--r2); padding:3px; gap:2px; flex-wrap:wrap; }
.seg label, .seg button { position:relative; display:inline-flex; align-items:center; justify-content:center; height:28px; padding:0 12px; border:0; border-radius:6px; background:transparent; color:var(--muted); font:500 13px var(--font); cursor:pointer; white-space:nowrap; }
.seg label:hover, .seg button:hover { color:var(--text); background:var(--bg2); }
.seg label.on, .seg button.on { background:var(--accent); color:#fff; }
.seg label:has(input:focus-visible) { outline:2px solid var(--accent); outline-offset:2px; }
.seg input { position:absolute; opacity:0; width:1px; height:1px; margin:0; pointer-events:none; }
.custom-days { flex-direction:row; align-items:center; gap:8px; }
.custom-days .inp { width:96px; }
.custom-days.off { opacity:.45; }

/* chips */
.chipbar { display:flex; align-items:center; gap:12px; padding:8px 12px; background:var(--bg2); border-radius:var(--r2); margin-bottom:16px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.chip { height:24px; padding:0 8px; border-radius:999px; border:1px solid var(--line); background:var(--bg1); color:var(--accent-text); font:12px var(--mono); cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.chip:hover { border-color:var(--accent); background:var(--accent-soft); }
.chip .d { font:11px var(--font); color:var(--faint); }
.chipbar .target { margin-left:auto; font-size:12px; color:var(--faint); white-space:nowrap; }
.chipbar .target b { color:var(--accent-text); font-weight:500; }

/* slot rows */
.slots-h, .slotrow { display:grid; grid-template-columns:24px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,.9fr) 64px; gap:8px; align-items:center; }
.slots-h { padding:0 12px 8px; font-size:11px; font-weight:600; color:var(--faint); letter-spacing:.04em; }
.slotrow { padding:8px 12px; border-radius:var(--r2); border:1px solid transparent; transition:border-color .15s, background .15s, box-shadow .2s; }
.slotrow:nth-child(odd) { background:rgba(255,255,255,.015); }
.slotrow:hover { background:var(--bg2); }
.slotrow.linked { border-color:var(--accent); background:var(--accent-soft); }
.num { width:24px; height:24px; border-radius:50%; background:var(--bg3); display:grid; place-items:center; font-size:12px; font-weight:600; color:var(--text); cursor:help; }
.rangecell { display:flex; gap:4px; min-width:0; } .rangecell select { flex:1; min-width:0; } .rangecell .slot-custom { width:64px; flex:none; }
.move { display:flex; gap:2px; justify-content:flex-end; }

/* hero */
.modes { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; max-width:640px; }
.mode { border:1px solid var(--line); border-radius:var(--r2); background:var(--bg2); padding:8px; cursor:pointer; display:flex; flex-direction:column; gap:8px; position:relative; }
.mode:hover { border-color:#5d6069; }
.mode.on { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); background:linear-gradient(var(--accent-soft), var(--accent-soft)), var(--bg2); }
.mode:has(input:focus-visible) { outline:2px solid var(--accent); outline-offset:2px; }
.mthumb { width:100%; aspect-ratio:13/12; border-radius:6px; overflow:hidden; display:grid; place-items:center; background:var(--bg0); color:var(--faint); font-size:12px; text-align:center; padding:8px; }
.mthumb img { width:100%; height:100%; object-fit:cover; display:block; }
.mthumb:has(img) { padding:0; }
.mthumb.asset { background:linear-gradient(135deg, #1db954 0%, #127a3a 100%); color:#fff; gap:6px; align-content:center; }
.mthumb.asset .i { width:32px; height:32px; margin:0 auto; }
.mt { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text); font-weight:500; }
.radio { width:16px; height:16px; border-radius:50%; border:2px solid #80848e; flex:none; display:grid; place-items:center; }
.mode.on .radio { border-color:var(--accent); } .mode.on .radio::after { content:""; width:8px; height:8px; border-radius:50%; background:var(--accent); }
.remind { border:1px solid rgba(240,178,50,.45); background:var(--warn-soft); border-radius:var(--r2); padding:12px 16px; font-size:13px; }
.remind strong { color:var(--warn); display:flex; gap:8px; align-items:center; }
.remind ol { margin:8px 0; padding-left:20px; color:var(--text2); }
.remind ol li { margin:2px 0; }
.remind .row { display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-top:8px; }
.remind.done { border-color:var(--line); background:var(--bg2); padding:6px 12px; }
.done-line { display:flex; gap:8px; align-items:center; flex-wrap:wrap; color:var(--muted); font-size:12px; }
.cb { display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:14px; color:var(--text2); }
.cb input { width:18px; height:18px; margin:0; accent-color:var(--accent); cursor:pointer; }
.upload { display:grid; grid-template-columns:132px minmax(0,1fr); gap:16px; padding:12px; border-radius:var(--r2); background:var(--bg2); border:1px solid var(--line-soft); }
.upload .thumb { width:132px; aspect-ratio:13/12; border-radius:6px; overflow:hidden; display:grid; place-items:center; background:var(--bg0); border:1px dashed var(--line); color:var(--faint); font-size:12px; }
.upload .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.upload .thumb:has(img) { border-style:solid; border-color:transparent; }
.upload .meta { font-size:12px; color:var(--faint); margin:8px 0 0; }
.tpl { display:flex; gap:12px; align-items:center; font-size:12px; color:var(--faint); margin:12px 0 0; padding-top:12px; border-top:1px solid var(--line); }
.tpl img { width:72px; height:auto; aspect-ratio:13/12; border-radius:var(--r1); border:1px solid var(--line); flex:none; background:var(--bg0); }
.tpl a { white-space:nowrap; }
.status { font-size:13px; white-space:pre-wrap; }
.status:empty { display:none; }
.status.ok { color:var(--ok-text); } .status.warn { color:var(--warn-text); } .status.bad { color:var(--bad-text); }
.status.boxed { padding:8px 12px; border-radius:var(--r2); background:var(--bg2); color:var(--muted); }
.status.boxed.ok { background:var(--ok-soft); color:var(--ok-text); } .status.boxed.warn { background:var(--warn-soft); color:var(--warn-text); } .status.boxed.bad { background:var(--bad-soft); color:var(--bad-text); }

/* recap */
.switch { display:inline-flex; align-items:center; gap:10px; cursor:pointer; color:var(--text2); font-size:14px; position:relative; }
.switch input { position:absolute; opacity:0; width:40px; height:24px; margin:0; cursor:pointer; }
.switch .track { width:40px; height:24px; border-radius:12px; background:#80848e; position:relative; flex:none; transition:background .15s; }
.switch .track::after { content:""; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .15s; }
.switch input:checked + .track { background:var(--ok); } .switch input:checked + .track::after { left:19px; }
.switch input:focus-visible + .track { outline:2px solid var(--accent); outline-offset:2px; }
.sched { background:var(--bg2); border-radius:var(--r2); padding:12px 16px; }
.sched ul { margin:8px 0; padding-left:20px; }
.sched li { margin:2px 0; }

/* status */
.kv { display:grid; grid-template-columns:auto 1fr; gap:8px 16px; margin:0; font-size:13px; }
.kv dt { color:var(--faint); } .kv dd { margin:0; color:var(--text2); }
.kv b { color:var(--text); }
.kv .note { margin-left:8px; font-size:12px; }
.kv .note.warn { color:var(--warn-text); } .kv .note.bad { color:var(--bad-text); }
.meter { height:6px; width:160px; max-width:100%; border-radius:3px; background:var(--bg0); overflow:hidden; margin-top:4px; }
.meter > i { display:block; height:100%; background:var(--ok); border-radius:3px; }
.meter.warn > i { background:var(--warn); } .meter.bad > i { background:var(--bad); }
.result { display:flex; flex-direction:column; gap:8px; }
.result details summary { cursor:pointer; color:var(--muted); font-size:12px; }
pre.json { margin:8px 0 0; padding:12px; background:var(--bg0); border-radius:var(--r2); font:11.5px/1.55 var(--mono); color:var(--text2); overflow:auto; max-height:360px; white-space:pre; }
pre.json .k { color:#a5acfa; } pre.json .s { color:#7fd6a5; } pre.json .n { color:#f5c665; }

/* preview */
.side { position:sticky; top:64px; min-width:0; }
.prev-h { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.prev-h .seg { margin-left:auto; } .prev-h .seg button { height:24px; padding:0 10px; font-size:12px; }
.peek, .sheet-grab { display:none; }
.loading-note { display:flex; gap:8px; align-items:flex-start; font-size:12px; color:var(--faint); margin-top:12px; }
.loading-note .i { margin-top:1px; }
.loading-flag { margin-left:8px; font-size:12px; color:var(--faint); display:none; }
.side.loading .loading-flag { display:inline; }
.wcard { background:var(--card); border-radius:var(--r2); container-type:inline-size; position:relative; margin-top:16px; box-shadow:0 0 0 1px rgba(255,255,255,.04); transition:opacity .15s; }
.wcard.loading { opacity:.45; }
.wtop { position:relative; padding:14px; border-bottom:1px solid var(--line-soft); line-height:1.4; }
/* Discord sizes the top area to the 1300x1200 image on the right half; its top 4% rises above the card edge. */
.wtop.with-hero { min-height:43.9cqw; }
.wtop.with-hero > :not(.whero) { position:relative; max-width:58%; }
.whero { position:absolute; right:0; bottom:0; width:49.5cqw; aspect-ratio:13/12; object-fit:cover;
  -webkit-mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 17%, #000 35%); mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.35) 17%, #000 35%); }
.wuser { font-size:12px; color:var(--faint); }
.wtitle { font-size:18px; font-weight:600; color:var(--text); margin:6px 0 2px; }
.wsmall { font-size:12px; color:var(--faint); word-break:break-word; }
.wmain { font-size:14px; color:var(--text2); margin-top:8px; }
.wstats { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:10px; }
.wstat { padding:6px 8px; border-radius:6px; border:1px solid transparent; }
.wval { font-size:14px; color:var(--text); word-break:break-word; }
.wlab { font-size:11px; color:var(--faint); }
.wstat.linked { background:var(--accent-soft); border-color:var(--accent); }
.jump { cursor:pointer; border-radius:4px; outline:1px dashed transparent; outline-offset:2px; transition:outline-color .15s, background .15s; }
.wtop .jump:empty { min-height:1em; }
.jump:hover { outline-color:var(--accent); }
.jump:focus-visible { outline:2px solid var(--accent); }
.jump.auto { cursor:help; }
.jump.auto:hover { outline-color:var(--faint); }
.wstat.jump { outline-style:none; }
.wstat.jump:hover { border-color:var(--accent); background:var(--accent-soft); }
.wstat.jump:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
img.whero.jump:hover, img.whero.jump:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }

/* toast */
.toast { position:fixed; top:112px; left:50%; transform:translateX(-50%); z-index:40; max-width:min(520px, calc(100vw - 32px)); display:flex; gap:8px; align-items:flex-start;
  background:var(--bg3); color:var(--text); border:1px solid var(--line); border-radius:var(--r2); padding:10px 14px; font-size:13px; box-shadow:0 12px 32px rgba(0,0,0,.45); }
.toast .i { margin-top:2px; color:var(--accent-text); }

/* save bar */
.savebar { position:fixed; left:0; right:0; bottom:0; z-index:20; background:var(--bg1); border-top:1px solid var(--bg0); box-shadow:0 -8px 24px rgba(0,0,0,.25); }
.savebar-in { max-width:1376px; margin:0 auto; padding:12px 32px; display:flex; align-items:center; gap:12px; }
.save-status { display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); min-width:0; }
.save-status.warn { color:var(--warn); }
.save-status.warn::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--warn); flex:none; }
.save-status.ok { color:var(--ok-text); } .save-status.bad { color:var(--bad-text); }
.kbdhint { margin-left:auto; font-size:12px; color:var(--faint); white-space:nowrap; }
kbd { font:11px var(--mono); padding:1px 6px; border-radius:var(--r1); background:var(--bg3); border:1px solid var(--line); color:var(--muted); }
.savebar .short { display:none; }

/* crop dialog */
dialog.crop { width:min(1000px, calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 24px); padding:24px; background:var(--bg2); color:var(--text2); border:0; border-radius:var(--r3); box-shadow:0 16px 48px rgba(0,0,0,.5); }
dialog.crop::backdrop { background:rgba(0,0,0,.72); }
.crop-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
.crop-head .hint { margin-top:4px; }
.crop-grid { display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:24px; align-items:start; }
.crop-stage { position:relative; width:min(100%, calc((100vh - 290px) * 13 / 12)); aspect-ratio:13/12; margin:0 auto; background:#000; border-radius:var(--r2); overflow:hidden; touch-action:none; user-select:none; cursor:grab; }
.crop-stage.dragging { cursor:grabbing; }
.crop-stage canvas { display:block; width:100%; height:100%; }
.crop-guides { position:absolute; inset:0; pointer-events:none; font-size:11px; line-height:1.3; color:#fff; }
.crop-guides span { position:absolute; padding:1px 6px; border-radius:3px; background:rgba(0,0,0,.65); white-space:nowrap; }
.g-top { position:absolute; left:0; right:0; top:0; height:4%; background:rgba(242,63,67,.38); border-bottom:1px dashed var(--bad); }
.g-top span { left:50%; top:100%; transform:translateX(-50%); margin-top:4px; }
.g-heavy, .g-minor { position:absolute; top:4%; bottom:0; }
.g-heavy { left:0; width:17%; background:rgba(0,0,0,.55); border-right:1px dashed rgba(255,255,255,.6); }
.g-minor { left:17%; width:18%; background:rgba(0,0,0,.25); border-right:1px dashed rgba(255,255,255,.45); }
.g-heavy span, .g-minor span { left:50%; top:40%; transform:translateX(-50%); }
.g-line { position:absolute; left:0; right:0; border-top:2px dashed var(--ok); }
.g-line span { right:8px; bottom:4px; background:rgba(35,165,90,.85); }
.g-line1 { top:69.6%; } .g-line2 { top:80%; } .g-line3 { top:90%; }
.crop-ctl { display:flex; gap:16px; align-items:center; margin-top:16px; flex-wrap:wrap; }
.crop-zoom { flex:1; min-width:200px; display:flex; align-items:center; gap:12px; font-size:13px; color:var(--muted); }
.crop-zoom input { flex:1; margin:0; accent-color:var(--accent); }
.crop-zoom output { min-width:3.5em; text-align:right; font-variant-numeric:tabular-nums; }
.crop-side .tpl { flex-direction:column; align-items:stretch; margin:0; padding:0; border:0; }
.crop-side .tpl img { width:100%; }
.crop-foot { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-top:16px; flex-wrap:wrap; }
.crop-foot .actions { margin-left:auto; }
#cropStatus { margin-top:12px; }

@media (max-width: 1100px) {
  .pills { display:none; }
}
@media (max-width: 899px) {
  .top { padding:0 12px; min-height:52px; gap:8px; }
  .who, .brand h1 .faint, .logout-text { display:none; }
  .top .right { gap:8px; }
  .tabs-in { padding:0 8px; overflow-x:auto; scrollbar-width:none; }
  .tabs-in::-webkit-scrollbar { display:none; }
  .tab { padding:0 10px; height:44px; gap:6px; }
  html:lang(en) .tab .i { display:none; }
  html { scroll-padding-top:56px; scroll-padding-bottom:calc(var(--savebar-h) + 96px); }
  .wrap { grid-template-columns:1fr; padding:16px 12px calc(var(--savebar-h) + 96px); gap:0; }
  .panel { padding:16px; border-radius:var(--r2); margin-bottom:12px; }
  .panel-h { flex-wrap:wrap; } .panel-h .hint { margin-left:0; flex-basis:100%; text-align:left; }
  .rangerow .seg { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); width:100%; }
  .rangerow .seg label { padding:0 2px; }
  .custom-days.off { display:none; }
  .grid2 { grid-template-columns:1fr; gap:12px; }
  .chipbar { flex-wrap:wrap; } .chipbar .target { margin-left:0; flex-basis:100%; white-space:normal; }
  .slots-h { display:none; }
  /* metric full width; the up/down buttons stack under the number */
  .slotrow { grid-template-columns:28px minmax(0,1.25fr) minmax(0,1fr); grid-template-areas:"num metric metric" "move range range" "move label value"; row-gap:8px; padding:12px; background:var(--bg2) !important; margin-bottom:8px; }
  .slotrow.linked { background:var(--accent-soft) !important; }
  .slotrow .num { grid-area:num; } .slotrow .slot-metric { grid-area:metric; } .slotrow .rangecell { grid-area:range; }
  .slotrow .slot-label { grid-area:label; } .slotrow .slot-value { grid-area:value; }
  .slotrow .move { grid-area:move; flex-direction:column; justify-content:space-around; align-items:center; align-self:stretch; }
  .slotrow .num { justify-self:center; }
  .modes { gap:6px; } .mode { padding:6px; } .mode .mt { font-size:12px; align-items:flex-start; }
  .mthumb.asset > span { display:none; }
  .upload { grid-template-columns:1fr; } .upload .thumb { width:100%; max-width:200px; }
  .kv { grid-template-columns:1fr; gap:2px 0; } .kv dd { margin-bottom:8px; }

  /* preview becomes a bottom sheet above the save bar */
  .side { position:fixed; top:auto; left:0; right:0; bottom:var(--savebar-h); z-index:19; }
  .side > .panel { margin:0; padding:0; border-radius:var(--r4) var(--r4) 0 0; background:var(--bg2); border-top:1px solid var(--line); box-shadow:0 -12px 32px rgba(0,0,0,.45); }
  .sheet-grab { display:block; width:40px; height:4px; border-radius:2px; background:#5d6069; margin:8px auto 4px; }
  .peek { display:flex; align-items:center; gap:12px; width:100%; padding:4px 16px 12px; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .peek:focus-visible { outline-offset:-2px; }
  .peek-thumb { width:44px; height:40px; border-radius:6px; overflow:hidden; background:var(--bg0); flex:none; display:grid; place-items:center; color:var(--faint); }
  .peek-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .pt { min-width:0; flex:1; display:flex; flex-direction:column; }
  .pt b, .pt span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pt b { color:var(--text); font-size:14px; } .pt > span { font-size:12px; color:var(--faint); }
  .peek .chev { transition:transform .15s; }
  .side.open .peek .chev { transform:rotate(180deg); }
  .sheet-body { display:none; padding:0 16px 16px; max-height:calc(100vh - var(--savebar-h) - 140px); overflow:auto; overscroll-behavior:contain; }
  .side.open .sheet-body { display:block; }
  .sheet-body .prev-h h2 { display:none; }
  .sheet-body .prev-h .seg { margin-left:0; }
  .sheet-body .wcard { margin-top:12px; }

  .savebar-in { padding:10px 12px calc(10px + env(safe-area-inset-bottom)); display:grid; grid-template-columns:auto 1fr auto; gap:8px; }
  .save-status { grid-column:1 / -1; }
  #resetBtn { order:1; } #saveBtn { order:2; } #saveOnlyBtn { order:3; }
  .kbdhint { display:none; }
  #resetBtn { width:36px; padding:0; } #resetBtn .lbl { display:none; }
  .savebar .long { display:none; } .savebar .short { display:inline; }
  .toast { top:auto; bottom:calc(var(--savebar-h) + 80px); }

  dialog.crop { padding:16px; }
  .crop-grid { grid-template-columns:1fr; gap:12px; }
  .crop-stage { width:100%; }
  .crop-side .tpl { flex-direction:row; align-items:center; }
  .crop-side .tpl img { width:72px; }
  .crop-foot .actions { margin-left:0; width:100%; }
  .crop-foot .actions .btn { flex:1 1 auto; }
}
`;

export const LOGIN_STYLE = BASE + LOGIN;
export const ADMIN_STYLE = BASE + ADMIN;

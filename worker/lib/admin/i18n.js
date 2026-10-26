// UI copy for the admin and login pages in Traditional Chinese and English. The pages
// render server-side in the browser's language (Accept-Language) and switch live in
// the browser; the same table is sent to the page script. `{name}` is replaced only
// when a value for `name` is passed, so placeholders such as {range} can appear as is.
// Widget payload text and recap DMs are user-configured / Discord-facing and are not
// translated here.

export const LANGUAGES = ['zh-TW', 'en'];
export const DEFAULT_LANGUAGE = 'en';

// Both languages must have exactly the same keys (a test checks this).
export const MESSAGES = {
  'zh-TW': {
    // Page title, header bar (language switch, sign-in state, status pills)
    'doc.title': 'Spotify Stats Admin',
    'lang.label': '語言',
    'header.signedIn': '已登入',
    'header.logout': '登出',
    'pill.auth': 'Spotify 授權剩',
    'pill.authNone': 'Spotify 尚未授權',
    'pill.authExpired': 'Spotify 授權已過期',
    'pill.pushed': '上次推送',
    'pill.never': '尚未推送',
    'pill.open': '查看狀態',
    'unit.days': '{n} 天',
    'unit.day': '{n} 天',

    // Tab bar (the dot on the hero tab means the widget editor step is pending)
    'tabs.label': '設定分頁',
    'tab.widget': 'Widget',
    'tab.hero': '大圖',
    'tab.recap': '週報月報',
    'tab.status': '狀態',
    'tab.heroPending': '還要設定 widget 編輯器',

    // Widget tab: stats range panel (segmented buttons + custom days)
    'range.title': '統計區間',
    'range.hint': '{range}、日期區間和「跟隨全域」的統計格都用這個',
    'range.7': '7 天',
    'range.28': '28 天',
    'range.90': '90 天',
    'range.365': '365 天',
    'range.all': '全部',
    'range.custom': '自訂',
    'range.customDays': '自訂天數',

    // Widget tab: widget text panel (placeholder chips + four text fields)
    'text.title': 'Widget 文字',
    'text.insert': '插入變數',
    'text.target': '插入到：',
    'text.targetNone': '先點一下文字欄位',
    'chip.count': '播放次數',
    'chip.value': '統計格數值',
    'chip.valueTitle': '統計格的數值（只用在數值格式）',
    'chips.needTarget': '先點一下要插入的文字欄位',
    'field.username': 'Username',
    'field.topHeroTitle': 'Hero 標題',
    'field.mainTitle': '主標題',
    'field.lastUpdatedPrefix': '更新時間前綴',
    'field.slotLabel': '第 {n} 格標籤',
    'field.slotValue': '第 {n} 格數值格式',

    // Widget tab: six stat slot rows (metric, range, label, value format, reorder)
    'slots.title': '統計格',
    'slots.hint': '格內的變數套用該格自己的區間；換統計項目時，還是預設文字的標籤會自動換成新的預設標籤；點預覽的格子可以跳到這裡',
    'slots.metric': '統計項目',
    'slots.range': '區間',
    'slots.label': '標籤',
    'slots.value': '數值格式',
    'slots.valuePlaceholder': '例如 {value}',
    'slots.days': '天數',
    'slots.up': '上移',
    'slots.down': '下移',
    'slots.field': 'Discord 欄位：{field}',
    'slotRange.global': '跟隨全域',
    'slotRange.days': '{n} 天',
    'slotRange.all': '全部歷史',
    'slotRange.custom': '自訂天數',

    // Hero image tab: mode cards, widget editor reminder, upload box, status line
    'hero.title': 'Widget 大圖',
    'hero.hint': 'Widget Top 最上面的大圖（hero_image），建議 1300×1200。Discord 可能會快取圖片，換圖後要等一下才會看到。',
    'hero.modes': '大圖來源',
    'hero.mode.asset': '固定素材',
    'hero.mode.upload': '自訂上傳',
    'hero.mode.album': '最近播放的專輯封面',
    'hero.thumb.asset': 'widget 編輯器的 Fallback 圖',
    'hero.thumb.noUpload': '尚未上傳',
    'hero.thumb.noAlbum': '沒有封面',
    'hero.editor.title': '還要改 widget 編輯器，Discord 才會換圖',
    'hero.editor.step1': '到 Discord Developer Portal 的 widget 編輯器，把 Widget Top 的 Image 改成 Value Type「User Data」',
    'hero.editor.step2a': 'Data Field 填',
    'hero.editor.step2b': '，打開 Fallback 並選回原本的圖片素材',
    'hero.editor.step3': '按 Save changes（已發佈的 widget 會再問一次，按 Update）',
    'hero.editor.note': '沒改的話 Discord 會一直顯示原本的圖。',
    'hero.editor.open': '打開 widget 編輯器',
    'hero.editor.confirm': '我已經在 widget 編輯器設定好了',
    'hero.editor.done': '已在 widget 編輯器設定好大圖',
    'hero.editor.showAgain': '再看一次步驟',
    'hero.choose': '選擇圖片並裁切',
    'hero.fileLabel': '選擇圖片',
    'hero.delete': '刪除',
    'hero.limits': 'PNG、JPEG、WebP 或 GIF，最大 1.5 MB。上傳和刪除會立即生效。',
    'hero.meta': '{type} · {size} · 更新於 {date}',
    'hero.current': '目前的大圖',
    'hero.template.alt': '大圖範本：1300×1200 參考線',
    'hero.template.caption': '範本：1300×1200，左邊兩段會淡出，最上面 4% 會超出卡片。',
    'hero.template.download': '下載範本',
    'hero.warn.noBaseUrl': '沒有設定 PUBLIC_BASE_URL，Discord 抓不到上傳的圖，會顯示固定素材',
    'hero.warn.noUpload': '還沒上傳圖片，目前會顯示固定素材',
    'hero.warn.noAlbum': '最近播放的歌沒有專輯封面，目前會顯示固定素材',
    'hero.uploaded': '{what}；下次同步（或按「立即同步」）會更新 Discord',
    'hero.uploadedCrop': '已上傳裁切後的圖（{summary}）',
    'hero.uploadedRaw': '已上傳原圖（{summary}）',
    'hero.deleteConfirm': '要刪除上傳的大圖嗎？刪除後會顯示固定素材。',
    'hero.deleted': '已刪除',
    'hero.tooBig': '圖片太大了（{size}），上限是 1.5 MB，請先壓縮或縮小尺寸',
    'hero.unreadable': '讀不到這張圖片，換一張試試',
    'hero.cancelled': '已取消，沒有上傳',

    // Crop dialog (opens after picking an image on the hero image tab)
    'crop.title': '裁切 Widget 大圖',
    'crop.hint': '拖曳移動圖片，用滑桿或滑鼠滾輪縮放（鍵盤：方向鍵移動、+ / − 縮放）。輸出固定 1300×1200；參考線不會出現在上傳的圖上。',
    'crop.gifHint': 'GIF 裁切後會變成靜態圖片；要保留動畫請按「不裁切直接上傳」。',
    'crop.stage': '裁切範圍：拖曳或用方向鍵移動，+ / − 縮放',
    'crop.guide.top': 'BOUNDARIES AREA（會超出卡片上緣）',
    'crop.guide.heavy': '強淡出',
    'crop.guide.minor': '弱淡出',
    'crop.zoom': '縮放',
    'crop.guides': '顯示參考線',
    'crop.cancel': '取消',
    'crop.raw': '不裁切直接上傳',
    'crop.apply': '套用並上傳',
    'crop.close': '關閉',
    'crop.source': '原圖 {w}×{h}，{size}，輸出 {ow}×{oh}',
    'crop.working': '裁切中…',
    'crop.uploading': '上傳中…',
    'crop.uploadingSummary': '上傳中…（{summary}）',
    'crop.tooBig': '裁切後的圖還是超過 1.5 MB，請換一張比較簡單的圖',

    // Recaps tab: auto-send switch, schedule, manual send buttons
    'recap.title': '週報 / 月報 DM',
    'recap.toggle': '自動發送週報 / 月報 DM',
    'recap.toggleHint': '這個開關跟其他設定一起儲存（按「只儲存」或「儲存並推送」）。',
    'recap.scheduleTitle': '什麼時候寄',
    'recap.weekly': '週報：每{weekday} {time}（{zone}），內容是最近 7 天。',
    'recap.monthly': '月報：每月 {day} 日 {time}（{zone}），內容是上個月。',
    'recap.dmNote': 'DM 由你的 bot 寄給 DISCORD_USER_ID；DM 的內容是英文，不會跟著這裡的語言變。',
    'recap.testTitle': '手動發送',
    'recap.testHint': '要馬上看看效果可以手動發送一次（會先確認）。這會寄出真的 DM。',
    'recap.sendWeekly': '發送週報',
    'recap.sendMonthly': '發送月報',
    'recap.confirmWeekly': '要立即發送週報 DM 嗎？',
    'recap.confirmMonthly': '要立即發送月報 DM 嗎？',
    'recap.sent': '已發送 {n} 則 DM',
    'recap.sentOne': '已發送 1 則 DM',
    'recap.notSent': '未發送：{reason}',

    // Status tab: status list, sync / reauth buttons, last action result
    'status.title': '狀態與操作',
    'status.authLeft': 'Spotify 授權剩餘',
    'status.authAt': 'Spotify 授權時間',
    'status.expiresAt': 'Spotify 授權到期',
    'status.lastPushed': '上次推送 Discord',
    'status.notConnected': '尚未授權',
    'status.expired': '已過期，請重新授權',
    'status.soon': '快到期了，請重新授權',
    'status.ago': '（{ago}）',
    'status.sync': '立即同步',
    'status.syncHint': '抓最新的播放紀錄、重算統計並推送到 Discord。',
    'status.reauth': 'Spotify 重新授權',
    'status.reauthHint': 'Spotify 授權大約 {days} 天後要重新連結；剩 {remind} 天起 bot 會 DM 提醒你。',
    'status.lastAction': '上次操作結果',
    'status.noAction': '還沒有操作',

    // Action result lines (status and recaps tabs, also after save & push)
    'action.running': '執行中…',
    'action.raw': '原始回應',
    'sync.fetched': '抓到 {fetched} 筆、新增 {inserted} 筆',
    'sync.patched': 'Discord 已更新',
    'sync.failed': 'widget 推送失敗：{error}',
    'sync.notPatched': 'Discord 未更新：{reason}',
    'list.sep': '；',

    // Preview column (desktop) / bottom sheet (mobile), click-to-jump hints
    'preview.title': '預覽',
    'preview.view': '預覽方式',
    'preview.card': '卡片',
    'preview.json': 'JSON',
    'preview.hint': '點卡片任一處跳到對應設定 · 預覽會在停止輸入 0.4 秒後更新',
    'preview.heroAlt': 'Widget 大圖',
    'preview.loading': '更新中…',
    'preview.jumpSlot': '跳到第 {n} 格',
    'preview.jumpField': '編輯「{field}」',
    'preview.jumpHero': '到大圖分頁',
    'preview.jumpRange': '到統計區間',
    'preview.autoDuring': '日期區間是依統計區間自動產生的，已跳到統計區間。',
    'preview.autoSong': '這一行會自動顯示最近播放的歌，不能編輯。',
    'preview.autoTitle': '自動產生',
    'preview.toggle': '展開或收合預覽',

    // Sticky save bar at the bottom
    'save.dirty': '有 {n} 項未儲存的變更',
    'save.dirtyOne': '有 1 項未儲存的變更',
    'save.clean': '已是最新',
    'save.kbd': '儲存並推送',
    'save.reset': '填回預設值',
    'save.only': '只儲存',
    'save.push': '儲存並推送到 Discord',
    'save.pushShort': '儲存並推送',
    'save.saving': '儲存中…',
    'save.pushing': '已儲存，推送中…',
    'save.pushFailed': '✓ 已儲存，但推送失敗：{error}',
    'save.pushed': '✓ 已儲存並推送到 Discord',
    'save.savedWith': '✓ 已儲存（{summary}）',
    'save.saved': '✓ 已儲存，下次同步（10 分鐘內）會套用',
    'save.resetDone': '已填回預設值（尚未儲存）',

    // Errors, by the `code` the server sends (see ERROR_CODES in worker/lib/http.js)
    'err.unauthorized': '登入已過期，請重新登入',
    'err.forbidden': '請求被拒絕（來源不符）',
    'err.method_not_allowed': '不支援這個請求方法',
    'err.not_found': '找不到這個路徑',
    'err.expected_json': '請求格式錯誤（需要 JSON）',
    'err.invalid_json': 'JSON 格式錯誤',
    'err.invalid_settings': '設定無效',
    'err.withDetails': '{message}：{details}',
    'err.image_type': '只接受 PNG、JPEG、WebP 或 GIF 圖片',
    'err.image_too_large': '圖片太大了，上限是 1.5 MB，請先壓縮或縮小尺寸',
    'err.image_empty': '圖片是空的',
    'err.image_mismatch': '檔案內容和圖片格式不符，請上傳真正的 PNG、JPEG、WebP 或 GIF',
    'err.missing_config': '伺服器少了設定',
    'err.spotify_not_connected': '還沒連結 Spotify，請按「Spotify 重新授權」',
    'err.spotify_token_failed': 'Spotify 拒絕了授權，可能要重新授權',
    'err.spotify_rate_limited': 'Spotify 暫時限制請求次數，稍後再試',
    'err.spotify_api_failed': 'Spotify API 發生錯誤，稍後再試',
    'err.discord_dm_failed': 'Discord DM 發送失敗',
    'err.http': 'HTTP {status}',
    'err.network': '連不上伺服器',

    // Login page
    'login.hint': '輸入部署時設定的 ADMIN_TOKEN。',
    'login.submit': '登入',
    'login.failed': 'Token 不正確'
  },
  en: {
    // Page title, header bar (language switch, sign-in state, status pills)
    'doc.title': 'Spotify Stats Admin',
    'lang.label': 'Language',
    'header.signedIn': 'Signed in',
    'header.logout': 'Log out',
    'pill.auth': 'Spotify auth expires in',
    'pill.authNone': 'Spotify not connected',
    'pill.authExpired': 'Spotify auth expired',
    'pill.pushed': 'Last pushed',
    'pill.never': 'Never pushed',
    'pill.open': 'View status',
    'unit.days': '{n} days',
    'unit.day': '{n} day',

    // Tab bar (the dot on the hero tab means the widget editor step is pending)
    'tabs.label': 'Settings tabs',
    'tab.widget': 'Widget',
    'tab.hero': 'Hero image',
    'tab.recap': 'Recaps',
    'tab.status': 'Status',
    'tab.heroPending': 'Still to set up in the widget editor',

    // Widget tab: stats range panel (segmented buttons + custom days)
    'range.title': 'Stats range',
    'range.hint': 'Used by {range}, the date line and stat slots set to “Follow global”.',
    'range.7': '7d',
    'range.28': '28d',
    'range.90': '90d',
    'range.365': '365d',
    'range.all': 'All time',
    'range.custom': 'Custom',
    'range.customDays': 'Custom days',

    // Widget tab: widget text panel (placeholder chips + four text fields)
    'text.title': 'Widget text',
    'text.insert': 'Insert variable',
    'text.target': 'Insert into: ',
    'text.targetNone': 'Click a text field first',
    'chip.count': 'play count',
    'chip.value': 'slot value',
    'chip.valueTitle': 'The slot value (value formats only)',
    'chips.needTarget': 'Click the text field you want to insert into first',
    'field.username': 'Username',
    'field.topHeroTitle': 'Hero title',
    'field.mainTitle': 'Main title',
    'field.lastUpdatedPrefix': 'Last-updated prefix',
    'field.slotLabel': 'Slot {n} label',
    'field.slotValue': 'Slot {n} value format',

    // Widget tab: six stat slot rows (metric, range, label, value format, reorder)
    'slots.title': 'Stat slots',
    'slots.hint': 'Variables in a slot use that slot’s own range. When you change the metric, a label that still has its default text is replaced with the new default label. Click a preview cell to jump here.',
    'slots.metric': 'Metric',
    'slots.range': 'Range',
    'slots.label': 'Label',
    'slots.value': 'Value format',
    'slots.valuePlaceholder': 'e.g. {value}',
    'slots.days': 'Days',
    'slots.up': 'Move up',
    'slots.down': 'Move down',
    'slots.field': 'Discord field: {field}',
    'slotRange.global': 'Follow global',
    'slotRange.days': '{n} days',
    'slotRange.all': 'All time',
    'slotRange.custom': 'Custom days',

    // Hero image tab: mode cards, widget editor reminder, upload box, status line
    'hero.title': 'Widget hero image',
    'hero.hint': 'The big image at the top of Widget Top (hero_image). 1300×1200 is recommended. Discord may cache images, so a new one can take a while to show.',
    'hero.modes': 'Hero image source',
    'hero.mode.asset': 'Fixed asset',
    'hero.mode.upload': 'Custom upload',
    'hero.mode.album': 'Last played album cover',
    'hero.thumb.asset': 'The Fallback image from the widget editor',
    'hero.thumb.noUpload': 'Not uploaded yet',
    'hero.thumb.noAlbum': 'No cover',
    'hero.editor.title': 'One more step in the widget editor, or Discord keeps the old image',
    'hero.editor.step1': 'In the Discord Developer Portal widget editor, change Widget Top’s Image to Value Type “User Data”',
    'hero.editor.step2a': 'Set Data Field to',
    'hero.editor.step2b': ', turn on Fallback and select the original image asset again',
    'hero.editor.step3': 'Click Save changes (a published widget asks again: click Update)',
    'hero.editor.note': 'If you skip this, Discord keeps showing the original image.',
    'hero.editor.open': 'Open the widget editor',
    'hero.editor.confirm': 'I have set this up in the widget editor',
    'hero.editor.done': 'Hero image is set up in the widget editor',
    'hero.editor.showAgain': 'Show the steps again',
    'hero.choose': 'Choose & crop an image',
    'hero.fileLabel': 'Choose an image',
    'hero.delete': 'Delete',
    'hero.limits': 'PNG, JPEG, WebP or GIF, max 1.5 MB. Upload and delete apply immediately.',
    'hero.meta': '{type} · {size} · updated {date}',
    'hero.current': 'Current hero image',
    'hero.template.alt': 'Hero template: 1300×1200 guides',
    'hero.template.caption': 'Template 1300×1200: the two left bands fade out, the top 4% rises above the card.',
    'hero.template.download': 'Download template',
    'hero.warn.noBaseUrl': 'PUBLIC_BASE_URL is not set, so Discord cannot fetch the upload and shows the fixed asset',
    'hero.warn.noUpload': 'No image uploaded yet; the fixed asset shows for now',
    'hero.warn.noAlbum': 'The last played song has no album cover; the fixed asset shows for now',
    'hero.uploaded': '{what}; the next sync (or Sync now) updates Discord',
    'hero.uploadedCrop': 'Uploaded the cropped image ({summary})',
    'hero.uploadedRaw': 'Uploaded the original image ({summary})',
    'hero.deleteConfirm': 'Delete the uploaded hero image? The fixed asset shows instead.',
    'hero.deleted': 'Deleted',
    'hero.tooBig': 'The image is too large ({size}); the limit is 1.5 MB. Compress or shrink it first.',
    'hero.unreadable': 'This image could not be read; try another one',
    'hero.cancelled': 'Cancelled, nothing was uploaded',

    // Crop dialog (opens after picking an image on the hero image tab)
    'crop.title': 'Crop the widget hero image',
    'crop.hint': 'Drag to move, use the slider or mouse wheel to zoom (keyboard: arrow keys move, + / − zoom). The output is always 1300×1200; the guides are not part of the upload.',
    'crop.gifHint': 'Cropping turns a GIF into a still image; use “Upload without cropping” to keep the animation.',
    'crop.stage': 'Crop area: drag or use the arrow keys to move, + / − to zoom',
    'crop.guide.top': 'BOUNDARIES AREA (rises above the card)',
    'crop.guide.heavy': 'Strong fade',
    'crop.guide.minor': 'Soft fade',
    'crop.zoom': 'Zoom',
    'crop.guides': 'Show guides',
    'crop.cancel': 'Cancel',
    'crop.raw': 'Upload without cropping',
    'crop.apply': 'Apply & upload',
    'crop.close': 'Close',
    'crop.source': 'Source {w}×{h}, {size} → output {ow}×{oh}',
    'crop.working': 'Cropping…',
    'crop.uploading': 'Uploading…',
    'crop.uploadingSummary': 'Uploading… ({summary})',
    'crop.tooBig': 'The cropped image is still over 1.5 MB; try a simpler image',

    // Recaps tab: auto-send switch, schedule, manual send buttons
    'recap.title': 'Weekly / monthly recap DMs',
    'recap.toggle': 'Send weekly / monthly recap DMs automatically',
    'recap.toggleHint': 'This switch is saved with the other settings (Save only or Save & push).',
    'recap.scheduleTitle': 'When to send',
    'recap.weekly': 'Weekly: every {weekday} at {time} ({zone}), covering the last 7 days.',
    'recap.monthly': 'Monthly: on day {day} of each month at {time} ({zone}), covering the previous month.',
    'recap.dmNote': 'Your bot sends the DMs to DISCORD_USER_ID. The DM text is in English and does not follow this page’s language.',
    'recap.testTitle': 'Send now',
    'recap.testHint': 'To check the result, send one now (you will be asked to confirm first). This sends real DMs.',
    'recap.sendWeekly': 'Send weekly',
    'recap.sendMonthly': 'Send monthly',
    'recap.confirmWeekly': 'Send the weekly recap DM now?',
    'recap.confirmMonthly': 'Send the monthly recap DM now?',
    'recap.sent': 'Sent {n} DMs',
    'recap.sentOne': 'Sent 1 DM',
    'recap.notSent': 'Not sent: {reason}',

    // Status tab: status list, sync / reauth buttons, last action result
    'status.title': 'Status & actions',
    'status.authLeft': 'Spotify authorization left',
    'status.authAt': 'Spotify authorized at',
    'status.expiresAt': 'Spotify authorization expires',
    'status.lastPushed': 'Last pushed to Discord',
    'status.notConnected': 'Not connected',
    'status.expired': 'Expired, reconnect Spotify',
    'status.soon': 'Expiring soon, reconnect Spotify',
    'status.ago': ' ({ago})',
    'status.sync': 'Sync now',
    'status.syncHint': 'Fetches the latest plays, recalculates the stats and pushes them to Discord.',
    'status.reauth': 'Reconnect Spotify',
    'status.reauthHint': 'Spotify needs reconnecting about every {days} days. Reminder DMs start when {remind} days are left.',
    'status.lastAction': 'Last action result',
    'status.noAction': 'No actions yet',

    // Action result lines (status and recaps tabs, also after save & push)
    'action.running': 'Working…',
    'action.raw': 'Raw response',
    'sync.fetched': 'Fetched {fetched} plays, added {inserted} new',
    'sync.patched': 'Discord updated',
    'sync.failed': 'Widget push failed: {error}',
    'sync.notPatched': 'Discord not updated: {reason}',
    'list.sep': '; ',

    // Preview column (desktop) / bottom sheet (mobile), click-to-jump hints
    'preview.title': 'Preview',
    'preview.view': 'Preview mode',
    'preview.card': 'Card',
    'preview.json': 'JSON',
    'preview.hint': 'Click any part of the card to jump to its setting · updates 0.4 s after you stop typing',
    'preview.heroAlt': 'Widget hero image',
    'preview.loading': 'Updating…',
    'preview.jumpSlot': 'Jump to slot {n}',
    'preview.jumpField': 'Edit “{field}”',
    'preview.jumpHero': 'Go to the Hero image tab',
    'preview.jumpRange': 'Go to the stats range',
    'preview.autoDuring': 'The dates come from the stats range, so you were taken there.',
    'preview.autoSong': 'This line shows the last played song automatically and cannot be edited.',
    'preview.autoTitle': 'Generated automatically',
    'preview.toggle': 'Show or hide the preview',

    // Sticky save bar at the bottom
    'save.dirty': '{n} unsaved changes',
    'save.dirtyOne': '1 unsaved change',
    'save.clean': 'All changes saved',
    'save.kbd': 'save & push',
    'save.reset': 'Reset to defaults',
    'save.only': 'Save only',
    'save.push': 'Save & push to Discord',
    'save.pushShort': 'Save & push',
    'save.saving': 'Saving…',
    'save.pushing': 'Saved, pushing to Discord…',
    'save.pushFailed': '✓ Saved, but the push failed: {error}',
    'save.pushed': '✓ Saved and pushed to Discord',
    'save.savedWith': '✓ Saved ({summary})',
    'save.saved': '✓ Saved; the next sync (within 10 minutes) applies it',
    'save.resetDone': 'Defaults filled in (not saved yet)',

    // Errors, by the `code` the server sends (see ERROR_CODES in worker/lib/http.js)
    'err.unauthorized': 'Your session has expired; sign in again',
    'err.forbidden': 'Request refused (origin mismatch)',
    'err.method_not_allowed': 'Method not allowed',
    'err.not_found': 'Path not found',
    'err.expected_json': 'Bad request format (JSON expected)',
    'err.invalid_json': 'Invalid JSON',
    'err.invalid_settings': 'Invalid settings',
    'err.withDetails': '{message}: {details}',
    'err.image_type': 'Only PNG, JPEG, WebP or GIF images are accepted',
    'err.image_too_large': 'The image is too large; the limit is 1.5 MB. Compress or shrink it first.',
    'err.image_empty': 'The image is empty',
    'err.image_mismatch': 'The file content does not match its image type; upload a real PNG, JPEG, WebP or GIF',
    'err.missing_config': 'The server is missing a setting',
    'err.spotify_not_connected': 'Spotify is not connected yet; click Reconnect Spotify',
    'err.spotify_token_failed': 'Spotify refused the authorization; you may need to reconnect',
    'err.spotify_rate_limited': 'Spotify is limiting requests; try again later',
    'err.spotify_api_failed': 'The Spotify API returned an error; try again later',
    'err.discord_dm_failed': 'Sending the Discord DM failed',
    'err.http': 'HTTP {status}',
    'err.network': 'Could not reach the server',

    // Login page
    'login.hint': 'Enter the ADMIN_TOKEN you set when deploying.',
    'login.submit': 'Sign in',
    'login.failed': 'Wrong token'
  }
};

// Keys the login page needs; only these are sent with it.
export const LOGIN_KEYS = ['doc.title', 'lang.label', 'login.hint', 'login.submit', 'login.failed'];

export function isLanguage(value) {
  return LANGUAGES.includes(value);
}

// The first language in Accept-Language decides, like navigator.language does in
// the browser: any zh variant -> zh-TW, anything else -> English.
export function pickLanguage(acceptLanguage) {
  const first = String(acceptLanguage ?? '').split(',')[0].trim().toLowerCase();
  if (first === '') {
    return DEFAULT_LANGUAGE;
  }
  return first.startsWith('zh') ? 'zh-TW' : 'en';
}

export function formatMessage(template, vars) {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}

export function translator(lang) {
  const table = MESSAGES[isLanguage(lang) ? lang : DEFAULT_LANGUAGE];
  return (key, vars) => formatMessage(table[key] ?? MESSAGES['zh-TW'][key] ?? key, vars);
}

export function pickMessages(keys) {
  return Object.fromEntries(
    LANGUAGES.map((lang) => [lang, Object.fromEntries(keys.map((key) => [key, MESSAGES[lang][key]]))])
  );
}

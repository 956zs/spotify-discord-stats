# Spotify Discord Stats

[English](README.md) | 繁體中文

把你的 Spotify 聽歌統計放到 Discord 個人檔案上。一個小小的 Cloudflare Worker 每 10 分鐘
檢查你聽了什麼，更新個人檔案上的 widget：最近播放的歌，加上你自選的六項統計。
它也會每週、每月用 Discord 私訊寄一份聽歌回顧給你。整套免費跑在 Cloudflare 上，
不需要自己的伺服器。

<img src="docs/images/widget.png" alt="顯示四週 Spotify 統計的個人檔案 widget" width="480">
<img src="docs/images/widget-mini.png" alt="同一個 widget 在小卡片上的樣子" width="300">

- **個人檔案 widget**：最近播放的歌，加上六項統計，例如播放次數、聽歌時間、歌手數、
  最常聽的專輯，區間可以是 4 週或任何長度。
- **admin 頁**（`/admin`）：選六項統計、各自的區間和 widget 文字，也能立即同步或寄測試回顧。
  不用重新部署。
- **回顧私訊**：每週一和每月 1 號寄出，內容有最常聽的歌、歌手、專輯和聽歌習慣。
- **匯入歷史**：匯入 Spotify 提供的完整歷史紀錄，統計能往回算好幾年。

> [!WARNING]
> **現在還能做個人檔案 widget 嗎？** Discord 在 2026-07-27 結束了自訂個人檔案 widget
> 的實驗。實驗期間做好的 widget 目前還會更新（這個專案自己的就是），但 Discord 現在只把
> widget 編輯器開放給[認領過遊戲](https://docs.discord.com/developers/social-layer/game-stats-widgets/overview)
> 的 app。你的 app 有沒有這個功能，到[第 6 步](#第-6-步設定個人檔案-widget)就會知道。
> 就算沒有 widget，其他功能都照常能用：統計、admin 頁和回顧私訊。

## 目錄

- [需要準備什麼](#需要準備什麼)
- [一步一步設定](#一步一步設定)
- [改從自己的電腦部署](#改從自己的電腦部署)
- [選擇 widget 要顯示什麼](#選擇-widget-要顯示什麼)
- [設定完之後](#設定完之後)
- [匯入完整的 Spotify 歷史（選用）](#匯入完整的-spotify-歷史選用)
- [常見問題](#常見問題)
- [疑難排解](#疑難排解)
- [更新版本](#更新版本)
- [更多文件](#更多文件)
- [給開發者](#給開發者)

## 需要準備什麼

- **Spotify Premium。** 從 2026 年 2 月起，Spotify 規定要有 Premium 才能使用開發者 app
  （也就是這裡要建立的那種）。
- **Discord 帳號。**
- **免費的 [Cloudflare](https://dash.cloudflare.com/sign-up) 帳號。** 程式就跑在這裡。
- **免費的 [GitHub](https://github.com/signup) 帳號。** 部署按鈕會把這個專案複製一份到你的帳號裡。
  用 GitLab 帳號也可以。
- 大約 15 分鐘。

不需要 Node.js，也不用開終端機，全部在瀏覽器裡完成。（想從自己的電腦部署的話，請看
[改從自己的電腦部署](#改從自己的電腦部署)。）

過程中會拿到幾個值。建議開一個記事本，邊做邊貼進去：

| 值 | 在哪一步拿到 |
| --- | --- |
| Discord bot token（不能外流） | 第 1 步 |
| Spotify Client ID | 第 4 步 |
| Spotify Client Secret（不能外流） | 第 4 步 |

## 一步一步設定

簡單說：建一個 Discord bot，按下面這個按鈕，再到你的 admin 頁把剩下的設定完。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/956zs/spotify-discord-stats)

### 第 1 步：建立 Discord app 和 bot

個人檔案 widget 屬於這個 app，回顧私訊則由它的 bot 寄給你。請用你自己的 Discord 帳號建立：
Worker 會把私訊寄給 app 的擁有者，也是更新他的 widget。

1. 打開 [Discord Developer Portal](https://discord.com/developers/applications)，
   按 **New Application**。名字會顯示在 widget 上，例如 `My Spotify Stats`。

   <img src="docs/images/portal-new-app.png" alt="建立新 app 的視窗" width="380">

2. 打開 **Bot** 頁面，按 **Reset Token**，複製 token。這個 token 只會顯示一次，
   請當成密碼保管。

   <img src="docs/images/portal-bot-token.png" alt="Bot 頁的 Reset Token 按鈕" width="520">
Application ID 和你的使用者 ID 都不用抄，Worker 會從 bot token 讀出來。也不用把 bot 加進伺服器：
第 3 步會把 app 加到你自己的帳號，bot 就能私訊你。

### 第 2 步：按 Deploy to Cloudflare

1. 按上面的 **Deploy to Cloudflare** 按鈕。
2. 登入 Cloudflare，被問到時連結你的 GitHub 帳號。Cloudflare 會在你的 GitHub 帳號裡
   複製一份這個專案，也會幫你建立資料庫。名稱用它建議的就好。
3. Cloudflare 只會要你填一個值 `DISCORD_TOKEN`：貼上第 1 步的 bot token。
4. 開始部署，等它跑完。資料庫會自動設定好。
5. Cloudflare 會顯示你的 **Worker 網址**，長得像
   `https://spotify-discord-stats.your-name.workers.dev`，把它複製起來。之後也可以在
   Cloudflare 後台的 **Workers & Pages** 找到。新的 `workers.dev` 網址可能要等幾分鐘才會生效。

### 第 3 步：打開 admin 頁

不用密碼：bot 會私訊你一個登入連結。

1. 打開你的 Worker 網址加上 `/admin`，例如
   `https://spotify-discord-stats.your-name.workers.dev/admin`。頁面會跟著瀏覽器的語言顯示，
   右上角的 **中文 / EN** 可以切換。
2. 按 **加到我的應用程式**，把這個 app 加到你的 Discord 帳號，bot 才能私訊你。這只要做一次。
3. 按 **寄登入連結給我**。bot 會私訊你一個連結，打開後按 **登入**。同一個瀏覽器會保持登入 30 天。

   <img src="docs/images/admin-login-zh.png" alt="登入頁，有「加到我的應用程式」和「寄登入連結給我」" width="380">

連結 10 分鐘內有效、只能用一次，而且只有最新的那個有效。每分鐘最多可以再要一次。

> [!NOTE]
> 如果沒收到私訊，確認你已經加過 app（**加到我的應用程式**），而且允許它私訊你。
> 如果 Discord 說這個 app 不能加到你的帳號，到 Developer Portal 打開 app → **Installation**，
> 勾選 **User Install**（新的 app 預設就有勾）。也可以改成把 bot 加進一個你也在的伺服器：
> **OAuth2** → **URL Generator**，勾選 `bot`，打開產生的連結，選那個伺服器。

因為 Spotify app 還沒設定，頁面會直接打開 **狀態** 分頁，這就是下一步。狀態列表裡的
**Discord app** 那一行會顯示你的 app ID，以及私訊和 widget 給誰；那個人應該是你。

### 第 4 步：建立 Spotify app

**狀態** 分頁最上面的 **Spotify app** 區塊會顯示你的 **Redirect URI**，旁邊有 **複製** 按鈕。
它就是你的 Worker 網址加上 `/spotify/callback`。

1. 打開 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)，
   登入後按 **Create app**。
2. 填寫：
   - **App name** 和 **App description**：隨便填，例如 `My Spotify Stats`。
   - **Redirect URIs**：貼上 admin 頁上的 Redirect URI，然後按 **Add**。
   - 問你打算用哪些 API 時，勾選 **Web API**。

   <img src="docs/images/spotify-create.png" alt="填好的 Spotify Create app 表單" width="640">
3. 同意條款，按 **Save**。
4. 打開這個 app 的 **Settings**，複製 **Client ID**，再按 **View client secret**
   複製 **Client Secret**。

   <img src="docs/images/spotify-settings.png" alt="Spotify app 設定頁的 Client ID 和 View client secret" width="640">
5. 回到 admin 頁，把兩個值貼進 **Spotify app** 區塊，按 **儲存並檢查**。
   它會先向 Spotify 確認這組值是對的才儲存，打錯字馬上就會知道。

> [!NOTE]
> 統計的是第 5 步連結時登入的那個 Spotify 帳號，不是建立這個 app 的帳號。兩個可以是同一個；
> 如果不同，要先到 **Settings** → **User Management** 把你要登入的那個帳號加進去。

### 第 5 步：連結你的 Spotify 帳號

在 **狀態** 分頁按 **Spotify 重新授權**。（Spotify app 存好之前，這個按鈕是灰的。）
Spotify 會詢問是否允許讀取你最近播放的歌曲，按 **Agree**。
看到 **Spotify authorization complete** 就完成了。

### 第 6 步：設定個人檔案 widget

自訂 widget 來自 Discord 的實驗功能，所以有一部分設定要用變通的方法。chloecinders 的教學
[How to Make Discord Widgets](https://chloecinders.com/blog/discord-widgets)（英文）講得很完整，照著它做，再搭配這個專案的兩個捷徑：

1. 在 [Discord Developer Portal](https://discord.com/developers/applications)
   打開你的 app，在左邊選單的 **Games** 底下點 **Widget**。

   > 如果沒有 **Widget** 這個選項，代表 Discord 沒有開放 widget 編輯器給你的 app
   > （見最上面的警告）。直接跳到第 7 步，除了 widget 以外都能用。

2. **捷徑 1**：不用自己一格一格建，打開
   [docs/discord-widget-config.json](docs/discord-widget-config.json)，
   把內容全部複製起來（在 GitHub 上可以按 **Copy raw file** 按鈕）。在 widget 編輯器右上角按
   **⋮**，選 **Paste config from clipboard**。所有欄位會一次設定好，名稱也都對。

   <img src="docs/images/widget-menu.png" alt="widget 編輯器選單裡的 Paste config from clipboard" width="360">

3. widget 上有三張圖。到 **Games** → **Assets** 上傳你自己的圖片，分別命名為
   `widget_hero`（widget 上的大圖）、`widget_preview` 和 `widget_mini`，
   或是在編輯器裡改選別的圖。
4. 按 **Save changes**，再按 **Publish**。沒有發佈的 widget 別人看不到。
5. 照教學的 [Adding the Widget to your Profile](https://chloecinders.com/blog/discord-widgets#displaying-the-widget-on-your-profile) 段落，
   套用 application identity，並把 widget 加到你的個人檔案。
   **捷徑 2**：教學裡的範例資料不用自己維護，Worker 每 10 分鐘會送你真正的統計上去。

> [!CAUTION]
> 不要把 bot token 貼到任何網站上。教學裡的 Widget Identity Creator 是在你自己電腦上執行的小程式，
> token 不會離開你的裝置。

<img src="docs/images/widget-editor.png" alt="貼上 config 後的 widget 編輯器" width="720">

欄位名稱和細節：[docs/discord-widget.md](docs/discord-widget.md)（英文）。

### 第 7 步：確認有在運作

1. 在 admin 頁的 **狀態** 分頁按 **立即同步**。**上次操作結果** 底下會顯示
   **抓到 N 筆、新增 N 筆**，以及 widget 有沒有更新。重新整理頁面就能看到最新的預覽。

   <img src="docs/images/admin-sync-zh.png" alt="admin 頁的同步結果" width="440">
2. 你的個人檔案 widget 現在會顯示統計。如果沒變，重新整理 Discord（`Ctrl+R`，
   macOS 是 `Cmd+R`）。
3. 在 **週報月報** 分頁按 **發送週報**，按確定。幾秒內你應該會收到 bot 寄來的週報私訊。

大功告成。之後全部在 Cloudflare 上自動執行。

## 改從自己的電腦部署

也可以不用 GitHub 和部署按鈕，改從終端機部署。先做完第 1 步，然後：

1. 安裝 [Node.js](https://nodejs.org/) 24 以上。裝好之後開一個新的終端機，執行 `node -v`，
   確認印出來的是 `v24` 或更新的版本。
2. 下載專案：在這個頁面按綠色的 **Code** 按鈕，選 **Download ZIP**，再解壓縮。會用 git 的話也可以：

   ```bash
   git clone https://github.com/956zs/spotify-discord-stats.git
   ```

3. 在專案資料夾裡開終端機：
   - **Windows**：用檔案總管打開資料夾，點一下網址列，輸入 `cmd` 按 Enter。請用這個命令提示字元，
     不要用 PowerShell，它常常會擋下 `npm`，出現「已停用指令碼執行」的錯誤。
   - **macOS**：在 Finder 對資料夾按右鍵，選 **服務** → **新增位於檔案夾位置的終端機視窗**。
   - **Linux**：開終端機，`cd` 到資料夾裡。
4. 安裝需要的套件，並登入 Cloudflare。瀏覽器會跳出視窗，按 **Allow**。

   ```bash
   npm install
   npx wrangler login
   ```

5. 把專案部署上線。這會建立 Worker 和它的資料庫。第一次執行時會問你幾個問題，
   例如第一個 Worker 要用的 `workers.dev` 子網域，取一個還沒被用過的名字就好。
   如果它要你確認，輸入 `y` 按 Enter。

   ```bash
   npm run deploy
   ```

   部署完會印出你的 **Worker 網址**，把它複製起來。新的網址可能要等幾分鐘才會生效。
6. 把 bot token 存進 Cloudflare。執行這個指令，貼上 token 再按 Enter。
   貼上時畫面上不會出現任何字，這是正常的。

   ```bash
   npx wrangler secret put DISCORD_TOKEN
   ```

7. 接著做[第 3 步](#第-3-步打開-admin-頁)。

第一次部署會印出 `Creating new D1 Database`，接著建立資料表。之後的部署會用名稱找到同一個資料庫。

## 選擇 widget 要顯示什麼

admin 頁的 **Widget** 分頁可以設定統計區間（7、28、90、365 天、自訂天數或全部時間）、widget 文字，
以及六個統計格各自顯示什麼，右邊有即時預覽。改完會在下次同步時套用，或按頁面最下面的
**儲存並推送到 Discord** 立刻更新。

![admin 頁（假資料）](docs/images/admin-zh.png)

每個統計格可以選統計項目和自己的區間，預覽會跟著即時更新。下圖把第 3 格改成全部歷史裡最常聽的歌手：

<img src="docs/images/admin-slots-zh.png" alt="統計格編輯器" width="700">
<img src="docs/images/admin-preview-zh.png" alt="widget 即時預覽" width="330">

widget 最上面的大圖可以在 **大圖** 分頁選：固定素材（`widget_hero`，預設）、
在 admin 頁上傳的圖片，或最近播放那首歌的專輯封面。如果你的 widget 是在這個選項出現之前做的，
要到 widget 編輯器把大圖改成 User Data `hero_image`，Fallback 選 `widget_hero`，
或重新貼一次 [設定檔](docs/discord-widget-config.json)。Discord 可能會快取舊圖一陣子。
按 **選擇圖片並裁切** 會開一個裁切工具，把圖裁成剛好 1300×1200，並用參考線標出哪裡會淡出、哪裡會被文字蓋到。

所有設定和統計項目都列在 [docs/admin-page.md](docs/admin-page.md)（英文）。

## 設定完之後

- Worker 每 10 分鐘向 Spotify 讀取你最近播放的 50 首歌，把新的存起來，數字有變就更新
  widget。Spotify 只保留很短的最近紀錄，所以開始使用之前的歌要靠
  [匯入歷史](#匯入完整的-spotify-歷史選用)補上。
- **週報**：每週一 09:00，涵蓋過去 7 天。
- **月報**：每月 1 號 09:00，涵蓋上一個月。
- 寄送時間以台灣時間（UTC+8）計算，目前還不能改時區。
- Spotify 的連結預設大約維持 180 天。到期前 30 天起，bot 每天會私訊提醒你一次，
  附上重新連結的連結。如果同步在那之前就開始失敗，到 admin 頁的 **狀態** 分頁按 **Spotify 重新授權**。

每份回顧由幾張私訊卡片組成：總計和跟上一期的比較、排行榜、專輯封面和聽歌習慣，以及這段期間的新歌和新歌手。

<img src="docs/images/recap-monthly.png" alt="月報的總覽卡片" width="480">
<img src="docs/images/recap.png" alt="週報的排行榜" width="400">
<img src="docs/images/recap-patterns.jpg" alt="回顧裡的專輯封面和聽歌習慣" width="400">

不想收回顧的話，在 admin 頁的 **週報月報** 分頁關掉 **自動發送週報 / 月報 DM**，再按 **只儲存**。

## 匯入完整的 Spotify 歷史（選用）

Spotify 可以把你所有的播放紀錄寄給你。匯入要用一台裝了 Node.js 的電腦：先做
[改從自己的電腦部署](#改從自己的電腦部署)的第 1 到 4 步（如果你用的是部署按鈕，
請從你自己的 GitHub 帳號下載你那一份專案，不是這一份），但不用執行 `npm run deploy`。

1. 到 [Spotify 隱私設定](https://www.spotify.com/account/privacy/) 申請
   **Extended streaming history**（延伸串流紀錄）。Spotify 會用 email 寄給你，
   通常幾天內，最久 30 天。
2. 解壓縮下載的檔案。
3. 先備份資料庫，試跑一次確認沒問題（不會寫入任何東西），再正式匯入。
   資料夾路徑要加上引號；可以直接把資料夾拖進終端機視窗，路徑就會自動貼上。

   ```bash
   npm run cf:d1:backup:remote
   npm run cf:import -- --remote --dry-run "/路徑/Spotify Extended Streaming History"
   npm run cf:import -- --remote "/路徑/Spotify Extended Streaming History"
   ```

4. 回到 admin 頁的 **狀態** 分頁按 **立即同步**，更新統計數字。

匯入會略過你第一首同步歌曲之後的所有紀錄，所以 Worker 已經存過的歌不會重複計算；
同一份資料再匯入一次也不會多加。比較短的「Account data」匯出檔也能用，只是細節比較少。
要撤銷一次匯入，請看 [docs/backup-rollback-and-import.md](docs/backup-rollback-and-import.md)（英文）。

## 常見問題

<details>
<summary><b>在 Spotify Developer Dashboard 找不到 Create app</b></summary>

- **不是 Premium。** 從 2026 年 2 月起，免費的 Spotify 帳號不能建立開發者 app。
  這時頁面只會寫「You haven't created any apps yet」，完全沒有按鈕。
- **你是 Premium Duo 或家庭方案的成員。** 有使用者回報，這裡只有付款的方案管理者帳號算 Premium，
  成員帳號會看到一樣空白的頁面。請方案管理者來建立 app（見下面的變通方法）。
- **email 還沒驗證。** 頁面上會寫「You need to verify your email address before you can create an app」。
  請先驗證 Spotify 帳號的 email。如果你是用 Google、Facebook 或 Apple 登入，可能收不到驗證信，
  要先到[登入方式](https://www.spotify.com/account/login-methods/)加一個「email 和密碼」的登入方式。
- **已經有 app 了。** Spotify 會限制每個人能建立的 app 數量。可以直接拿已經有的 app 來用，
  把這個專案的 Redirect URI 加進去就好。
- 有些 Premium 帳號還是看不到這個按鈕，這是 Spotify 那邊的問題，可以到
  [Spotify for Developers 論壇](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)詢問。

**沒有 Premium 的變通方法**：Spotify 只要求 app 的擁有者有 Premium。有 Premium 的人（朋友，或你的方案管理者）
可以在他的 app 的 **User Management** 加入你的 Spotify email（每個 app 最多 5 人），在 Redirect URIs 加上你的
Redirect URI（admin 頁上顯示的那個），再把 app 的 Client ID 和 Client Secret 給你。第 5 步連結 Spotify 時，
用你自己的帳號登入（先登出對方的帳號）：Worker 記錄的是你連結的那個帳號，不是 app 擁有者的。
只跟信得過的人這樣做：拿到 Client Secret 的人就能以那個 app 的身分操作，而且擁有者的 Premium 一斷，app 就會停。
</details>

<details>
<summary><b>要花錢嗎？</b></summary>

不用。它在 Cloudflare 的免費方案內就能跑（Workers、Cron Triggers 和 D1）。
唯一的條件是 Spotify Premium，因為 Spotify 規定開發者 app 要有 Premium。
</details>

<details>
<summary><b>需要自己的網域嗎？</b></summary>

不用，免費的 `workers.dev` 網址就能用。想用自己的網域的話，先把網域加到 Cloudflare，
把 `wrangler.toml` 裡的 `routes` 取消註解（用部署按鈕的話，改你 GitHub 上那一份），再部署一次。
之後用新網址打開 admin 頁，把它顯示的 Redirect URI 加到你的 Spotify app。
</details>

<details>
<summary><b>現在還能做新的個人檔案 widget 嗎？</b></summary>

大概不行：Discord 在 2026-07-27 結束了自訂 widget 的實驗，新的 app 拿不到 widget 編輯器，
見最上面的警告。沒有 widget 的話，回顧私訊、統計和 admin 頁都照常能用。
</details>

<details>
<summary><b>朋友可以共用我架好的這套嗎？</b></summary>

不行。一套只會追蹤一個 Spotify 帳號，也只會更新一個 Discord 使用者的個人檔案。
朋友要用的話，得各自架一套，用自己的 Discord app、Spotify app 和 Cloudflare 帳號。
</details>

<details>
<summary><b>widget 會即時顯示我正在聽的歌嗎？</b></summary>

不會。它顯示的是你最近聽完的那首歌，每 10 分鐘檢查一次。Discord 的 widget 本來就不是拿來顯示即時資料的。
</details>

<details>
<summary><b>為什麼聽歌時間跟 Spotify Wrapped 對不上？</b></summary>

Spotify 的最近播放清單只給每首歌的長度，不是你實際聽了多久，所以同步來的聽歌時間是以整首歌計算的。
匯入的歷史紀錄才有精確的播放時間。
</details>

<details>
<summary><b>可以改週報、月報的寄送時間嗎？</b></summary>

可以。修改 [config/app.json](config/app.json) 裡的 `recapReports`，再部署一次：
`weeklyDay`（0 是星期日，1 是星期一，以此類推）、`monthlyDay`、`sendHour` 和 `sendMinute`（要是 10 的倍數）。
時間以台灣時間（UTC+8）計算，時區本身目前還不能改。用部署按鈕的話，改你 GitHub 上那一份，
存檔後就會重新部署。
</details>

<details>
<summary><b>我的資料誰看得到？</b></summary>

聽歌紀錄、你的 Spotify 連結，以及 Spotify app 的 Client Secret 都存在你自己的 Cloudflare 資料庫裡。
只有你能登入 admin 頁：登入連結只會私訊給你。Spotify 只允許 Worker 讀取你最近播放的歌曲。
widget 上顯示的內容，任何打開你 Discord 個人檔案的人都看得到。
</details>

<details>
<summary><b>要怎麼整個移除？</b></summary>

1. 在 [Cloudflare 後台](https://dash.cloudflare.com/) 刪掉 Worker（在 **Workers & Pages** 裡）
   和它的 D1 資料庫。也可以在專案資料夾的終端機執行 `npx wrangler delete` 刪掉 Worker。
2. 如果用的是部署按鈕，把你 GitHub 上那一份專案刪掉。
3. 到 [spotify.com/account/apps](https://www.spotify.com/account/apps/) 移除這個 app 的存取權，
   再到 Spotify Developer Dashboard 刪掉 app。
4. 把 widget 從 Discord 個人檔案移除，再到 Discord Developer Portal 刪掉 app。
</details>

## 疑難排解

要改 `DISCORD_TOKEN` 這類機密值，到 Cloudflare 後台打開你的 Worker →
**Settings** → **Variables and Secrets**，或在專案資料夾執行 `npx wrangler secret put 名稱`。

<details>
<summary><b>Spotify 顯示 <code>INVALID_CLIENT: Invalid redirect URI</code></b></summary>

Spotify 後台的 Redirect URI 必須和 admin 頁上顯示的完全一樣，包含 `https://`，結尾也不能多一個斜線。
要再看一次，在 **狀態** 分頁的 **Spotify app** 區塊按 **更換**（看完按 **取消**）。
Redirect URI 跟著你打開 admin 頁用的網址走；如果你會用不只一個網址（例如 `workers.dev` 和自己的網域），
每個網址的 Redirect URI 都要加到 Spotify app。
</details>

<details>
<summary><b>儲存並檢查時說 Client ID 或 Client Secret 不對</b></summary>

到 Spotify app 的 **Settings** 重新複製兩個值。兩個都是 32 個英數字。
</details>

<details>
<summary><b>同步失敗，出現 <code>Active premium subscription required</code> 或 Spotify 的 403 錯誤</b></summary>

建立 Spotify app 的那個帳號必須有有效的 Premium 訂閱。如果你連結的是另一個 Spotify 帳號，
要先在 Spotify app 設定的 **User Management** 把它加進去。
</details>

<details>
<summary><b>widget 沒有更新，或 admin 頁警告 widget 推送失敗</b></summary>

- 確認 widget 已經加到你的個人檔案（第 6 步），而且跟 bot token 屬於同一個 Discord app。
  **狀態** 分頁的 **Discord app** 那一行會顯示這個 app 的 ID。
- 同步後 admin 頁的 **狀態** 分頁會在 **上次操作結果** 用黃字顯示失敗原因；聽歌紀錄照樣會存，回顧也照常寄出。

  <img src="docs/images/admin-sync-warn-zh.png" alt="widget 推送失敗的警告" width="440">

- 如果你的 app 沒有 widget 編輯器，目前就無法使用 widget（見最上面的警告）。
  不想讓 Worker 一直嘗試的話，把 `config/app.json` 裡的 `"patchDiscordOnSync"` 改成 `false`，
  再部署一次。
- 更多說明在 [docs/discord-widget.md](docs/discord-widget.md)（英文）。
</details>

<details>
<summary><b>收不到週報／月報私訊</b></summary>

- 確認你已經把 app 加到自己的帳號（登入頁或 **狀態** 分頁 **Discord app** 那一行的
  **加到我的應用程式**），或是 bot 在一個你也在的伺服器裡，而且那個伺服器允許成員傳私訊
  （對伺服器按右鍵 → **隱私設定**）。
- 看 **狀態** 分頁的 **Discord app** 那一行，它會顯示私訊寄給誰，也就是 Discord app 的擁有者
  （app 屬於團隊的話是團隊擁有者）。要改寄給別人，設定 `DISCORD_USER_ID`（私訊和 widget）
  或 `DISCORD_REMINDER_USER_ID`（只有私訊），見
  [docs/cloudflare-worker.md](docs/cloudflare-worker.md#optional-settings)（英文）。
- 如果那一行寫 **從 bot token 讀不到 app**，代表 bot token 不對或被重設了。在 Developer Portal
  重設 token 後舊的就失效了，要把新的存成 `DISCORD_TOKEN`。
</details>

<details>
<summary><b>收不到登入連結，或連結說已經失效</b></summary>

- **bot 沒辦法私訊你**：在登入頁按 **加到我的應用程式** 把 app 加進來，允許它私訊你，再試一次。
  其他做法見[第 3 步](#第-3-步打開-admin-頁)的說明。
- **這個連結已經失效**：連結用過了、超過 10 分鐘，或被新的連結取代。再寄一次就好。
- **從 DISCORD_TOKEN 讀不到 Discord app**：bot token 不對或被重設了，把現在的 token 存成 `DISCORD_TOKEN`。
</details>

## 更新版本

更新時，你的機密值、設定和資料都會保留。每次部署也會先套用新的資料庫變更。

**用部署按鈕的話**：你的專案在你自己 GitHub 上的那一份，它一有變動，Cloudflare 就會重新部署
（Workers Builds）。在那裡把新版本拉進來：

- 如果你那一份是這個專案的 fork，在 GitHub 上打開它，按 **Sync fork**。
- 如果是一般的複本（沒有 **Sync fork** 按鈕），用 git 把這個專案的變更拉下來，再推到你那一份：

  ```bash
  git pull https://github.com/956zs/spotify-discord-stats.git main
  git push
  ```

推到你那一份之後就會開始新的建置和部署，可以在 Cloudflare 後台你的 Worker 頁面上看進度。

**從自己電腦部署的話**：下載新版（或 `git pull`），然後執行：

```bash
npm install
npm run deploy
```

如果你有自己的 `wrangler.local.toml`，而且是下載 ZIP 更新，記得把它從舊資料夾複製到新資料夾。

### 從舊版設定升級

如果你是在有部署按鈕之前就設定好的，什麼都不用改：你在 Cloudflare 設定的值（`wrangler.toml`
裡的 `[vars]` 和你的機密值）照樣有效，而且永遠優先於 Worker 自己找到的值。這時 **Spotify app**
區塊會寫這個 app 設定在 Cloudflare。

現在專案本身就附了 `wrangler.toml`，所以你自己那份沒有被 git 追蹤的檔案會擋住 `git pull`。
請先把它改名成 `wrangler.local.toml`；所有 npm 指令在有 `wrangler.local.toml` 時都會用它。接著：

```bash
git pull
npm install
npm run deploy
```

下載 ZIP 的話：把舊的 `wrangler.toml` 複製到新資料夾，改名成 `wrangler.local.toml`。

你的 `ADMIN_TOKEN` 也照樣能用：登入頁還是有密碼欄位（在 **或用 ADMIN_TOKEN 登入** 下面），
提醒私訊裡的連結也還是會直接打開 Spotify 重新授權。你也可以改用新的登入連結。

## 更多文件

以下文件目前只有英文：

- [Admin 頁](docs/admin-page.md)：所有設定、統計項目和管理路由。
- [Discord 個人檔案 widget](docs/discord-widget.md)：欄位名稱，以及 widget 怎麼被更新。
- [Cloudflare Worker 部署](docs/cloudflare-worker.md)：上面設定步驟的參考版，以及所有可以覆寫的設定。
- [備份、還原與歷史匯入](docs/backup-rollback-and-import.md)
- [在自己的伺服器上跑](docs/vps-deployment.md)：用 Node.js + SQLite 取代 Cloudflare 的做法，
  不會自動寄週報、月報。
- [Recap 名詞解釋](docs/recap-glossary.md) 和 [ADR 0001](docs/adr/0001-discord-recap-reports.md)：
  週報、月報的設計紀錄。

## 給開發者

專案結構：

- `worker/`：Cloudflare Worker（路由、D1 存取、Spotify、Discord、統計、回顧寄送）。
- `shared/`：不綁執行環境的共用程式（時間、key、播放紀錄解析、統計項目、回顧排版）。
- `src/`：Node.js + SQLite 版本，給本機開發和自架伺服器用。
- `scripts/`：部署、Wrangler 包裝、D1 備份和歷史匯入工具。
- `migrations/`：D1 資料表 migration。
- `config/`：預設的 app 和 widget 設定。
- `test/`：Node 測試。

執行測試和語法檢查：

```bash
npm test
find src worker shared scripts test -name '*.js' -print0 | xargs -0 -n 1 node --check
```

專案附的 [wrangler.toml](wrangler.toml) 裡沒有任何 ID，部署按鈕可以直接用。個人設定（account ID、
自己的網域、資料庫 ID、`[vars]`）請放在 `wrangler.local.toml`（已加入 gitignore），可以從
`wrangler.toml` 複製一份開始。所有會跑 Wrangler 的 npm 指令（`npm run deploy`、`cf:dev`、
`cf:d1:migrate:*`、`cf:d1:backup:*`、`cf:import`）在它存在時都會用它；其他 Wrangler 指令可以用
`npm run cf -- <wrangler 參數>` 以同樣方式執行。D1 指令用 binding 名稱 `DB` 指定資料庫。
`npm run deploy` 會先套用 migration 再部署；資料庫還不存在時，會先部署讓 Wrangler 建立資料庫，再套用 migration。

要在本機跑 Worker：把 [.dev.vars.example](.dev.vars.example) 複製成 `.dev.vars`，填入
`DISCORD_TOKEN`。私訊登入連結指向本機網址也能用；想用密碼登入的話，再加上 `ADMIN_TOKEN`。Spotify app 可以在 admin 頁輸入，或把 `SPOTIFY_CLIENT_ID`
和 `SPOTIFY_CLIENT_SECRET` 寫進 `.dev.vars`。接著把 migration 套到本機資料庫，再啟動：

```bash
npm run cf:d1:migrate:local
npm run cf:dev
```

Node/SQLite 的指令（`npm run spotify:auth-url`、`spotify:token`、`spotify:sync`、`npm start`）
會讀 `.env`，可以從 [node.env.example](node.env.example) 複製成 `.env` 開始。這個版本不會自己找任何值，
Discord 和 Spotify 的值都要填在裡面。

已知限制：

- 週報、月報的排程固定用 `Asia/Taipei`。
- Spotify 的 Recently Played API 只給歌曲長度，不是實際聽了多久，所以同步來的聽歌時間是估計值。
  匯入的歷史紀錄才有精確的播放時間。
- Spotify 的歷史匯出檔不含專輯封面。

## 授權

[MIT](LICENSE)

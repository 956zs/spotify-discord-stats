# Spotify Discord Stats

[English](README.md) | 繁體中文

把自己的 Spotify 聽歌紀錄存下來，每週、每月在 Discord 私訊收到一份聽歌回顧。
整套免費跑在 Cloudflare 上，不需要自己的伺服器。

- 每 10 分鐘檢查一次，把你在 Spotify 上播過的每首歌存起來。
- 每週一寄週報、每月 1 號寄月報，用 Discord 私訊告訴你最常聽的歌、歌手、專輯、
  聽歌時間和聽歌習慣。
- 附一個小網頁（`/admin`），可以挑要顯示哪些統計，也能寄測試用的回顧。
- 可以匯入 Spotify 提供的完整歷史紀錄，統計能往回算好幾年。
- 如果你的 Discord 應用程式還有個人檔案 widget，也能把統計顯示在上面（見下方說明）。

![admin 頁（假資料）](docs/images/admin.png)

> [!IMPORTANT]
> **關於 Discord 個人檔案 widget。** Discord 在 2026-07-27 結束了自訂個人檔案
> widget 的實驗，現在已經不能建立新的 widget。如果你之前就有，目前還能繼續用，
> 請看 [docs/discord-widget.md](docs/discord-widget.md)（英文）。這個專案的其他
> 功能都不需要 widget。

## 目錄

- [需要準備什麼](#需要準備什麼)
- [一步一步設定](#一步一步設定)
- [設定完之後](#設定完之後)
- [匯入完整的 Spotify 歷史（選用）](#匯入完整的-spotify-歷史選用)
- [常見問題](#常見問題)
- [更新版本](#更新版本)
- [更多文件](#更多文件)
- [給開發者](#給開發者)

## 需要準備什麼

- **Spotify Premium。** 從 2026 年 2 月起，Spotify 規定要有 Premium 才能使用開發者 app（也就是這裡要建立的那種）。
- **Discord 帳號**，加上一個你能把 bot 加進去的伺服器。自己開一個空的伺服器就行，免費。
- **免費的 [Cloudflare](https://dash.cloudflare.com/sign-up) 帳號。** 程式就跑在這裡。
- **電腦上裝好 [Node.js](https://nodejs.org/) 24 以上**，只有設定時會用到。
- 大約 30 分鐘，以及一個能貼指令的終端機（命令提示字元、PowerShell 或 Terminal）。

過程中會拿到幾個值。建議開一個記事本，邊做邊貼進去：

| 值 | 在哪一步拿到 |
| --- | --- |
| Discord Application ID | 第 2 步 |
| Discord bot token（不能外流） | 第 2 步 |
| 你的 Discord 使用者 ID | 第 2 步 |
| 資料庫 ID | 第 3 步 |
| 你的 Worker 網址 | 第 3 步 |
| Spotify Client ID | 第 4 步 |
| Spotify Client Secret（不能外流） | 第 4 步 |
| 管理密碼（不能外流，自己想一個） | 第 5 步 |

## 一步一步設定

### 第 1 步：下載專案

在這個頁面按綠色的 **Code** 按鈕，選 **Download ZIP**，再解壓縮。會用 git 的話也可以：

```bash
git clone https://github.com/956zs/spotify-discord-stats.git
```

在專案資料夾裡開終端機，安裝需要的套件：

```bash
npm install
```

### 第 2 步：建立 Discord bot

週報、月報的私訊就是由這個 bot 寄給你。

1. 打開 [Discord Developer Portal](https://discord.com/developers/applications)，
   按 **New Application**，名字隨便取，例如 `My Spotify Stats`。
2. 在 **General Information** 頁面複製 **Application ID**。
3. 打開 **Bot** 頁面，按 **Reset Token**，複製 token。這個 token 只會顯示一次，
   請當成密碼保管。
4. 把 bot 加進你的伺服器：打開 **OAuth2** → **URL Generator**，勾選 `bot`。
   打開最下面產生的連結，選你的伺服器，按確認。
5. 取得你自己的使用者 ID：在 Discord 打開 **使用者設定**（齒輪圖示）→ **進階**，
   開啟 **開發者模式**。接著在任何地方對自己的名字按右鍵，選 **複製使用者 ID**。

> [!NOTE]
> bot 要跟你在同一個伺服器裡，而且那個伺服器允許成員傳私訊給你（對伺服器按右鍵 →
> **隱私設定**），bot 才能私訊你。

### 第 3 步：設定 Cloudflare

1. 從終端機登入 Cloudflare。瀏覽器會跳出視窗，按 **Allow**。

   ```bash
   npx wrangler login
   ```

2. 複製範例檔，做出你自己的設定檔。Windows 請把 `cp` 換成 `copy`，
   或直接在檔案總管裡複製再改名。

   ```bash
   cp wrangler.example.toml wrangler.toml
   ```

3. 建立資料庫：

   ```bash
   npm run cf:d1:create
   ```

   它會印出一個 `database_id`（一長串像 `1a2b3c4d-...` 的 ID），把它複製起來。
   如果 Wrangler 問你要不要幫你把資料庫加進設定檔，回答 **No**。
4. 用文字編輯器打開 `wrangler.toml`，把 ID 貼到
   `database_id = "paste-database-id-here"` 的位置，存檔。
5. 建立資料表，然後第一次把專案部署上線：

   ```bash
   npm run cf:d1:migrate:remote
   npm run cf:deploy
   ```

   如果這是你的第一個 Worker，Wrangler 會請你取一個 `workers.dev` 子網域，
   隨便取一個沒被用過的名字就好。
6. 部署完會印出你的 **Worker 網址**，長得像
   `https://spotify-discord-stats.your-name.workers.dev`，把它複製起來。

### 第 4 步：建立 Spotify app

1. 打開 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)，
   登入後按 **Create app**。
2. 填寫：
   - **App name** 和 **App description**：隨便填，例如 `My Spotify Stats`。
   - **Redirect URIs**：你的 Worker 網址後面加上 `/spotify/callback`，例如
     `https://spotify-discord-stats.your-name.workers.dev/spotify/callback`，
     然後按 **Add**。
   - 問你打算用哪些 API 時，勾選 **Web API**。
3. 同意條款，按 **Save**。
4. 打開這個 app 的 **Settings**，複製 **Client ID**，再按 **View client secret**
   複製 **Client Secret**。

> [!NOTE]
> 第 6 步連結 Spotify 時，請登入建立這個 app 的同一個 Spotify 帳號。要用別的帳號的話，
> 先到 **Settings** → **Users Management** 把它加進去。

### 第 5 步：填入設定

1. 再打開 `wrangler.toml`，把你的值填進 `[vars]` 區塊，引號要保留：

   ```toml
   [vars]
   DISCORD_CLIENT_ID = "你的 Discord Application ID"
   DISCORD_USER_ID = "你的 Discord 使用者 ID"
   SPOTIFY_CLIENT_ID = "你的 Spotify Client ID"
   SPOTIFY_REDIRECT_URI = "你的 Worker 網址/spotify/callback"
   PUBLIC_BASE_URL = "你的 Worker 網址"
   ```

2. 自己想一組管理密碼：至少 32 個字元的隨機字串（可以用密碼管理器產生）。
   之後開 admin 頁要用它登入。
3. 把三個機密值存進 Cloudflare。每個指令執行後，它會要你貼上對應的值：

   ```bash
   npx wrangler secret put DISCORD_TOKEN
   npx wrangler secret put SPOTIFY_CLIENT_SECRET
   npx wrangler secret put ADMIN_TOKEN
   ```

   存進去之後 Cloudflare 不會再顯示這些值，管理密碼請自己保存好。
4. 再部署一次，讓新設定生效：

   ```bash
   npm run cf:deploy
   ```

### 第 6 步：連結你的 Spotify 帳號

在瀏覽器打開下面這個網址，換成你自己的 Worker 網址和管理密碼：

```text
https://你的Worker網址/spotify/login?token=你的管理密碼
```

Spotify 會詢問是否允許讀取你最近播放的歌曲，按 **Agree**。看到
**Spotify authorization complete** 就完成了。

### 第 7 步：確認有在運作

1. 打開 `https://你的Worker網址/admin`，用管理密碼登入。
2. 按 **立即同步**，預覽區會出現你最近聽的歌。
3. 按 **發送週報**，幾秒內你應該會在 Discord 收到 bot 寄來的週報私訊。

大功告成。終端機可以關掉了，之後全部在 Cloudflare 上自動執行。

## 設定完之後

- Worker 每 10 分鐘向 Spotify 讀取你最近播放的 50 首歌，把新的存起來。Spotify
  只保留很短的最近紀錄，所以開始使用之前的歌要靠
  [匯入歷史](#匯入完整的-spotify-歷史選用)補上。
- **週報：**每週一 09:00，涵蓋過去 7 天。
- **月報：**每月 1 號 09:00，涵蓋上一個月。
- 寄送時間以台灣時間（UTC+8）計算，目前還不能改時區。
- Spotify 連結需要更新時，bot 會私訊提醒你，到時重做一次
  [第 6 步](#第-6-步連結你的-spotify-帳號)就好。

週報、月報可以在 admin 頁關掉。

## 匯入完整的 Spotify 歷史（選用）

Spotify 可以把你所有的播放紀錄寄給你：

1. 到 [Spotify 隱私設定](https://www.spotify.com/account/privacy/) 申請
   **Extended streaming history**（延伸串流紀錄）。Spotify 會用 email 寄給你，
   通常幾天內，最久 30 天。
2. 解壓縮下載的檔案。
3. 先備份資料庫，試跑一次確認沒問題（不會寫入任何東西），再正式匯入：

   ```bash
   npm run cf:d1:backup:remote
   npm run cf:import -- --remote --dry-run /解壓縮後的資料夾路徑
   npm run cf:import -- --remote /解壓縮後的資料夾路徑
   ```

4. 回到 admin 頁按 **立即同步**，更新統計數字。

同一份資料匯入兩次也不會重複計算。比較短的「Account data」匯出檔也能用，只是細節比較少。
重疊時段怎麼處理、怎麼設定截止時間、怎麼撤銷一次匯入，請看
[docs/backup-rollback-and-import.md](docs/backup-rollback-and-import.md)（英文）。

## 常見問題

<details>
<summary><b>Spotify 顯示 <code>INVALID_CLIENT: Invalid redirect URI</code></b></summary>

Spotify 後台的 Redirect URI 和 `wrangler.toml` 裡的 `SPOTIFY_REDIRECT_URI` 必須完全一樣，
包含 `https://`，結尾也不能多一個斜線。改正錯的那一邊；如果改的是 `wrangler.toml`，
再跑一次 `npm run cf:deploy`。
</details>

<details>
<summary><b>同步失敗，出現 <code>Active premium subscription required</code> 或 403 錯誤</b></summary>

建立 Spotify app 的那個帳號必須有有效的 Premium 訂閱。如果你連結的是另一個 Spotify 帳號，
要先在 Spotify app 設定的 **Users Management** 把它加進去。
</details>

<details>
<summary><b>收不到週報私訊</b></summary>

- 確認 bot 在一個你也在的伺服器裡。
- 在那個伺服器允許成員傳私訊（對伺服器按右鍵 → **隱私設定**）。
- 確認 `DISCORD_USER_ID` 填的是你的使用者 ID，不是 Application ID。
- 確認 bot token 是最新的。在 Developer Portal 重設 token 後舊的就失效了，要再跑一次
  `npx wrangler secret put DISCORD_TOKEN`。
</details>

<details>
<summary><b>admin 頁登入失敗，或連結顯示 <code>unauthorized</code></b></summary>

輸入的密碼跟 `ADMIN_TOKEN` 不一樣。忘記的話，用 `npx wrangler secret put ADMIN_TOKEN`
設一組新的。
</details>

<details>
<summary><b>Discord 個人檔案 widget 沒有更新</b></summary>

請看 [docs/discord-widget.md](docs/discord-widget.md)（英文）。現在已經不能建立新的 widget；
如果你沒有 widget，把 `config/app.json` 裡的 `"patchDiscordOnSync"` 改成 `false`，
再部署一次。
</details>

## 更新版本

下載新版（或 `git pull`）。如果是下載 ZIP，記得把舊資料夾裡的 `wrangler.toml` 複製到新資料夾。接著執行：

```bash
npm install
npm run cf:d1:migrate:remote
npm run cf:deploy
```

你的 `wrangler.toml`、機密值和資料都會保留。

## 更多文件

以下文件目前只有英文：

- [Admin 頁](docs/admin-page.md)：所有設定、統計項目和管理路由。
- [Discord 個人檔案 widget](docs/discord-widget.md)：給已經有 widget 的人看的欄位名稱。
- [Cloudflare Worker 部署](docs/cloudflare-worker.md)：上面設定步驟的參考版。
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
- `scripts/`：D1 備份和歷史匯入工具。
- `migrations/`：D1 資料表 migration。
- `config/`：預設的 app 和 widget 設定。
- `test/`：Node 測試。

執行測試和語法檢查：

```bash
npm test
find src worker shared scripts test -name '*.js' -print0 | xargs -0 -n 1 node --check
```

用 `npm run cf:dev` 在本機跑 Worker。本機 Node/SQLite 的指令（`npm run spotify:auth-url`、
`spotify:token`、`spotify:sync`、`npm start`）會讀 `.env`，可以從
[.env.example](.env.example) 複製一份開始。

已知限制：

- admin 頁介面只有繁體中文。
- 週報、月報的排程固定用 `Asia/Taipei`。
- Spotify 的 Recently Played API 只給歌曲長度，不是實際聽了多久，所以同步來的聽歌時間是估計值。
  匯入的歷史紀錄才有精確的播放時間。
- Spotify 的歷史匯出檔不含專輯封面。

## 授權

[MIT](LICENSE)

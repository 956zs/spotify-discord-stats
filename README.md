# Spotify Discord Stats

English | [繁體中文](README.zh-TW.md)

Keep your own Spotify listening history and get a weekly and monthly recap in
your Discord DMs. It runs for free on Cloudflare, with no server of your own.

- Saves every song you play on Spotify, checked every 10 minutes.
- Sends a weekly recap every Monday and a monthly recap on the 1st, as a
  Discord DM with your top songs, artists, albums, listening time, and habits.
- Has a small web page (`/admin`) where you pick which stats to show and send
  test recaps.
- Can import your full Spotify history export, so stats go back years.
- Can update a Discord profile widget with your stats, if your Discord app
  still has one (see the note below).

![Admin page with sample data](docs/images/admin.png)

> [!IMPORTANT]
> **About the Discord profile widget.** Discord ended its custom profile widget
> experiment on 2026-07-27, so new widgets can no longer be created. If you
> already have one, it keeps working for now: see
> [docs/discord-widget.md](docs/discord-widget.md). Everything else in this
> project works without a widget.

## Contents

- [What you need](#what-you-need)
- [Setup, step by step](#setup-step-by-step)
- [What happens next](#what-happens-next)
- [Import your full Spotify history](#import-your-full-spotify-history-optional)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [More docs](#more-docs)
- [For developers](#for-developers)

## What you need

- **Spotify Premium.** Since February 2026, Spotify requires Premium to use a
  developer app like the one you create here.
- **A Discord account** and a server where you can add a bot. Your own empty
  server works; creating one is free.
- **A free [Cloudflare](https://dash.cloudflare.com/sign-up) account.** This is
  where the project runs.
- **[Node.js](https://nodejs.org/) 24 or newer** on your computer, used only to
  set things up.
- About 30 minutes, and a terminal (Command Prompt, PowerShell, or Terminal)
  you can paste commands into.

Along the way you will collect a few values. Keep a text file open and paste
them there as you go:

| Value | You get it in |
| --- | --- |
| Discord Application ID | Step 2 |
| Discord bot token (keep secret) | Step 2 |
| Your Discord user ID | Step 2 |
| Database ID | Step 3 |
| Your Worker URL | Step 3 |
| Spotify Client ID | Step 4 |
| Spotify Client Secret (keep secret) | Step 4 |
| Admin password (keep secret, you make it up) | Step 5 |

## Setup, step by step

### Step 1: Download the project

Click the green **Code** button on this page, then **Download ZIP**, and unzip
it. Or, if you use git:

```bash
git clone https://github.com/956zs/spotify-discord-stats.git
```

Open a terminal in the project folder and install what it needs:

```bash
npm install
```

### Step 2: Create a Discord bot

The bot is what sends you the recap DMs.

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and click **New Application**. Give it any name, for example
   `My Spotify Stats`.
2. On the **General Information** page, copy the **Application ID**.
3. Open the **Bot** page, click **Reset Token**, and copy the token. Discord
   shows it only once. Treat it like a password.
4. Add the bot to your server: open **OAuth2** → **URL Generator** and tick
   the `bot` scope. Open the generated link at the bottom, pick your server,
   and confirm.
5. Get your own user ID: in Discord, open **User Settings** (the gear icon) →
   **Advanced** and turn on **Developer Mode**. Then right-click your name anywhere and choose
   **Copy User ID**.

> [!NOTE]
> The bot can only DM you if you share a server with it and that server allows
> DMs from members (right-click the server → **Privacy Settings**).

### Step 3: Set up Cloudflare

1. Log in to Cloudflare from the terminal. A browser window opens; click
   **Allow**.

   ```bash
   npx wrangler login
   ```

2. Make your settings file by copying the example. On Windows, use `copy`
   instead of `cp`, or copy and rename the file in File Explorer.

   ```bash
   cp wrangler.example.toml wrangler.toml
   ```

3. Create the database:

   ```bash
   npm run cf:d1:create
   ```

   It prints a `database_id` (a long ID like `1a2b3c4d-...`). Copy it. If
   Wrangler asks whether to add the database to your config for you, answer
   **No**.
4. Open `wrangler.toml` in a text editor and paste the ID into
   `database_id = "paste-database-id-here"`. Save.
5. Set up the database tables, then put the project online for the first time:

   ```bash
   npm run cf:d1:migrate:remote
   npm run cf:deploy
   ```

   If this is your first Worker, Wrangler asks you to pick a `workers.dev`
   subdomain. Any free name works.
6. The deploy prints your **Worker URL**, something like
   `https://spotify-discord-stats.your-name.workers.dev`. Copy it.

### Step 4: Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   log in, and click **Create app**.
2. Fill in:
   - **App name** and **App description**: anything, for example
     `My Spotify Stats`.
   - **Redirect URIs**: your Worker URL followed by `/spotify/callback`, for
     example `https://spotify-discord-stats.your-name.workers.dev/spotify/callback`.
     Click **Add**.
   - When asked which APIs you plan to use, tick **Web API**.
3. Accept the terms and click **Save**.
4. Open the app's **Settings**. Copy the **Client ID**, then click
   **View client secret** and copy the **Client Secret**.

> [!NOTE]
> Sign in to Spotify in Step 6 with the same account that owns this app. To use
> a different Spotify account, add it under **Settings** → **Users Management**
> first.

### Step 5: Fill in your settings

1. Open `wrangler.toml` again and fill in the `[vars]` section with your
   values. Keep the quotes:

   ```toml
   [vars]
   DISCORD_CLIENT_ID = "your Discord Application ID"
   DISCORD_USER_ID = "your Discord user ID"
   SPOTIFY_CLIENT_ID = "your Spotify Client ID"
   SPOTIFY_REDIRECT_URI = "your Worker URL/spotify/callback"
   PUBLIC_BASE_URL = "your Worker URL"
   ```

2. Make up an admin password: a long random string of at least 32 characters
   (a password manager can generate one). You use it to open the admin page.
3. Save the three secret values in Cloudflare. Run each command, then paste the
   value when it asks:

   ```bash
   npx wrangler secret put DISCORD_TOKEN
   npx wrangler secret put SPOTIFY_CLIENT_SECRET
   npx wrangler secret put ADMIN_TOKEN
   ```

   Cloudflare never shows these values again, so keep your admin password
   somewhere safe.
4. Deploy again so the new settings take effect:

   ```bash
   npm run cf:deploy
   ```

### Step 6: Connect your Spotify account

Open this address in your browser, with your own Worker URL and admin password:

```text
https://YOUR_WORKER_URL/spotify/login?token=YOUR_ADMIN_PASSWORD
```

Spotify asks for permission to read your recently played songs. Click
**Agree**. You should see **Spotify authorization complete**.

### Step 7: Check that it works

1. Open `https://YOUR_WORKER_URL/admin` and sign in with your admin password.
2. Click **立即同步** (Sync now). The preview fills with your recent songs.
3. Click **發送週報** (Send weekly recap). A recap DM from your bot should
   arrive in Discord within a few seconds.

Done. You can close the terminal; everything now runs on Cloudflare.

## What happens next

- Every 10 minutes, the Worker reads your last 50 played songs from Spotify and
  saves new ones. Spotify only keeps a short recent history, so songs from
  before you set this up are missing until you
  [import your history](#import-your-full-spotify-history-optional).
- **Weekly recap:** every Monday at 09:00, covering the last 7 days.
- **Monthly recap:** on the 1st of each month at 09:00, covering the previous
  month.
- Recap times use Taiwan time (UTC+8). The time zone is not configurable yet.
- When the Spotify connection needs renewing, the bot reminds you by DM. Repeat
  [Step 6](#step-6-connect-your-spotify-account) when it does.

Recaps can be turned off on the admin page.

## Import your full Spotify history (optional)

Spotify can send you everything you have ever played:

1. Go to your [Spotify privacy settings](https://www.spotify.com/account/privacy/)
   and request **Extended streaming history**. Spotify emails it to you,
   usually within a few days and at most 30.
2. Unzip the download.
3. Back up the database, check the import without writing anything, then
   import:

   ```bash
   npm run cf:d1:backup:remote
   npm run cf:import -- --remote --dry-run /path/to/the/unzipped/folder
   npm run cf:import -- --remote /path/to/the/unzipped/folder
   ```

4. On the admin page, click **立即同步** (Sync now) to refresh the numbers.

Running the same import twice does not count songs twice. The shorter
"Account data" export also works, but it has less detail. For overlap handling,
cutoffs, and how to undo an import, see
[docs/backup-rollback-and-import.md](docs/backup-rollback-and-import.md).

## Troubleshooting

<details>
<summary><b>Spotify says <code>INVALID_CLIENT: Invalid redirect URI</code></b></summary>

The Redirect URI in the Spotify dashboard and `SPOTIFY_REDIRECT_URI` in
`wrangler.toml` must match exactly, including `https://` and with no trailing
slash. Fix whichever one is wrong, then run `npm run cf:deploy` if you changed
`wrangler.toml`.
</details>

<details>
<summary><b>Sync fails with <code>Active premium subscription required</code> or a 403 error</b></summary>

The Spotify account that owns the app needs an active Premium subscription. If
you connected a different Spotify account, add it under **Users Management** in
the Spotify app settings.
</details>

<details>
<summary><b>No recap DM arrives</b></summary>

- Make sure the bot is in a server you are also in.
- In that server, allow DMs from members (right-click the server →
  **Privacy Settings**).
- Check that `DISCORD_USER_ID` is your user ID, not the Application ID.
- Check that the bot token is current. Resetting it in the Developer Portal
  invalidates the old one; run `npx wrangler secret put DISCORD_TOKEN` again.
</details>

<details>
<summary><b>The admin page rejects my password, or a link shows <code>unauthorized</code></b></summary>

The password does not match `ADMIN_TOKEN`. If you lost it, set a new one with
`npx wrangler secret put ADMIN_TOKEN`.
</details>

<details>
<summary><b>The Discord profile widget does not update</b></summary>

See [docs/discord-widget.md](docs/discord-widget.md). New widgets can no
longer be created; if you do not have one, set `"patchDiscordOnSync": false`
in `config/app.json` and deploy again.
</details>

## Updating

Download the new version (or `git pull`). If you downloaded a ZIP, copy your
`wrangler.toml` from the old folder into the new one. Then run:

```bash
npm install
npm run cf:d1:migrate:remote
npm run cf:deploy
```

Your `wrangler.toml`, secrets, and data are kept.

## More docs

- [Admin page](docs/admin-page.md): every setting, stat, and admin route.
- [Discord profile widget](docs/discord-widget.md): widget field names, for
  existing widgets.
- [Cloudflare Worker deployment](docs/cloudflare-worker.md): the setup above
  in reference form.
- [Backup, rollback, and history import](docs/backup-rollback-and-import.md)
- [Running on your own server](docs/vps-deployment.md): a Node.js + SQLite
  alternative to Cloudflare. It does not send scheduled recaps.
- [Recap glossary](docs/recap-glossary.md) and
  [ADR 0001](docs/adr/0001-discord-recap-reports.md): how recap reports are
  designed.

## For developers

Project layout:

- `worker/`: the Cloudflare Worker (routes, D1 access, Spotify, Discord,
  stats, recap delivery).
- `shared/`: runtime-neutral helpers (time, keys, play parsing, metrics,
  recap rendering).
- `src/`: Node.js + SQLite runtime for local development and the VPS option.
- `scripts/`: D1 backup and history import tools.
- `migrations/`: D1 schema migrations.
- `config/`: default app and widget settings.
- `test/`: Node test suite.

Run the tests and a syntax check:

```bash
npm test
find src worker shared scripts test -name '*.js' -print0 | xargs -0 -n 1 node --check
```

Run the Worker locally with `npm run cf:dev`. Local Node/SQLite commands
(`npm run spotify:auth-url`, `spotify:token`, `spotify:sync`, `npm start`) read
`.env`; copy [.env.example](.env.example) to get started.

Known limitations:

- The admin page interface is in Traditional Chinese.
- Recap schedules use `Asia/Taipei`.
- Spotify's Recently Played API returns track length, not time actually
  listened, so listening time from synced plays is an estimate. Imported
  history has exact play time.
- Spotify history exports do not include album artwork.

## License

[MIT](LICENSE)

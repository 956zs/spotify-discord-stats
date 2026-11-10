# Cloudflare Worker Deployment

This is the recommended deployment path for this project. The
[README](../README.md#setup-step-by-step) walks through it step by step; this
page is the reference form.

What runs on Cloudflare:

- Worker Cron syncs Spotify Recently Played every 10 minutes.
- D1 stores plays, artists, OAuth state, the refresh token, and the settings
  the Worker fills in by itself (see [What is stored in D1](#what-is-stored-in-d1)).
- Worker routes handle the Spotify OAuth callback, the admin page, and admin
  actions.
- Discord widget PATCH, recap DMs, and reauthorization DMs use the Discord REST
  API.

Cloudflare Tunnel and local ports are not needed for this deployment target.

Discord DMs only work if the bot shares a server with the target Discord user
and that user allows DMs. If DMs fail, Spotify authorization and sync still
continue; the Worker logs the failure and skips the notification.

Spotify artist genre enrichment is disabled because Spotify artist genre
metadata is deprecated and unreliable for new apps. The default widget uses
`Top_Album` instead.

## When To Use This

Use Worker deployment when you want the full feature set:

- 10-minute scheduled sync with Worker Cron.
- D1 storage and D1 backup/Time Travel.
- Browser-based Spotify setup and reauthorization through the admin page.
- Manual admin routes for sync, stats, and real recap DM sends.
- Scheduled weekly/monthly recap DMs.

Use [VPS deployment](vps-deployment.md) instead only if you want a plain Node
process and local SQLite storage.

## Fast Path

With the Deploy to Cloudflare button (no local tools needed):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/956zs/spotify-discord-stats)

Cloudflare copies the repo into your GitHub (or GitLab) account, creates the
D1 database, asks for `DISCORD_TOKEN` and `ADMIN_TOKEN` (the names come from
[.dev.vars.example](../.dev.vars.example), the descriptions from
`cloudflare.bindings` in [package.json](../package.json)), and runs
`npm run deploy`. Later pushes to that repo build and deploy again through
Workers Builds.

From your own machine (Node.js 24+):

```bash
npm install
npx wrangler login
npm run deploy
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put ADMIN_TOKEN
```

Then, in both cases:

1. Open `https://YOUR_WORKER_URL/admin` and sign in with `ADMIN_TOKEN`.
2. On the **Status** tab, create a Spotify app with the Redirect URI shown in
   the **Spotify app** panel, paste its Client ID and Client Secret, and click
   **Save and check**.
3. Click **Reconnect Spotify** and approve the Spotify consent screen.

`YOUR_WORKER_URL` is where the Worker is served: either the free
`spotify-discord-stats.<your-subdomain>.workers.dev` address that the deploy
prints, or your own domain if you uncomment `routes` in `wrangler.toml`.

## What npm run deploy does

[scripts/deploy.js](../scripts/deploy.js) is the one command for the first
deploy and every update, locally and on Workers Builds:

- When the database exists, it applies new migrations
  (`wrangler d1 migrations apply DB --remote`) and then deploys. If the
  migrations fail, the Worker is not deployed.
- When the database does not exist yet, it deploys first, so Wrangler creates
  the database (it prints `Provisioning DB ...` and
  `Creating new D1 Database`), then applies the migrations.

Later deploys find the database by its name, so the shipped `wrangler.toml`
needs no `database_id`. Extra arguments after `--` are passed to
`wrangler deploy` (the migrations still run first). `npm run cf:deploy` is the same command.

## Wrangler config

The repo ships [wrangler.toml](../wrangler.toml) with no IDs. It works as is
with the Deploy button and `npm run deploy`.

For a personal setup (account ID, your own domain, a fixed `database_id`,
`[vars]`), copy `wrangler.toml` to `wrangler.local.toml`. That file is
gitignored, and the npm scripts (`deploy`, `cf:dev`, `cf:d1:migrate:*`,
`cf:d1:backup:*`, `cf:import`) pass `--config wrangler.local.toml` whenever it
exists. For any other Wrangler command, use `npm run cf -- <wrangler args>`,
which does the same:

```bash
npm run cf -- secret put DISCORD_TOKEN
npm run cf -- d1 execute DB --remote --command "SELECT COUNT(*) FROM plays;"
```

The D1 scripts address the database by its binding name `DB`, so they work
whatever the database itself is called. Plain `npx wrangler ...` reads
`wrangler.toml` only.

## Required secrets

| Name | What it is |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token (Developer Portal → your app → **Bot** → **Reset Token**). |
| `ADMIN_TOKEN` | Admin password. Protects `/admin`, `/spotify/login`, and the `/admin/*` routes. Use a random string of at least 32 characters. |

Set them with the Deploy button form, `npx wrangler secret put NAME`, or in
the Cloudflare dashboard (your Worker → **Settings** →
**Variables and Secrets**). The settings page signs in once with
`ADMIN_TOKEN` and keeps a session cookie; the other routes also accept
`?token=`.

You do not need `SPOTIFY_REFRESH_TOKEN`. The Worker stores the refresh token in
D1 after **Reconnect Spotify**.

## What the Worker fills in by itself

The settings that used to be required `[vars]` are now found at runtime
([worker/lib/runtime-config.js](../worker/lib/runtime-config.js)):

- `DISCORD_CLIENT_ID` and `DISCORD_USER_ID`: read from the bot token with
  `GET /applications/@me`: the application ID and its owner. For an app that
  belongs to a team, the team owner. The result is cached in D1 per bot token,
  so a new token is looked up again.
- `PUBLIC_BASE_URL`: the `https` origin the admin page was last opened on
  while signed in. The cron run, which has no request, uses the stored value
  for uploaded hero image URLs and the reconnect link in reminder DMs. Before
  the admin page has been opened once, reminder DMs say to open the admin page
  instead of linking to it.
- `SPOTIFY_REDIRECT_URI`: `PUBLIC_BASE_URL` + `/spotify/callback`. Because it
  follows the origin you open the admin page on, add each origin's Redirect URI
  to the Spotify app if you use more than one (for example `workers.dev` and a
  custom domain), or pin one with `PUBLIC_BASE_URL`.
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`: entered in the
  **Spotify app** panel on the admin page's **Status** tab. **Save and check**
  verifies the pair with Spotify (client credentials grant) before saving it to
  D1. Saving a different Client ID means the old refresh token no longer
  works; the page then asks you to click **Reconnect Spotify**.

## Optional settings

A value set in Cloudflare always wins over the one the Worker finds, so
existing setups keep working unchanged. Set these as `[vars]` in
`wrangler.toml` / `wrangler.local.toml`, or as secrets
(`npx wrangler secret put NAME`):

| Name | Default | Notes |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | the bot token's application | Application that owns the widget. |
| `DISCORD_USER_ID` | the application's owner | User whose widget is updated and who gets the DMs. |
| `DISCORD_REMINDER_USER_ID` | `DISCORD_USER_ID` | Send DMs to this user instead. |
| `DISCORD_IDENTITY_ID` | `0` | Identity in the widget PATCH URL, see [discord-widget.md](discord-widget.md#how-the-worker-updates-the-widget). |
| `PUBLIC_BASE_URL` | last admin page origin | Public `https` origin of the Worker. |
| `SPOTIFY_REDIRECT_URI` | `PUBLIC_BASE_URL/spotify/callback` | When set, its origin is also used as `PUBLIC_BASE_URL` if that is not set. |
| `SPOTIFY_CLIENT_ID` | the admin page value | Set together with `SPOTIFY_CLIENT_SECRET`. |
| `SPOTIFY_CLIENT_SECRET` | the admin page value | Use a secret, not a var. |

When `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` is set in Cloudflare, the
**Spotify app** panel is read-only and says so; set both, or neither.

Plain-text variables added in the Cloudflare dashboard are replaced by the
`[vars]` in the Wrangler config on the next deploy (including Workers Builds).
Secrets are kept. So if you set an override in the dashboard, add it as a
secret, or put it in the Wrangler config.

## What is stored in D1

`app_state` keys that hold derived values:

| Key | Value |
| --- | --- |
| `discord_app` | JSON with the bot token's hash, application ID, and owner ID |
| `public_base_url` | Last `https` origin the admin page was opened on |
| `spotify_client_id` | Spotify Client ID from the admin page |
| `spotify_client_secret` | Spotify Client Secret from the admin page |

The Spotify Client Secret is stored in D1 like the Spotify refresh token
(`spotify_refresh_token`). Treat D1 exports and backups as secret data.

## D1 migrations

`npm run deploy` applies them. To apply them on their own:

```bash
npm run cf:d1:migrate:remote
```

Migrations include the `album_image_url` column used by recap report artwork,
read-path indexes (`0003`), the artist first-play index used by the "new
artists" widget metric (`0004`), the `widget_images` table for an uploaded
widget hero image (`0005`), and the `stat_windows` / `stat_counts` tables that
keep the widget numbers up to date incrementally (`0006`).

## Updating

With the Deploy button: sync your GitHub copy with this repo (GitHub
**Sync fork**, or `git pull https://github.com/956zs/spotify-discord-stats.git main`
and push); the push triggers Workers Builds, which runs `npm run deploy`.

From your own machine: `git pull` (or download the new version),
`npm install`, `npm run deploy`.

Setups made before the Deploy button had an untracked `wrangler.toml`. Rename
it to `wrangler.local.toml` before `git pull`, since `wrangler.toml` is now
tracked. Its `[vars]` and the existing secrets keep working.

## Manual Admin Routes

```text
GET /admin                      (settings page, sign in with ADMIN_TOKEN)
GET /spotify/login?token=YOUR_ADMIN_TOKEN
GET /admin/sync?token=YOUR_ADMIN_TOKEN
GET /admin/stats?token=YOUR_ADMIN_TOKEN
POST /admin/recap/weekly/send?token=YOUR_ADMIN_TOKEN
POST /admin/recap/monthly/send?token=YOUR_ADMIN_TOKEN
POST /admin/recap/monthly/send?token=YOUR_ADMIN_TOKEN&month=2026-06
GET /health
```

`/spotify/login` redirects to `/admin#status` while the Spotify app is not set
up. After Spotify redirects back to `/spotify/callback`, the refresh token is
saved to D1. The scheduled sync can then run without manual intervention until
Spotify requires reauthorization again.

Scheduled recap reports are sent after the regular 10-minute sync loop when the
configured local send time matches Monday 09:00 or the 1st day of the month at
09:00 in `Asia/Taipei`.

## Local development

Copy [.dev.vars.example](../.dev.vars.example) to `.dev.vars` and fill in
`DISCORD_TOKEN` and `ADMIN_TOKEN`. Enter the Spotify app on the admin page, or
add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.dev.vars`. Then:

```bash
npm run cf:d1:migrate:local
npm run cf:dev
```

## Import Spotify Export to D1

Read [Backup, Rollback, and Spotify History Import](backup-rollback-and-import.md)
before importing into remote D1.

After Spotify sends the long-term streaming history export, extract it and run:

```bash
npm run cf:import -- --remote /path/to/extracted/spotify/export
```

For local D1 testing:

```bash
npm run cf:d1:migrate:local
npm run cf:import -- --local /path/to/extracted/spotify/export
```

By default the importer only imports plays from before your first API-synced
play, so the overlap is not counted twice (`--before` and `--no-cutoff`
override this). It uses export `ms_played` to improve listening-time accuracy.

# Cloudflare Worker Deployment

This deploys the Spotify stats service to Cloudflare Workers:

- Worker Cron syncs Spotify Recently Played every 10 minutes.
- D1 stores plays, artists, OAuth state, and refresh tokens.
- Worker routes handle Spotify OAuth callback and admin actions.
- Discord widget PATCH and reauthorization DMs use Discord REST API.

Cloudflare Tunnel and local ports are not needed for this deployment target.

Discord DMs only work if the bot shares a server with the target Discord user
and that user allows DMs. If DMs fail, Spotify authorization and sync still
continue; the Worker logs the failure and skips the notification.

Spotify artist genre enrichment is disabled because Spotify artist genre
metadata is deprecated and unreliable for new apps. The default widget uses
`Top_Album` instead.

## Required Cloudflare Auth

Run this locally and finish the browser authorization:

```bash
wrangler login
wrangler whoami
```

## Create D1

```bash
npm run cf:d1:create
```

Copy the returned `database_id` into [wrangler.toml](../wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "spotify-discord-stats"
database_id = "paste-database-id-here"
```

## Configure Worker Vars

Edit [wrangler.toml](../wrangler.toml):

```toml
[vars]
DISCORD_CLIENT_ID = "your-discord-application-id"
DISCORD_USER_ID = "your-discord-user-id"
SPOTIFY_CLIENT_ID = "your-spotify-client-id"
PUBLIC_BASE_URL = "https://spotify-stats.mimidlc.me"
SPOTIFY_REDIRECT_URI = "https://spotify-stats.mimidlc.me/spotify/callback"
```

This project is configured to use:

```text
https://spotify-stats.mimidlc.me
```

The Spotify redirect URI is:

```text
https://spotify-stats.mimidlc.me/spotify/callback
```

Add the exact redirect URI to the Spotify Developer Dashboard.

## Set Worker Secrets

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put SPOTIFY_CLIENT_SECRET
wrangler secret put ADMIN_TOKEN
```

`ADMIN_TOKEN` protects `/spotify/login`, `/admin/sync`, and `/admin/stats`.

You do not need to set `SPOTIFY_REFRESH_TOKEN` if you will authorize through
`/spotify/login` after deploy. The Worker stores the refresh token in D1.

## Apply D1 Migration

```bash
npm run cf:d1:migrate:remote
```

Migrations include the `album_image_url` column used by recap report artwork.

## Deploy

```bash
npm run cf:deploy
```

## Initial Spotify Authorization

Open:

```text
https://spotify-stats.mimidlc.me/spotify/login?token=YOUR_ADMIN_TOKEN
```

After Spotify redirects back to `/spotify/callback`, the refresh token is saved
to D1. The scheduled sync can then run without manual intervention until Spotify
requires reauthorization again.

## Manual Admin Routes

```text
GET /admin/sync?token=YOUR_ADMIN_TOKEN
GET /admin/stats?token=YOUR_ADMIN_TOKEN
POST /admin/recap/weekly/send?token=YOUR_ADMIN_TOKEN
POST /admin/recap/monthly/send?token=YOUR_ADMIN_TOKEN
POST /admin/recap/monthly/send?token=YOUR_ADMIN_TOKEN&month=2026-06
GET /health
```

Scheduled recap reports are sent after the regular 10-minute sync loop when the
configured local send time matches Monday 09:00 or the 1st day of the month at
09:00 in `Asia/Taipei`.

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

The importer deduplicates overlap with API-synced plays by `played_at + track_id`
and uses export `ms_played` to improve listening-time accuracy.

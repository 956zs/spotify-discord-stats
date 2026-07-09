# VPS Deployment

This runs the Node runtime on your own machine:

- Spotify sync loop runs every 10 minutes.
- SQLite stores plays and OAuth state.
- The Discord bot logs in through the Gateway.
- The built-in HTTP server handles Spotify OAuth callback.
- Discord widget PATCH works the same as the Worker target.

Weekly/monthly recap scheduling is currently wired in the Cloudflare Worker
runtime only. Use the Worker deployment if those DMs must run automatically.

## When To Use This

Use VPS deployment when you want a simple process and a local SQLite file.

Use Cloudflare Worker instead when you want D1, Worker Cron, admin HTTP routes,
and scheduled recap DMs.

## Server Requirements

- Node.js 24+
- Git
- A reverse proxy or tunnel if you want browser-based Spotify reauthorization
- A Discord application/bot token
- A Spotify app using Authorization Code flow

## Install

Clone the repo on the VPS:

```bash
git clone https://github.com/YOUR_NAME/spotify-discord-stats.git
cd spotify-discord-stats
npm install
cp .env.example .env
```

Fill `.env`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_USER_ID=
DISCORD_REMINDER_USER_ID=

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://your-domain.example/spotify/callback
SPOTIFY_REFRESH_TOKEN=

PUBLIC_BASE_URL=https://your-domain.example
AUTH_SERVER_HOST=127.0.0.1
AUTH_SERVER_PORT=23189

DATABASE_PATH=./data/spotify.sqlite
```

Keep `.env` private. It contains secrets.

## Spotify Redirect URI

Add the exact redirect URI to the Spotify Developer Dashboard:

```text
https://your-domain.example/spotify/callback
```

The local HTTP server listens on `AUTH_SERVER_HOST:AUTH_SERVER_PORT`. Put your
reverse proxy or tunnel in front of it.

For a temporary tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:23189
```

For a permanent setup, point your reverse proxy at:

```text
http://127.0.0.1:23189
```

## Initial Spotify Authorization

Generate an authorization URL:

```bash
npm run spotify:auth-url
```

Open the URL, authorize, then copy the returned callback URL or `code` value:

```bash
npm run spotify:token -- "PASTE_CODE_OR_CALLBACK_URL"
```

That saves the refresh token into SQLite.

## Test Sync

Run one sync:

```bash
npm run spotify:sync
```

Expected result:

- Spotify Recently Played is fetched.
- New plays are inserted into SQLite.
- Discord widget is patched if `patchDiscordOnSync` is enabled.

If Spotify returns `Active premium subscription required`, fix the Spotify
subscription on the app owner account and try again later.

## Run Continuously

For an interactive run:

```bash
npm start
```

For a background sync loop without the Discord Gateway client:

```bash
npm run worker
```

`npm start` is the fuller VPS mode because it logs into Discord and starts the
OAuth callback server.

## systemd Service

Create `/etc/systemd/system/spotify-discord-stats.service`:

```ini
[Unit]
Description=Spotify Discord Stats
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/spotify-discord-stats
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Adjust `WorkingDirectory` to your actual clone path.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spotify-discord-stats
sudo systemctl status spotify-discord-stats
```

View logs:

```bash
journalctl -u spotify-discord-stats -f
```

## Import Spotify Export Into SQLite

Extract the Spotify zip locally or on the VPS, then run:

```bash
npm run spotify:import -- /path/to/extracted/spotify/export
```

The importer supports one-year account streaming history and extended streaming
history. It deduplicates overlap by `played_at + track_key`.

## SQLite Backup

Stop the service before copying the database:

```bash
sudo systemctl stop spotify-discord-stats
mkdir -p backups/sqlite
cp data/spotify.sqlite "backups/sqlite/spotify-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
sudo systemctl start spotify-discord-stats
```

If SQLite creates `-wal` or `-shm` files beside the database, copy those too
while the service is stopped.

## Update Deployment

Pull code and restart:

```bash
git pull
npm install
npm test
sudo systemctl restart spotify-discord-stats
```

Run migrations implicitly by starting the app. The local SQLite runtime creates
or updates required tables on boot.

## Troubleshooting

- Widget does not change: run `npm run spotify:sync` and inspect the error.
- OAuth callback does not work: verify `SPOTIFY_REDIRECT_URI`, reverse proxy,
  and Spotify dashboard redirect URI are exactly the same.
- DMs do not work: make sure the bot shares a server with the target user and
  the user allows DMs.
- Recap DMs do not send on VPS: expected for now; use Cloudflare Worker for
  scheduled recap delivery.

# Spotify Discord Stats

Minimal self-hosted Spotify stats worker for a Discord application widget.

It stores Spotify plays in SQLite, calculates simple stats, PATCHes the Discord
application identity profile payload used by Discord widgets, and DMs you before
the Spotify refresh token needs reauthorization.

## Requirements

- Node.js 24+
- A Discord application/bot token
- A Spotify app using Authorization Code flow

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env`.

## Create Spotify App

1. Open the Spotify Developer Dashboard.
2. Click **Create app**.
3. Fill any app name and description.
4. In the app settings, add this Redirect URI:

```text
https://your-domain.example/spotify/callback
```

5. Save settings.
6. Copy **Client ID** into `SPOTIFY_CLIENT_ID`.
7. Copy **Client Secret** into `SPOTIFY_CLIENT_SECRET`.

The app uses Authorization Code flow with these scopes:

```text
user-read-recently-played user-read-currently-playing
```

If you want one-click reauthorization from the bot DM, expose this app on your
VPS and set:

```env
PUBLIC_BASE_URL=https://your-domain.example
SPOTIFY_REDIRECT_URI=https://your-domain.example/spotify/callback
AUTH_SERVER_HOST=127.0.0.1
AUTH_SERVER_PORT=23189
```

Add the exact redirect URI to the Spotify developer dashboard.

With Cloudflare Tunnel, route your public hostname to the local service:

```yaml
ingress:
  - hostname: your-domain.example
    service: http://127.0.0.1:23189
  - service: http_status:404
```

For a quick tunnel test:

```bash
cloudflared tunnel --url http://127.0.0.1:23189
```

Generate a Spotify authorization URL:

```bash
npm run spotify:auth-url
```

Open the printed URL, authorize, then copy the returned `code` or full callback
URL and exchange it:

```bash
npm run spotify:token -- "PASTE_CODE_OR_CALLBACK_URL"
```

The callback server stores new refresh tokens in SQLite. The CLI token command
also stores the token in SQLite and prints it for backup.

Run once:

```bash
npm run spotify:sync
```

Run the bot plus background sync loop:

```bash
npm start
```

Run only the background worker:

```bash
npm run worker
```

## Commands

There are no bot commands. `npm start` logs the bot in, starts the OAuth callback
server, runs automatic sync, and sends a DM with a reauthorization link when the
stored refresh token is close to the configured validity window.

## Import Spotify history

You can start recording with the API first, then import Spotify export data
later. Overlapping plays are deduplicated by `played_at + track_id`, so the same
play should not be counted twice.

After Spotify gives you the long-term streaming history zip, extract it and run:

```bash
npm run spotify:import -- /path/to/extracted/history
```

The importer supports common Spotify export fields such as `ts`, `ms_played`,
`master_metadata_track_name`, `master_metadata_album_artist_name`,
`master_metadata_album_album_name`, and `spotify_track_uri`.

The export usually has accurate `ms_played`, while future API syncs estimate
listening time with track duration.

## Widget fields

The env field names must match the Discord widget editor `Data Field` names:

- `Songs_Played`
- `Listening_Time`
- `Unique_Songs`
- `Different_Artists`
- `Different_Albums`
- `Most_Listened_Genre`

Change them in `.env` if your widget uses different names.

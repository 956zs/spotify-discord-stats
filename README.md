# Spotify Discord Stats

Self-hosted Spotify listening stats for a Discord application widget and private
Discord DM recaps.

The main deployment target is Cloudflare Workers + D1. The Worker syncs Spotify
Recently Played every 10 minutes, stores plays in D1, patches the Discord
application widget, and sends weekly/monthly recap DMs. A local Node/SQLite
runtime is still available for development and migration work.

## What It Does

- Stores Spotify play history in SQLite/D1.
- Patches Discord application widget dynamic fields.
- Admin page (`/admin`) to pick the widget's stats, ranges, and copy without a redeploy.
- Shows the last played track from Spotify Recently Played as `song`.
- Calculates 7, 28, and 90 day stats.
- Sends Discord DM recap reports with Components v2.
- Imports Spotify account-data and extended streaming-history exports.
- Provides D1 backup and rollback notes before large imports.

There are no slash commands. Admin actions are protected by `ADMIN_TOKEN`.

## Requirements

- Node.js 24+
- Wrangler authenticated with Cloudflare
- Cloudflare Workers + D1
- A Discord application/bot token
- A Spotify app using Authorization Code flow

## Install

```bash
npm install
cp .env.example .env
```

Fill `.env` for local development. Cloudflare production secrets are set with
`wrangler secret put`.

Deployment guides:

- [Cloudflare Worker deployment](docs/cloudflare-worker.md) - recommended, full feature target.
- [VPS deployment](docs/vps-deployment.md) - Node process + SQLite, useful when you want to own the machine.
- [Backup, rollback, and Spotify history import](docs/backup-rollback-and-import.md)
- [Recap glossary](docs/recap-glossary.md)

## Project Layout

- `src/`: local Node runtime, SQLite storage, OAuth callback server, and sync loop.
- `worker/`: Cloudflare Worker runtime, routes, D1 access, Spotify, Discord, stats, and delivery.
- `shared/`: runtime-neutral helpers for time, keys, play parsing, songs, ranges, and recap rendering.
- `scripts/`: D1 backup/import tools and recap prototype server.
- `migrations/`: D1 schema migrations.
- `test/`: Node test suite.

## Spotify App

Create a Spotify app in the Spotify Developer Dashboard and add the redirect URI
you deploy with:

```text
https://spotify-stats.mimidlc.me/spotify/callback
```

The app currently needs this scope:

```text
user-read-recently-played
```

The widget uses Last Played from Recently Played, not Now Playing. That keeps
the sync at one Spotify API read every 10 minutes instead of polling real-time
player state.

## Deployment Choices

Choose one path first. Do not run both against the same Discord widget unless
you intentionally want two processes fighting over the same profile payload.

| Feature | Cloudflare Worker + D1 | VPS Node + SQLite |
| --- | --- | --- |
| 10-minute Spotify sync | Yes | Yes |
| Discord widget patch | Yes | Yes |
| Spotify OAuth callback | Yes | Yes |
| Reauthorization DM | Yes | Yes |
| Weekly/monthly recap DM | Yes | Not scheduled yet |
| Spotify export import | D1 import | SQLite import |
| Backups | D1 export / Time Travel | SQLite file backup |

Recommended default: use Cloudflare Worker + D1. It is the deployment this repo
keeps fully wired for scheduled recaps, admin routes, D1 backup, and real-send
testing.

Use VPS when you want a plain Node process with a local SQLite file and you do
not need Worker Cron or D1.

## Cloudflare Worker Quick Start

Log in:

```bash
wrangler login
wrangler whoami
```

Create and configure D1:

```bash
npm run cf:d1:create
```

Copy the returned `database_id` into [wrangler.toml](wrangler.toml).

Set Worker secrets:

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put SPOTIFY_CLIENT_SECRET
wrangler secret put ADMIN_TOKEN
```

Give only the name; Wrangler then prompts for the value. Secrets cannot be read
back later, so keep `ADMIN_TOKEN` somewhere safe. To generate and set one in a
single step (bash/zsh; in fish use `set -l TOKEN (openssl rand -hex 32)`):

```bash
TOKEN=$(openssl rand -hex 32); echo "$TOKEN"; printf %s "$TOKEN" | npx wrangler secret put ADMIN_TOKEN; unset TOKEN
```

`ADMIN_TOKEN` protects these routes:

```text
/admin                      (settings page, signs in with ADMIN_TOKEN)
/spotify/login
/admin/sync
/admin/stats
/admin/recap/weekly/send
/admin/recap/monthly/send
```

The older routes accept either `?token=ADMIN_TOKEN` or the session cookie set by
the `/admin` sign-in.

## Admin Settings Page

Open `https://spotify-stats.mimidlc.me/admin` and sign in with `ADMIN_TOKEN`.
The page edits settings at runtime, with no redeploy:

- Global stats range: 7 / 28 / 90 / 365 days, a custom number of days, or all time.
- Widget copy: username, hero title, main title, last-updated prefix.
- Six stat slots. Each slot picks a metric, a range (follow global, a fixed
  number of days, or all time), a label, and a value format, and slots can be
  reordered.
- Weekly/monthly recap DMs on or off.

It also shows a live preview, a manual sync button, recap test sends, and the
Spotify authorization status.

Text fields accept placeholders: `{range}` (`4w`, `90d`, `all time`),
`{rangeLong}` (`4 Weeks`, `All Time`), `{count}` (songs played), and `{value}`
in slot value formats. Inside a slot, placeholders use that slot's own range.

Slot metrics (defined in `shared/widget-metrics.js`):

| Group | Metrics |
| --- | --- |
| Counts | songs played, unique songs, artists, albums |
| Time | listening minutes, listening hours, daily minutes, daily plays, average track length |
| Top | top song (optionally with artist), top artist, top album, and each one's play count |
| Habits | peak hour, peak weekday, listening days, busiest day, late-night share (00:00–05:00) |
| Discovery | new songs, new artists (first heard in the range), plays per song |
| Streaks | current streak, longest streak |
| Milestone | days since the first stored play |

Genres and skip rates are not offered: artist genres are not stored, and
Recently Played rows carry track length rather than time actually listened.

Saved settings live in D1 (`app_state.admin_settings`) and override
`config/app.json` / `config/widget.json`, which stay as the defaults. Signing in
sets a 30-day session cookie signed with `ADMIN_TOKEN`, so rotating the token
signs every session out.

The Discord widget editor binds its six stats to fixed Data Fields. Each slot
fills one pair from `config/widget.json` `fields.slots` (for example
`Songs_Played` / `Songs_Played_Label`), whatever metric it shows. Each stat's
Label must use Value Type `User Data` with the `_Label` field name.

Only the queries the chosen slots need are run, once per distinct range. Results
are cached per range in `app_state` and reused until a newer play arrives, the
hour changes, or the slot selection changes. After importing older history,
press the sync button on the admin page to refresh the cached numbers. The
"new artists" metric needs migration `0004`.

Apply migrations and deploy:

```bash
npm run cf:d1:migrate:remote
npm run cf:deploy
```

Authorize Spotify after deploy:

```text
https://spotify-stats.mimidlc.me/spotify/login?token=YOUR_ADMIN_TOKEN
```

The callback stores the Spotify refresh token in D1.

Full guide: [docs/cloudflare-worker.md](docs/cloudflare-worker.md).

## VPS Quick Start

VPS mode runs the local Node runtime:

```bash
npm install
cp .env.example .env
```

Fill `.env`, then authorize Spotify:

```bash
npm run spotify:auth-url
npm run spotify:token -- "PASTE_CODE_OR_CALLBACK_URL"
```

Run once:

```bash
npm run spotify:sync
```

Run continuously:

```bash
npm start
```

Full guide: [docs/vps-deployment.md](docs/vps-deployment.md).

## Widget Fields

The Discord widget editor Data Field names must match
[config/widget.json](config/widget.json) `fields`:

- `top_hero_title`
- `during`
- `last_updated`
- `song`
- `main_title`

The six stats each use a value field and a label field. In the widget editor,
set both the stat's Value and its Label to Value Type `User Data`:

| Stat | Value field | Label field |
| --- | --- | --- |
| #1 | `Songs_Played` | `Songs_Played_Label` |
| #2 | `Listening_Time` | `Listening_Time_Label` |
| #3 | `Unique_Songs` | `Unique_Songs_Label` |
| #4 | `Different_Artists` | `Different_Artists_Label` |
| #5 | `Different_Albums` | `Different_Albums_Label` |
| #6 | `Top_Album` | `Top_Album_Label` |

These names are fixed slots: what each slot shows is chosen on the admin page,
so `Songs_Played` may end up holding a top artist. Turning on the Label's
Fallback in the editor keeps the card readable before the first sync.

The `song` field is compact by design, for example:

```text
♪ Call of Silence
```

If the widget editor does not update immediately, reload the Discord client or
restart the widget editor.

## Recap Reports

Recaps are Discord DMs rendered with Components v2:

- Weekly: rolling 7 days, Monday 09:00 `Asia/Taipei`.
- Monthly: previous natural month, every 1st day 09:00 `Asia/Taipei`.
- Layout uses Containers, Sections, Thumbnails, Media Gallery, Separators, and
  Text Display markdown.
- Reports include totals, deltas, top tracks/artists/albums, new tracks,
  listening patterns, peak day/hour, late-night percent, and streaks.

Manual real-send routes:

```bash
TOKEN="$(tr -d '\n' < .cloudflare-admin-token)"
curl -X POST "https://spotify-stats.mimidlc.me/admin/recap/weekly/send?token=${TOKEN}"
curl -X POST "https://spotify-stats.mimidlc.me/admin/recap/monthly/send?token=${TOKEN}"
curl -X POST "https://spotify-stats.mimidlc.me/admin/recap/monthly/send?token=${TOKEN}&month=2026-06"
```

Those routes send real Discord DMs. They are not preview routes.

## Import Spotify History

Spotify exports come in two useful shapes:

- One-year account streaming history, usually with `endTime`, `artistName`,
  `trackName`, and `msPlayed`.
- Extended streaming history, usually with `ts`, `ms_played`,
  `master_metadata_track_name`, `master_metadata_album_artist_name`,
  `master_metadata_album_album_name`, and `spotify_track_uri`.

The importer supports both. Extended streaming history is better because it has
album names and Spotify Track URI more often.

Before importing remote D1, read
[docs/backup-rollback-and-import.md](docs/backup-rollback-and-import.md).

Dry run:

```bash
npm run cf:import -- --remote --dry-run /path/to/extracted/spotify/export
```

If the export overlaps with rows already synced from the Spotify API, use a
cutoff:

```bash
npm run cf:import -- --remote --dry-run --before 2026-07-05T13:02:33.723Z /path/to/extracted/spotify/export
```

Backup:

```bash
npm run cf:d1:backup:remote
```

Import:

```bash
npm run cf:import -- --remote /path/to/extracted/spotify/export
```

Imports deduplicate overlap by `played_at + track_key`. Re-running the same
export should not double-count plays.

One-year account-data exports usually do not include Spotify Track URI and use
minute-level timestamps, so they may not deduplicate perfectly against rows that
were already synced through the Web API. Prefer `--before` for the overlap
window.

## Backup And Rollback

Worker code rollback:

```bash
/usr/bin/wrangler versions list --name spotify-discord-stats
/usr/bin/wrangler rollback --name spotify-discord-stats VERSION_ID
```

D1 backup:

```bash
npm run cf:d1:backup:remote
```

D1 point-in-time restore:

```bash
/usr/bin/wrangler d1 time-travel info spotify-discord-stats --timestamp="2026-07-09T05:00:00Z"
/usr/bin/wrangler d1 time-travel restore spotify-discord-stats --timestamp="2026-07-09T05:00:00Z"
```

D1 restore is destructive and restores the whole database. For deleting only one
bad Spotify export import, use the targeted SQL in
[docs/backup-rollback-and-import.md](docs/backup-rollback-and-import.md).

## Commands

```bash
npm test
npm run spotify:auth-url
npm run spotify:token -- "PASTE_CODE_OR_CALLBACK_URL"
npm run spotify:sync
npm run spotify:import -- /path/to/extracted/history
npm run cf:dev
npm run cf:deploy
npm run cf:d1:migrate:remote
npm run cf:d1:backup:remote
npm run cf:import -- --remote /path/to/extracted/history
npm run prototype:recap-demo
```

## Local Runtime

Local Node/SQLite works for development and is the same runtime used by the VPS
deployment:

```bash
npm run spotify:auth-url
npm run spotify:token -- "PASTE_CODE_OR_CALLBACK_URL"
npm run spotify:sync
npm start
```

Local data is stored under `data/` by default and is gitignored.

## Testing

Run tests and syntax checks:

```bash
npm test
find src worker shared scripts test -name '*.js' -print0 | xargs -0 -n 1 node --check
```

Backend tests should finish quickly; keep `timeout 60 npm test` for automation.

## Notes

- Spotify export imports do not include album artwork. API-synced rows can store
  album artwork from Spotify track metadata.
- Discord DMs require the bot to share a server with the target user and for DMs
  to be allowed.
- Spotify may reject Recently Played API calls if the Spotify app owner's
  Premium subscription is inactive.

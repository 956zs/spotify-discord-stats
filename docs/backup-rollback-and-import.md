# Backup, Rollback, and Spotify History Import

This project has two separate things to protect:

- Worker code, which can be rolled back with Wrangler deployments.
- D1 data, which should be protected before imports or schema changes.

Spotify export imports are append/upsert operations. They are safe to run more
than once because plays are keyed by `played_at + track_key`, but a bad import
can still add unwanted rows. Capture a rollback point before importing.

## Worker Code Rollback

List deployed Worker versions:

```bash
npx wrangler versions list --name spotify-discord-stats
```

Roll back to a known good version:

```bash
npx wrangler rollback --name spotify-discord-stats VERSION_ID
```

This only changes the Worker code. It does not roll back D1 rows.

## D1 Rollback

D1 Time Travel is the primary rollback tool for production data. Cloudflare's
D1 Time Travel docs say it can restore a D1 database to a point within the last
30 days on the production backend.

Before a risky import, save the current time:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Check the matching Time Travel bookmark:

```bash
npx wrangler d1 time-travel info spotify-discord-stats --timestamp="2026-07-09T05:00:00Z"
```

Restore the whole database to that point:

```bash
npx wrangler d1 time-travel restore spotify-discord-stats --timestamp="2026-07-09T05:00:00Z"
```

This is destructive: it overwrites the whole database, including OAuth state,
stored Spotify refresh token, Discord widget state, plays, artists, and import
data.

## SQL Backup

Make a remote D1 SQL export before a large import:

```bash
npm run cf:d1:backup:remote
```

Backups are written to `backups/d1/`, which is gitignored. Treat those files as
secret data because a full D1 export includes `app_state` values.

For a local D1 backup:

```bash
npm run cf:d1:backup:local
```

## Request Spotify Export

Spotify can send two useful export shapes:

- **Account data / last-year streaming history:** roughly the past year of
  listening. Spotify documents this as the stream end time in UTC, creator name,
  item name, and `msPlayed`.
- **Extended Streaming History:** lifetime account listening data. Spotify's
  data docs describe this as including stream end time in UTC, platform,
  milliseconds played, country, track/artist/album names, Spotify Track URI,
  start/end reasons, shuffle/skipped state, offline mode, and private-session
  state.

The project importer supports both. The extended export is better for long-term
recaps because it has album names and Spotify Track URI fields more often.

One-year account data can overlap with rows already collected from the Spotify
Web API. It usually has minute-level timestamps and no Spotify Track URI, so it
cannot always deduplicate perfectly against API-synced rows. Use `--before` to
stop the account-data import before your first API-synced play.

Spotify usually sends a zip. Extract it locally. The importer scans nested
folders and reads every `.json` file it can parse as an array.

Expected useful files often look like:

```text
Streaming_History_Audio_2013-2015_0.json
Streaming_History_Audio_2015-2016_1.json
StreamingHistory_music_0.json
```

Last-year account data rows often look like this:

```json
{
  "endTime": "2026-07-09 13:10",
  "artistName": "Tatsuya Kitani",
  "trackName": "素敵なしゅうまつを！",
  "msPlayed": 123456
}
```

Extended streaming history rows often look like this:

```json
{
  "ts": "2026-07-09T05:10:30Z",
  "platform": "android",
  "ms_played": 123456,
  "conn_country": "TW",
  "master_metadata_track_name": "素敵なしゅうまつを！",
  "master_metadata_album_artist_name": "Tatsuya Kitani",
  "master_metadata_album_album_name": "青のすみか",
  "spotify_track_uri": "spotify:track:..."
}
```

The importer currently uses these fields when present:

- `ts`, `endTime`, or `played_at`
- `ms_played` or `msPlayed`
- `master_metadata_track_name`, `trackName`, or `track_name`
- `master_metadata_album_artist_name`, `artistName`, or `artist_name`
- `master_metadata_album_album_name`, `albumName`, or `album_name`
- `spotify_track_uri`, `spotifyTrackUri`, or `track_uri`

Podcast/video rows and local files without a usable track name and artist are
skipped.

Some Spotify account-data files are not useful JSON arrays for this app. The
importer skips non-array JSON and logs invalid JSON files instead of importing
them.

For last-year account data, Spotify may not include album names or Spotify Track
URIs. Those rows still import, but album-based reports are weaker until the same
track appears from the Web API or a richer extended export.

## Import to Remote D1

First run a dry run. This writes SQL chunks but does not touch D1:

```bash
npm run cf:import -- --remote --dry-run /path/to/extracted/spotify/export
```

If the export overlaps with API-synced rows, add a cutoff. For example, if your
first API row is `2026-07-05T13:02:33.723Z`:

```bash
npm run cf:import -- --remote --dry-run --before 2026-07-05T13:02:33.723Z /path/to/extracted/spotify/export
```

Then back up:

```bash
npm run cf:d1:backup:remote
```

Then import:

```bash
npm run cf:import -- --remote /path/to/extracted/spotify/export
```

Or with the same cutoff:

```bash
npm run cf:import -- --remote --before 2026-07-05T13:02:33.723Z /path/to/extracted/spotify/export
```

The import command prints an `Import rollback marker`. Keep that exact timestamp
if you may want to remove only that import later.

Verify row counts:

```bash
npx wrangler d1 execute spotify-discord-stats --remote --command "SELECT source, COUNT(*) AS plays FROM plays GROUP BY source;"
```

Check latest rows:

```bash
npx wrangler d1 execute spotify-discord-stats --remote --command "SELECT played_at, track_name, album_name, source FROM plays ORDER BY played_at_ms DESC LIMIT 10;"
```

Find the first API-synced row before choosing an import cutoff:

```bash
npx wrangler d1 execute spotify-discord-stats --remote --command "SELECT MIN(played_at) AS first_api, MAX(played_at) AS last_api, COUNT(*) AS api_rows FROM plays WHERE source = 'spotify_api';"
```

## Roll Back Only One Export Import

Prefer D1 Time Travel if the bad import is recent and you want the whole
database exactly as it was before. If you only want to delete rows inserted by a
single export import, use the rollback marker printed by the import command.

Replace `IMPORT_STARTED_AT` with the exact marker:

```sql
BEGIN TRANSACTION;

DELETE FROM play_artists
WHERE EXISTS (
  SELECT 1
  FROM plays p
  WHERE p.played_at = play_artists.played_at
    AND p.track_key = play_artists.track_key
    AND p.source = 'spotify_export'
    AND p.created_at = 'IMPORT_STARTED_AT'
);

DELETE FROM plays
WHERE source = 'spotify_export'
  AND created_at = 'IMPORT_STARTED_AT';

DELETE FROM artists
WHERE NOT EXISTS (
  SELECT 1
  FROM play_artists pa
  WHERE pa.artist_key = artists.artist_key
);

COMMIT;
```

Run it through Wrangler:

```bash
npx wrangler d1 execute spotify-discord-stats --remote --file rollback-import.sql
```

This targeted rollback only removes rows that were newly inserted by that import
run. Rows that already existed before the import are not deleted.

## After Import

When Spotify API access is working, force one sync to refresh stats and patch the
Discord widget:

```bash
curl -fsS "https://YOUR_WORKER_URL/admin/sync?token=YOUR_ADMIN_TOKEN"
```

If Spotify still returns `Active premium subscription required`, wait until the
Spotify subscription state is active again. The database import does not require
Spotify API access, but widget refresh does.

## References

- Spotify Support: https://support.spotify.com/us/article/understanding-your-data/
- Cloudflare D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare D1 import/export: https://developers.cloudflare.com/d1/best-practices/import-export-data/

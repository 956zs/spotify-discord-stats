# Admin Page

Open `https://YOUR_WORKER_URL/admin` and sign in with your `ADMIN_TOKEN`.
Settings are saved in the database and take effect without a redeploy.

![Admin page](images/admin.png)

The page interface is in Traditional Chinese.

## What you can change

- Global stats range: 7 / 28 / 90 / 365 days, a custom number of days, or all
  time.
- Widget copy: username, hero title, main title, last-updated prefix.
- Six stat slots. Each slot picks a metric, a range (follow global, a fixed
  number of days, or all time), a label, and a value format. Slots can be
  reordered.
- Weekly/monthly recap DMs on or off.

It also shows a live preview, a manual sync button, recap test sends, and the
Spotify authorization status.

Text fields accept placeholders: `{range}` (`4w`, `90d`, `all time`),
`{rangeLong}` (`4 Weeks`, `All Time`), `{count}` (songs played), and `{value}`
in slot value formats. Inside a slot, placeholders use that slot's own range.

## Metrics

Defined in [shared/widget-metrics.js](../shared/widget-metrics.js):

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

## How it works

Saved settings live in D1 (`app_state.admin_settings`) and override
[config/app.json](../config/app.json) and
[config/widget.json](../config/widget.json), which stay as the defaults.
Signing in sets a 30-day session cookie signed with `ADMIN_TOKEN`, so changing
the token signs every session out.

Only the queries the chosen slots need are run, once per distinct range.
Results are cached per range and reused until a newer play arrives, the hour
changes, or the slot selection changes. After importing older history, press
the sync button to refresh the cached numbers. The "new artists" metric needs
migration `0004`.

## Admin routes

All of these need `ADMIN_TOKEN`, either signed in through `/admin` or as
`?token=YOUR_ADMIN_TOKEN`:

```text
GET  /admin                        settings page
GET  /spotify/login                connect or reconnect Spotify
GET  /admin/sync                   sync now
GET  /admin/stats                  stats as JSON
POST /admin/recap/weekly/send      send the weekly recap DM now
POST /admin/recap/monthly/send     send last month's recap DM now (add &month=2026-06 for a given month)
```

The recap routes send real Discord DMs; they are not previews.

# Admin Page

Open `https://YOUR_WORKER_URL/admin` and sign in with your `ADMIN_TOKEN`.
Settings are saved in the database and take effect without a redeploy.

![Admin page](images/admin.png)

The page interface is in Traditional Chinese.

## What you can change

- Global stats range: 7 / 28 / 90 / 365 days, a custom number of days, or all
  time.
- Widget copy: username, hero title, main title, last-updated prefix.
- Widget 大圖 (the big Widget Top image, field `hero_image`):
  - 固定素材 (fixed asset, default): sends nothing, Discord shows the
    `widget_hero` fallback asset.
  - 自訂上傳 (custom upload): upload a PNG, JPEG, WebP or GIF (max 1.5 MB,
    1300×1200 fits the template) on the page. The widget points at
    `PUBLIC_BASE_URL/widget/hero?v=<hash>`, so a new upload changes the URL and
    skips Discord's cache. With no image uploaded, or no `PUBLIC_BASE_URL` /
    `SPOTIFY_REDIRECT_URI` to build a public URL, it falls back to the asset.
    Picking a file opens a crop tool in the browser: drag to move, slider or
    mouse wheel to zoom, with guides for the template's boundaries area (top
    4%), heavy/minor fade zones (left 0–17% / 17–35%) and the three subtitle
    lines. 套用並上傳 uploads exactly 1300×1200 as PNG, or as WebP (quality
    0.92, then 0.85) or JPEG (0.9) when the PNG is over 1.5 MB. Cropping
    turns a GIF into a still image; 不裁切直接上傳 uploads the original file
    instead. The size template (`docs/images/templates/hero-guide-1300x1200.png`)
    is shown next to the upload box and in the crop tool, with a download link.
  - 最近播放的專輯封面 (last played album cover): the Spotify album artwork
    of the last played song. Falls back to the asset when that play has no
    artwork (for example imported history).

  The mode is saved with the other settings; upload and delete take effect
  immediately. The widget editor must use User Data `hero_image` with a
  Fallback, see [discord-widget.md](discord-widget.md#data-field-names).
  The Worker cannot read the widget editor, so in upload and album mode the
  section shows these steps with a link to the app's widget editor (built
  from `DISCORD_CLIENT_ID`) until you tick 我已經在 widget 編輯器設定好了;
  that tick is saved as `widget.heroEditorConfirmed` and only hides the note.
  The Node/VPS runtime has no admin page or image store: it reads the mode
  from `heroImage` in `config/widget.json`, supports `album`, and treats
  `upload` as `asset`.
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
migration `0004`. Uploaded hero images live in the `widget_images` table from
migration `0005`.

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

The page itself uses these JSON routes (signed-in session, same-origin only):

```text
GET  /admin/api/state              settings, defaults, preview payload, hero image info, discordClientId
POST /admin/api/preview            preview payload for unsaved settings
POST /admin/api/settings           save settings
POST /admin/api/push               sync and push to Discord now
POST /admin/api/hero-image         upload the hero image (raw body, Content-Type image/png|jpeg|webp|gif, max 1.5 MB)
POST /admin/api/hero-image/delete  delete the uploaded hero image
```

Uploads are checked against the file's magic bytes, so only real PNG, JPEG,
WebP and GIF files are stored.

## Public routes

```text
GET  /widget/hero                  the uploaded hero image, no sign-in (Discord fetches it)
GET  /admin/hero-template.png      the 1300×1200 hero size template, no sign-in
GET  /health                       health check
```

`/widget/hero` returns the stored Content-Type with
`Cache-Control: public, max-age=31536000, immutable` and an ETag, or 404 when
nothing is uploaded.

`/admin/hero-template.png` is embedded in the Worker as base64
(`worker/lib/hero-template-data.js`). After changing the PNG in
`docs/images/templates/`, regenerate it with
`node scripts/build-hero-template.js`; a test fails if the two drift apart.

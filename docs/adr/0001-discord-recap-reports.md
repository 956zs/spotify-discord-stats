# ADR 0001: Discord Recap Reports

## Status

Accepted.

## Context

The project already records Spotify plays and updates a Discord application
widget every 10 minutes. The bot is private, so interactive slash commands and
public dashboards are not needed yet.

The user wants recap reports inspired by Spotify Wrapped:

- Weekly reports are sent by Discord DM.
- Monthly reports are sent by Discord DM.
- Weekly reports use a rolling 7-day window and are sent Monday at 09:00 in
  `Asia/Taipei`.
- Monthly reports use the natural calendar month.
- Monthly reports are sent on the 1st day of each month at 09:00 in
  `Asia/Taipei`, covering the previous natural month.
- Reports should feel narrative, not only tabular.
- Reports should include as much useful listening context as practical.
- Long reports should be split across multiple complete Discord DM messages.

## Decision

Build a recap-report feature as three separate parts:

- Report data: queries that calculate tracks, artists, albums, listening time,
  daily patterns, time-of-day patterns, repeats, discoveries, and comparisons.
- Report rendering: turns calculated data into a narrative Discord message.
- Report delivery: decides when to send weekly and monthly DMs.

The widget stays separate. It can keep using the lightweight 10-minute sync
payload and should not become the report surface.

Store `album_image_url` on API-synced play rows so report renderers can use real
Spotify artwork without doing extra lookup calls while sending the report.

The first report-data slice should calculate:

- report summary and previous-period deltas,
- top tracks, artists, and albums,
- album shelf candidates with artwork,
- newly discovered tracks,
- peak day, peak hour, late-night percentage, and listening streak length.

The renderer should output only Discord Components v2 message payloads. It must
not include legacy `content` or `embeds`, and it should split the recap into
several compact messages instead of one oversized message.

Use Discord Components v2 for recap DMs:

- Set the `IS_COMPONENTS_V2` message flag.
- Use a dense, scan-friendly layout instead of long generated prose.
- Use Section + Thumbnail for headline stats and ranking entries.
- Use Media Gallery for album shelves when album artwork is available.
- Use Containers, Text Display, Separators, and multiple messages to make long
  reports readable.
- Do not include legacy message `content` or embeds in Components v2 report
  payloads.
- Avoid interactive buttons until the project has an interaction handler.

Do not build preview routes first. They add an extra review step before the
report is useful. Instead, build a throwaway local layout demo first, then fold
the chosen layout into scheduled DM delivery.

Scheduled delivery should send all report parts to Discord DM and mark the
report as sent only after every part is accepted by Discord.

Manual send routes are allowed for real DM testing, but not preview/review:

- `POST /admin/recap/weekly/send?token=...`
- `POST /admin/recap/monthly/send?token=...`
- `POST /admin/recap/monthly/send?token=...&month=YYYY-MM`

## Consequences

- Reports can grow without making widget sync heavier.
- The same report data can later power a dashboard if needed.
- Monthly reports need calendar-aware date ranges instead of simple rolling
  day counts.
- Discord message length limits may require splitting long reports into
  multiple DM messages.
- The local layout demo answers the design question before backend delivery
  code exists.
- Manual send routes are side-effecting and should stay protected by
  `ADMIN_TOKEN`.

## Open Questions

- How long should each narrative report be before it becomes annoying?

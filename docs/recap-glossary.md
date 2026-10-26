# Recap Glossary

## Recap Report

A generated summary of Spotify listening activity for a defined time range,
sent by Discord DM.

## Weekly Report

A recap report covering the last 7 days. This is a rolling window, not a
calendar week.

## Monthly Report

A recap report covering a natural calendar month, such as July 1 through
July 31 in the configured local time zone.

## Narrative Recap

A report style that explains the listening period in plain language, similar
to Spotify Wrapped, instead of only listing raw numbers.

## Report Data

The calculated facts used by a recap report: top tracks, top artists, top
albums, total listening time, unique counts, repeated songs, daily patterns,
and comparisons.

## Report Renderer

The code that turns report data into Discord message text.

## Report Delivery

The scheduling and sending logic that decides when to DM a report.

## Send Route

An optional admin-only HTTP route that builds a report and sends it by Discord
DM. It is side-effecting and should mark a report as sent only after Discord
accepts every message part.

## Components v2 Report

A Discord message payload that uses the `IS_COMPONENTS_V2` flag and presents
report sections with components such as Text Display, Container, and Separator
instead of legacy `content` or embeds.

## Natural Month

A calendar month boundary in the configured local time zone. For example, a
July report covers July 1 00:00 through August 1 00:00.

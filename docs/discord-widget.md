# Discord Profile Widget

> [!WARNING]
> Discord ended the custom profile widget experiment on 2026-07-27. New custom
> widgets can no longer be created, and Discord says existing ones "will no
> longer be supported". Widgets made during the experiment still update today,
> but that can stop at any time. Officially, profile widgets are now
> [Game Stats Widgets](https://docs.discord.com/developers/social-layer/game-stats-widgets/overview),
> available to developers who have claimed their game on Discord.
>
> Sources: Discord's
> [Game Stats Widget Experiment](https://support-dev.discord.com/hc/en-us/articles/42261641635351-Game-Stats-Widget-Experiment)
> support article and
> [discord-api-docs discussion #8527](https://github.com/discord/discord-api-docs/discussions/8527).

This page is for you if your Discord application already has a profile widget.
Everything else in this project (sync, stats, admin page, recap DMs) works
without one.

If you have no widget, turn widget updates off so the Worker does not call the
widget API every 10 minutes: set `"patchDiscordOnSync": false` in
[config/app.json](../config/app.json) and deploy again.

## How the Worker updates the widget

Every sync builds a payload and sends it with the bot token to:

```text
PATCH https://discord.com/api/v9/applications/{DISCORD_CLIENT_ID}/users/{DISCORD_USER_ID}/identities/{DISCORD_IDENTITY_ID}/profile
```

`DISCORD_IDENTITY_ID` defaults to `0`. The payload is only sent when it changed
since the last sync.

## Data Field names

In the widget editor, every field that shows live data uses Value Type
`User Data` with these names (from [config/widget.json](../config/widget.json)
`fields`):

| Field | Shows |
| --- | --- |
| `top_hero_title` | Hero title, for example `✦ 4w on Spotify` |
| `during` | Date range of the stats |
| `last_updated` | Last sync time |
| `song` | Last played track, for example `♪ Call of Silence` |
| `main_title` | Main title, for example `✦ 4w plays: 703` |

The six stats each use a value field and a label field. Set both the stat's
Value and its Label to Value Type `User Data`:

| Stat | Value field | Label field |
| --- | --- | --- |
| #1 | `Songs_Played` | `Songs_Played_Label` |
| #2 | `Listening_Time` | `Listening_Time_Label` |
| #3 | `Unique_Songs` | `Unique_Songs_Label` |
| #4 | `Different_Artists` | `Different_Artists_Label` |
| #5 | `Different_Albums` | `Different_Albums_Label` |
| #6 | `Top_Album` | `Top_Album_Label` |

These names are fixed slots. What each slot shows is chosen on the
[admin page](admin-page.md), so `Songs_Played` may end up holding a top artist.
Turning on the Label's Fallback in the editor keeps the card readable before
the first sync.

If the widget does not change right away, reload the Discord client
(`Ctrl+R`).

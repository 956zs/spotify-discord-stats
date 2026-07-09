# Recap Components v2 Prototype Notes

Prototype question: which Discord Components v2 layout should the weekly and
monthly recap DM use?

This is throwaway. Keep only the winning layout decision, then delete or fold
the prototype into the real recap renderer.

## Variants

- A: chapter cards, one clear story beat per DM.
- B: dense dashboard, fewer messages and more scan-friendly numbers.
- C: timeline zine, more narrative and more like a listening diary.

## Decision

Variant B won. The chosen direction is dense, scan-friendly, and light on
generated prose.

Use more than Container:

- Section + Thumbnail for headline stats and podium entries.
- Media Gallery for album shelves when album images are available.
- Separator for grouping, not as decoration spam.
- Text Display for compact markdown lists.

The next question is whether production should store Spotify album image URLs
so Thumbnail and Media Gallery can render real artwork.

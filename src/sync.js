import { appConfig } from './config.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getConfiguredStatsRanges } from './stats.js';
import { getWidgetPayload, patchDiscordWidget } from './widget.js';

export async function syncOnce(options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed();
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const widget = await getWidgetPayload();

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(widget, { force: options.forcePatch });
  }

  const result = { recentlyPlayed, genres, widget: widget.data.dynamic, discord };
  if (options.includeStatsRanges) {
    result.statsRanges = getConfiguredStatsRanges();
  }
  return result;
}

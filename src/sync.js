import { appConfig } from './config.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getConfiguredStats, getConfiguredStatsRanges } from './stats.js';
import { patchDiscordWidget } from './widget.js';

export async function syncOnce(options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed();
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const stats = getConfiguredStats();

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(stats, { force: options.forcePatch });
  }

  const result = { recentlyPlayed, genres, stats, discord };
  if (options.includeStatsRanges) {
    result.statsRanges = getConfiguredStatsRanges();
  }
  return result;
}

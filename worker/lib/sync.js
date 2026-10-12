import { appConfig } from '../config.js';
import { loadSettings } from './settings.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getStatsRanges, getWidgetStats } from './stats.js';
import { patchDiscordWidget } from './widget.js';

export async function syncOnce(env, options = {}) {
  const settings = await loadSettings(env.DB);
  const recentlyPlayed = await syncRecentlyPlayed(env);
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const stats = await getWidgetStats(env.DB, settings.statsDays, {
    refresh: options.refreshStats
  });

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(env, stats, settings, { force: options.forcePatch });
  }

  const result = { recentlyPlayed, genres, stats, discord };
  if (options.includeStatsRanges) {
    result.statsRanges = await getStatsRanges(env.DB, appConfig.statsRangeDays);
  }
  return result;
}

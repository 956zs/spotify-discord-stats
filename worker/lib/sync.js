import { appConfig } from '../config.js';
import { loadSettings } from './settings.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getStatsRanges, getWidgetData } from './stats.js';
import { buildWidgetPayload, patchDiscordWidget } from './widget.js';

export async function syncOnce(env, options = {}) {
  const settings = await loadSettings(env.DB);
  const recentlyPlayed = await syncRecentlyPlayed(env);
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const data = await getWidgetData(env.DB, settings, { refresh: options.refreshStats });
  const widget = buildWidgetPayload(data, settings);

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(env, widget, { force: options.forcePatch });
  }

  const result = { recentlyPlayed, genres, widget: widget.data.dynamic, discord };
  if (options.includeStatsRanges) {
    result.statsRanges = await getStatsRanges(env.DB, appConfig.statsRangeDays);
  }
  return result;
}

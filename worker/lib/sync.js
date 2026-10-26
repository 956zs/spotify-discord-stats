import { appConfig } from '../config.js';
import { publicBaseUrl } from './env.js';
import { loadSettings } from './settings.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getStatsRanges, getWidgetData } from './stats.js';
import { buildWidgetPayload, patchDiscordWidget } from './widget.js';

export async function syncOnce(env, options = {}) {
  const settings = await loadSettings(env.DB);
  const recentlyPlayed = await syncRecentlyPlayed(env);
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const data = await getWidgetData(env.DB, settings, {
    refresh: options.refreshStats,
    publicBaseUrl: publicBaseUrl(env)
  });
  const widget = buildWidgetPayload(data, settings);

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    // A widget failure (e.g. no widget on the profile) must not fail the sync:
    // plays are already saved and the admin page shows the error as a warning.
    try {
      discord = await patchDiscordWidget(env, widget, { force: options.forcePatch });
    } catch (error) {
      console.warn('Discord widget update failed', error.message);
      discord = { patched: false, skipped: false, reason: 'error', error: error.message };
    }
  }

  const result = { recentlyPlayed, genres, widget: widget.data.dynamic, discord };
  if (options.includeStatsRanges) {
    result.statsRanges = await getStatsRanges(env.DB, appConfig.statsRangeDays);
  }
  return result;
}

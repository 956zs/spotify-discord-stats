import { appConfig } from '../config.js';
import { syncRecentlyPlayed } from './spotify.js';
import { getStats } from './stats.js';
import { patchDiscordWidget } from './widget.js';

export async function syncOnce(env, options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed(env);
  const genres = { updated: 0, skipped: true, reason: 'top_album_replaces_genre' };
  const stats = await getStats(env.DB, appConfig.statsDays);

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(env, stats, { force: options.forcePatch });
  }

  return { recentlyPlayed, genres, stats, discord };
}

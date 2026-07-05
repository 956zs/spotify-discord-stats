import { appConfig } from './config.js';
import { refreshMissingArtistGenres, syncRecentlyPlayed } from './spotify.js';
import { getConfiguredStats } from './stats.js';
import { patchDiscordWidget } from './widget.js';

export async function syncOnce(options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed();
  let genres;
  try {
    genres = await refreshMissingArtistGenres();
  } catch (error) {
    genres = { updated: 0, skipped: true, error: error.message };
  }
  const stats = getConfiguredStats();

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? appConfig.patchDiscordOnSync) {
    discord = await patchDiscordWidget(stats, { force: options.forcePatch });
  }

  return { recentlyPlayed, genres, stats, discord };
}

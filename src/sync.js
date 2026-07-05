import { envBool } from './env.js';
import { refreshMissingArtistGenres, syncRecentlyPlayed } from './spotify.js';
import { getConfiguredStats } from './stats.js';
import { patchDiscordWidget } from './widget.js';

export async function syncOnce(options = {}) {
  const recentlyPlayed = await syncRecentlyPlayed();
  const genres = await refreshMissingArtistGenres();
  const stats = getConfiguredStats();

  let discord = { patched: false, skipped: true, reason: 'disabled' };
  if (options.patchDiscord ?? envBool('PATCH_DISCORD_ON_SYNC', true)) {
    discord = await patchDiscordWidget(stats, { force: options.forcePatch });
  }

  return { recentlyPlayed, genres, stats, discord };
}

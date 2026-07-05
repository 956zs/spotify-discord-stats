import { appConfig } from './config.js';
import { getStats } from './db.js';
import { formatMinutes } from './time.js';

export function getConfiguredStats() {
  return getStats(appConfig.statsDays);
}

export function formatStats(stats) {
  return [
    `Range: last ${stats.days} days`,
    `Songs played: ${stats.songsPlayed}`,
    `Listening time: ${formatMinutes(stats.listeningMs)}`,
    `Unique songs: ${stats.uniqueSongs}`,
    `Different artists: ${stats.differentArtists}`,
    `Different albums: ${stats.differentAlbums}`,
    `Most listened genre: ${stats.mostListenedGenre}`
  ].join('\n');
}

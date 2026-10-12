import { appConfig } from './config.js';
import { getStats } from './db.js';
import { formatMinutes } from './time.js';
import { isAllTime } from '../shared/widget-settings.js';

export function getConfiguredStatsRanges() {
  return getStatsRanges(appConfig.statsRangeDays);
}

export function getStatsRanges(daysList) {
  const ranges = {};
  for (const days of daysList) {
    ranges[`${days}d`] = getStats(days);
  }
  return ranges;
}

export function formatStats(stats) {
  return [
    isAllTime(stats.days) ? 'Range: all time' : `Range: last ${stats.days} days`,
    `Songs played: ${stats.songsPlayed}`,
    `Listening time: ${formatMinutes(stats.listeningMs)}`,
    `Unique songs: ${stats.uniqueSongs}`,
    `Different artists: ${stats.differentArtists}`,
    `Different albums: ${stats.differentAlbums}`,
    `Top album: ${stats.topAlbum}`,
    `Last played: ${stats.lastPlayed.value}`
  ].join('\n');
}

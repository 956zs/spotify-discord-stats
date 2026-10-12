import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const defaultAppConfig = {
  syncIntervalSeconds: 600,
  statsDays: 28,
  statsRangeDays: [7, 28, 90],
  patchDiscordOnSync: true,
  patchOnlyWhenChanged: true,
  spotifyRefreshTokenValidDays: 180,
  spotifyReauthRemindDays: 30,
  reauthReminderIntervalHours: 24,
  recapReports: {
    enabled: true,
    weeklyDay: 1,
    monthlyDay: 1,
    sendHour: 9,
    sendMinute: 0
  }
};

const defaultWidgetConfig = {
  username: 'My Spotify Stats',
  topHeroTitle: '✦ {range} on Spotify🧋',
  lastUpdatedPrefix: 'last updated: ',
  mainTitle: '✦ {range} plays: {count}',
  stats: {
    songsPlayed: { label: 'Total Songs Played', value: '{value}' },
    listeningTime: { label: 'Total Listening Time', value: '{value}' },
    uniqueSongs: { label: 'Unique Songs', value: '{value}' },
    differentArtists: { label: 'Different Artists', value: '{value}' },
    differentAlbums: { label: 'Different Albums', value: '{value}' },
    topAlbum: { label: 'Top Album', value: '{value}' }
  },
  fields: {
    topHeroTitle: 'top_hero_title',
    during: 'during',
    lastUpdated: 'last_updated',
    song: 'song',
    mainTitle: 'main_title',
    songsPlayed: 'Songs_Played',
    listeningTime: 'Listening_Time',
    uniqueSongs: 'Unique_Songs',
    differentArtists: 'Different_Artists',
    differentAlbums: 'Different_Albums',
    topAlbum: 'Top_Album',
    labels: {
      songsPlayed: 'Songs_Played_Label',
      listeningTime: 'Listening_Time_Label',
      uniqueSongs: 'Unique_Songs_Label',
      differentArtists: 'Different_Artists_Label',
      differentAlbums: 'Different_Albums_Label',
      topAlbum: 'Top_Album_Label'
    }
  }
};

export const appConfig = loadConfig('config/app.json', defaultAppConfig);
export const widgetConfig = loadConfig('config/widget.json', defaultWidgetConfig);

function loadConfig(relativePath, defaults) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return defaults;
  }

  const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return deepMerge(defaults, loaded);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override ?? base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

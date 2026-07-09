import { MS_PER_MINUTE } from './time.js';

const COMPONENTS_V2_FLAG = 1 << 15;
const CONTAINER = 17;
const MEDIA_GALLERY = 12;
const SECTION = 9;
const SEPARATOR = 14;
const TEXT_DISPLAY = 10;
const THUMBNAIL = 11;
const SPOTIFY_GREEN = 0x1db954;
const GOLD = 0xf0b45b;
const CYAN = 0x61afef;
const ROSE = 0xe06c75;
const MAX_GALLERY_ITEMS = 10;
const DECORATION = '✦';
const SECONDS_PER_MS = 1000;
const TAIPEI_UTC_OFFSET = '+08:00';
const TIMESTAMP_FULL = 'F';
const TIMESTAMP_LONG_DATE = 'D';
const TIMESTAMP_RELATIVE = 'R';

export function renderRecapMessages(recap, options = {}) {
  const title = options.title ?? defaultTitle(recap.range.kind);
  const messages = [
    overviewMessage(title, recap),
    rankingsMessage(recap),
    albumsAndPatternsMessage(recap),
    discoveriesMessage(recap)
  ].filter(Boolean);
  return messages.map(messagePayload);
}

export function messagePayload(components) {
  return {
    flags: COMPONENTS_V2_FLAG,
    allowed_mentions: { parse: [] },
    components
  };
}

function overviewMessage(title, recap) {
  return [
    container(SPOTIFY_GREEN, [
      headlineComponent(title, recap),
      separator(),
      text(rangeText(recap.range))
    ])
  ];
}

function headlineComponent(title, recap) {
  const content = text(overviewText(title, recap));
  const accessory = topImageAccessory(recap);
  return accessory ? section([content], accessory) : content;
}

function rankingsMessage(recap) {
  return [
    container(GOLD, [
      text(`## ${DECORATION} Rankings`),
      ...podiumSections(recap),
      separator(),
      text(artistRankingText(recap.topArtists))
    ])
  ];
}

function albumsAndPatternsMessage(recap) {
  const components = [text(`## ${DECORATION} Albums and Patterns`)];
  const galleryComponent = albumGallery(recap.topAlbums);
  if (galleryComponent) {
    components.push(galleryComponent, separator());
  }
  components.push(text(patternText(recap.patterns)));
  return [container(CYAN, components)];
}

function discoveriesMessage(recap) {
  return [
    container(ROSE, [
      text(`## ${DECORATION} New This Period`),
      text(newTracksText(recap.newTracks)),
      separator(),
      text(changeText(recap.comparison))
    ])
  ];
}

function podiumSections(recap) {
  return [
    rankingSection('Top song', recap.topTracks[0]),
    rankingSection('Top album', recap.topAlbums[0]),
    text(trackRankingText(recap.topTracks))
  ].filter(Boolean);
}

function rankingSection(label, item) {
  if (!item) {
    return text(`### ${DECORATION} ${label}\nNo data`);
  }

  const details = item.trackName
    ? `**${item.trackName}**\n${artistLine(item.artists)}\n\`${playsText(item.plays)}\``
    : `**${item.albumName}**\n${formatDuration(item.listeningMs)}\n\`${playsText(item.plays)}\``;
  const accessory = imageAccessory(item.albumImageUrl, `${label} artwork`);
  const content = `### ${DECORATION} ${label}\n${details}`;
  return accessory ? section([text(content)], accessory) : text(content);
}

function albumGallery(albums) {
  const items = albums
    .filter((album) => album.albumImageUrl)
    .slice(0, MAX_GALLERY_ITEMS)
    .map((album) => ({
      media: { url: album.albumImageUrl },
      description: `${album.albumName} - ${album.plays} plays`
    }));
  return items.length > 0 ? { type: MEDIA_GALLERY, items } : null;
}

function topImageAccessory(recap) {
  return imageAccessory(recap.topTracks[0]?.albumImageUrl ?? recap.topAlbums[0]?.albumImageUrl, 'Top artwork');
}

function imageAccessory(url, description) {
  return url ? { type: THUMBNAIL, media: { url }, description } : null;
}

function container(accentColor, components) {
  return {
    type: CONTAINER,
    accent_color: accentColor,
    components
  };
}

function section(components, accessory) {
  return {
    type: SECTION,
    components,
    accessory
  };
}

function text(content) {
  return {
    type: TEXT_DISPLAY,
    content
  };
}

function separator() {
  return { type: SEPARATOR };
}

function overviewText(title, recap) {
  const summary = recap.summary;
  return [
    `# ${title}`,
    `> **${playsText(summary.songsPlayed)}** | **${formatDuration(summary.listeningMs)}** | **${summary.differentArtists} artists** | **${summary.differentAlbums} albums**`,
    '',
    `- **Unique songs:** ${inlineMetric(summary.uniqueSongs)}`,
    `- **Previous period:** ${inlineMetric(`${formatSignedNumber(recap.comparison.songsPlayedDelta)} plays`)} ${inlineMetric(formatSignedDuration(recap.comparison.listeningMsDelta))}`
  ].join('\n');
}

function trackRankingText(tracks) {
  return [
    `### ${DECORATION} Top songs`,
    ...tracks.map((track, index) => `${index + 1}. **${track.trackName}** - ${artistLine(track.artists)} ${inlineMetric(playsText(track.plays))}`)
  ].join('\n');
}

function artistRankingText(artists) {
  if (artists.length === 0) {
    return `### ${DECORATION} Top artists\nNo data`;
  }
  return [
    `### ${DECORATION} Top artists`,
    ...artists.map((artist, index) => `${index + 1}. **${artist.artistName}** ${inlineMetric(playsText(artist.plays))}`)
  ].join('\n');
}

function patternText(patterns) {
  const peakHour = patterns.peakHour ? `${patterns.peakHour.label}, ${patterns.peakHour.plays} plays` : 'No data';
  return [
    `### ${DECORATION} Listening pattern`,
    `- **Peak day:** ${peakDayText(patterns.peakDay)}`,
    `- **Peak hour:** ${inlineMetric(peakHour)}`,
    `- **Late-night listening:** ${inlineMetric(`${patterns.lateNightPercent}%`)}`,
    `- **Listening days:** ${inlineMetric(patterns.listeningDays)}`,
    `- **Longest streak:** ${inlineMetric(`${patterns.longestStreakDays} days`)}`
  ].join('\n');
}

function newTracksText(tracks) {
  if (tracks.length === 0) {
    return `### ${DECORATION} First-time tracks\nNo first-time tracks in this period.`;
  }
  return [
    `### ${DECORATION} First-time tracks`,
    ...tracks.map((track, index) => `${index + 1}. **${track.trackName}** - ${artistLine(track.artists)} ${inlineMetric(playsText(track.plays))}`)
  ].join('\n');
}

function changeText(comparison) {
  return [
    `### ${DECORATION} Changes vs previous period`,
    `- **Plays:** ${inlineMetric(formatSignedNumber(comparison.songsPlayedDelta))}`,
    `- **Listening:** ${inlineMetric(formatSignedDuration(comparison.listeningMsDelta))}`,
    `- **Unique songs:** ${inlineMetric(formatSignedNumber(comparison.uniqueSongsDelta))}`,
    `- **Artists:** ${inlineMetric(formatSignedNumber(comparison.differentArtistsDelta))}`,
    `- **Albums:** ${inlineMetric(formatSignedNumber(comparison.differentAlbumsDelta))}`
  ].join('\n');
}

function rangeText(range) {
  return [
    `- **Range:** ${discordTimestamp(range.start, TIMESTAMP_FULL)} to ${discordTimestamp(range.end, TIMESTAMP_FULL)}`,
    `- **Generated:** ${discordTimestamp(range.end, TIMESTAMP_RELATIVE)}`,
    `- **Time zone:** ${inlineMetric(range.timeZone)}`
  ].join('\n');
}

function artistLine(artists = []) {
  return artists.length > 0 ? artists.join(', ') : 'Unknown Artist';
}

function defaultTitle(kind) {
  return kind === 'monthly' ? `${DECORATION} Monthly Recap` : `${DECORATION} Weekly Recap`;
}

function formatSignedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatSignedDuration(ms) {
  return `${ms >= 0 ? '+' : '-'}${formatDuration(Math.abs(ms))}`;
}

function inlineMetric(value) {
  return `\`${value}\``;
}

function playsText(plays) {
  return `${plays} plays`;
}

function peakDayText(peakDay) {
  if (!peakDay) {
    return 'No data';
  }
  return `${discordTimestamp(taipeiDateToIso(peakDay.date), TIMESTAMP_LONG_DATE)} ${inlineMetric(playsText(peakDay.plays))}`;
}

function taipeiDateToIso(date) {
  return `${date}T00:00:00${TAIPEI_UTC_OFFSET}`;
}

function discordTimestamp(value, style) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid Discord timestamp value: ${value}`);
  }
  return `<t:${Math.floor(ms / SECONDS_PER_MS)}:${style}>`;
}

function formatDuration(ms) {
  const minutes = Math.round(ms / MS_PER_MINUTE);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

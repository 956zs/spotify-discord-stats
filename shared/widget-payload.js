import { formatCount } from './number.js';
import { formatDateRange, formatLocalUpdatedAt, formatMinutes } from './time.js';
import { rangeLongLabel, rangeShortLabel, renderTemplate } from './widget-settings.js';

// `widget` is the editable copy from settings; `fields` maps each value to the Data
// Field name configured in the Discord widget editor.
export function buildWidgetPayload(stats, widget, fields, now = new Date()) {
  const vars = {
    range: rangeShortLabel(stats.days),
    rangeLong: rangeLongLabel(stats.days),
    count: formatCount(stats.songsPlayed)
  };
  const values = {
    songsPlayed: formatCount(stats.songsPlayed),
    listeningTime: formatMinutes(stats.listeningMs),
    uniqueSongs: formatCount(stats.uniqueSongs),
    differentArtists: formatCount(stats.differentArtists),
    differentAlbums: formatCount(stats.differentAlbums),
    topAlbum: stats.topAlbum
  };

  const dynamic = [
    widgetField(fields.topHeroTitle, renderTemplate(widget.topHeroTitle, vars)),
    widgetField(fields.during, formatDateRange(stats.since, now)),
    widgetField(
      fields.lastUpdated,
      `${renderTemplate(widget.lastUpdatedPrefix, vars)}${formatLocalUpdatedAt(now)} (UTC +8)`
    ),
    widgetField(fields.song, stats.lastPlayed.value),
    widgetField(fields.mainTitle, renderTemplate(widget.mainTitle, vars))
  ];

  for (const [key, value] of Object.entries(values)) {
    const stat = widget.stats[key];
    dynamic.push(widgetField(fields[key], renderTemplate(stat.value, { ...vars, value })));
    dynamic.push(widgetField(fields.labels?.[key], renderTemplate(stat.label, vars)));
  }

  return {
    username: widget.username,
    data: { dynamic }
  };
}

function widgetField(name, value) {
  if (!name) {
    throw new Error('Widget field name is missing. Check config/widget.json.');
  }
  return { type: 1, name, value };
}

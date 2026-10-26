import { formatCount } from './number.js';
import { resolveHeroImageUrl } from './widget-hero.js';
import { formatDateRange, formatLocalUpdatedAt } from './time.js';
import { formatMetric, metricQueries } from './widget-metrics.js';
import { rangeKey, resolveSince, runMetricQueries } from './widget-metrics-query.js';
import { rangeLongLabel, rangeShortLabel, renderTemplate, resolveSlotRange } from './widget-settings.js';

// Which result sets each range needs for the current settings. Every range gets
// `summary` because titles and labels can use {count}.
export function planWidgetQueries(settings) {
  const plan = new Map();
  const add = (days, queryIds) => {
    const key = rangeKey(days);
    if (!plan.has(key)) {
      plan.set(key, { days, queryIds: new Set(['summary']) });
    }
    for (const id of queryIds) {
      plan.get(key).queryIds.add(id);
    }
  };

  add(settings.statsDays, []);
  for (const slot of settings.widget.slots) {
    add(resolveSlotRange(slot.range, settings.statsDays), metricQueries(slot.metric));
  }
  return plan;
}

// `loadRange(days, queryIds)` returns { since, results } for one range; runtimes pass a
// cached version. `lastPlayed` is the song status shown in the `song` field.
// `heroUpload` ({ sha256 } of the uploaded hero image) and `publicBaseUrl` are only
// passed by runtimes that serve the upload; without them "upload" acts like "asset".
export async function collectWidgetData(db, settings, options) {
  const now = options.now ?? new Date();
  const loadRange = options.loadRange ?? (async (days, queryIds) => {
    const since = await resolveSince(db, days, now);
    return { since, results: await runMetricQueries(db, since, queryIds) };
  });

  const ranges = {};
  for (const [key, { days, queryIds }] of planWidgetQueries(settings)) {
    ranges[key] = { days, ...(await loadRange(days, [...queryIds].sort())) };
  }
  return {
    ranges,
    lastPlayed: options.lastPlayed,
    heroUpload: options.heroUpload ?? null,
    publicBaseUrl: options.publicBaseUrl ?? null,
    now
  };
}

export function buildWidgetPayload(data, settings, fields, now = data.now ?? new Date()) {
  const widget = settings.widget;
  const globalRange = data.ranges[rangeKey(settings.statsDays)];
  const vars = rangeVars(globalRange);

  const dynamic = [
    widgetField(fields.topHeroTitle, renderTemplate(widget.topHeroTitle, vars)),
    widgetField(fields.during, formatDateRange(globalRange.since, now)),
    widgetField(
      fields.lastUpdated,
      `${renderTemplate(widget.lastUpdatedPrefix, vars)}${formatLocalUpdatedAt(now)} (UTC +8)`
    ),
    widgetField(fields.song, data.lastPlayed.value),
    widgetField(fields.mainTitle, renderTemplate(widget.mainTitle, vars))
  ];

  widget.slots.forEach((slot, index) => {
    const slotFields = fields.slots[index];
    if (!slotFields) {
      throw new Error(`Widget slot ${index + 1} has no field names. Check config/widget.json.`);
    }
    const range = data.ranges[rangeKey(resolveSlotRange(slot.range, settings.statsDays))];
    const slotVars = rangeVars(range);
    const value = formatMetric(slot.metric, range.results, { days: range.days, since: range.since, now });
    dynamic.push(widgetField(slotFields.value, renderTemplate(slot.value, { ...slotVars, value })));
    dynamic.push(widgetField(slotFields.label, renderTemplate(slot.label, slotVars)));
  });

  const heroUrl = resolveHeroImageUrl(widget.heroImage, data);
  if (heroUrl) {
    dynamic.push(mediaField(fields.heroImage, heroUrl));
  }

  return {
    username: widget.username,
    data: { dynamic }
  };
}

function rangeVars(range) {
  return {
    range: rangeShortLabel(range.days),
    rangeLong: rangeLongLabel(range.days),
    count: formatCount(range.results.summary.songsPlayed)
  };
}

// Discord dynamic field types: 1 = string, 3 = media ({ url }).
const STRING_FIELD = 1;
const MEDIA_FIELD = 3;

function widgetField(name, value) {
  return { type: STRING_FIELD, name: requireFieldName(name), value };
}

function mediaField(name, url) {
  return { type: MEDIA_FIELD, name: requireFieldName(name), value: { url } };
}

function requireFieldName(name) {
  if (!name) {
    throw new Error('Widget field name is missing. Check config/widget.json.');
  }
  return name;
}

// Editable settings live in two layers: config/*.json supplies defaults at build time,
// and the admin page stores overrides at runtime. Everything here is runtime-neutral so
// the Worker, the Node runtime, and tests share one definition of "valid settings".

export const ALL_TIME = 'all';
export const STAT_KEYS = [
  'songsPlayed',
  'listeningTime',
  'uniqueSongs',
  'differentArtists',
  'differentAlbums',
  'topAlbum'
];

const MAX_STATS_DAYS = 3650;
const MAX_TEXT_LENGTH = 256;
const MAX_USERNAME_LENGTH = 80;
const DAYS_PER_WEEK = 7;
const DAYS_PER_YEAR = 365;

export function defaultSettings(appConfig, widgetConfig) {
  const stats = {};
  for (const key of STAT_KEYS) {
    stats[key] = {
      label: widgetConfig.stats?.[key]?.label ?? '',
      value: widgetConfig.stats?.[key]?.value ?? '{value}'
    };
  }

  return {
    statsDays: appConfig.statsDays,
    recapEnabled: appConfig.recapReports?.enabled !== false,
    widget: {
      username: widgetConfig.username,
      topHeroTitle: widgetConfig.topHeroTitle,
      mainTitle: widgetConfig.mainTitle,
      lastUpdatedPrefix: widgetConfig.lastUpdatedPrefix,
      stats
    }
  };
}

// Stored overrides may predate newly added keys, so missing values fall back to defaults.
export function mergeSettings(defaults, overrides) {
  if (!isPlainObject(overrides)) {
    return defaults;
  }

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in defaults)) {
      continue;
    }
    merged[key] = isPlainObject(defaults[key]) ? mergeSettings(defaults[key], value) : value;
  }
  return merged;
}

// Builds a clean settings object from untrusted input: unknown keys are dropped and
// every kept value is type- and length-checked.
export function validateSettings(input) {
  const errors = [];
  if (!isPlainObject(input)) {
    return { settings: null, errors: ['settings must be an object'] };
  }

  const widgetInput = isPlainObject(input.widget) ? input.widget : {};
  const statsInput = isPlainObject(widgetInput.stats) ? widgetInput.stats : {};
  const stats = {};
  for (const key of STAT_KEYS) {
    const stat = isPlainObject(statsInput[key]) ? statsInput[key] : {};
    stats[key] = {
      label: text(stat.label, `widget.stats.${key}.label`, errors, { required: true }),
      value: text(stat.value, `widget.stats.${key}.value`, errors, { required: true })
    };
  }

  const settings = {
    statsDays: statsDays(input.statsDays, errors),
    recapEnabled: boolean(input.recapEnabled, 'recapEnabled', errors),
    widget: {
      username: text(widgetInput.username, 'widget.username', errors, {
        required: true,
        maxLength: MAX_USERNAME_LENGTH
      }),
      topHeroTitle: text(widgetInput.topHeroTitle, 'widget.topHeroTitle', errors),
      mainTitle: text(widgetInput.mainTitle, 'widget.mainTitle', errors),
      lastUpdatedPrefix: text(widgetInput.lastUpdatedPrefix, 'widget.lastUpdatedPrefix', errors),
      stats
    }
  };

  return errors.length ? { settings: null, errors } : { settings, errors };
}

export function isAllTime(days) {
  return days === ALL_TIME;
}

// Short form for compact titles: 28 -> "4w", 90 -> "90d", all -> "all time".
export function rangeShortLabel(days) {
  if (isAllTime(days)) {
    return 'all time';
  }
  if (days % DAYS_PER_YEAR === 0) {
    return `${days / DAYS_PER_YEAR}y`;
  }
  if (days % DAYS_PER_WEEK === 0) {
    return `${days / DAYS_PER_WEEK}w`;
  }
  return `${days}d`;
}

// Long form for sentences: 28 -> "4 Weeks", 1 -> "1 Day", all -> "All Time".
export function rangeLongLabel(days) {
  if (isAllTime(days)) {
    return 'All Time';
  }
  if (days % DAYS_PER_YEAR === 0) {
    return plural(days / DAYS_PER_YEAR, 'Year');
  }
  if (days % DAYS_PER_WEEK === 0) {
    return plural(days / DAYS_PER_WEEK, 'Week');
  }
  return plural(days, 'Day');
}

// Replaces {name} placeholders. Unknown placeholders stay visible so typos are obvious.
export function renderTemplate(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match
  );
}

function plural(count, unit) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function statsDays(value, errors) {
  if (isAllTime(value)) {
    return ALL_TIME;
  }
  const days = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(days) || days < 1 || days > MAX_STATS_DAYS) {
    errors.push(`statsDays must be "${ALL_TIME}" or a whole number from 1 to ${MAX_STATS_DAYS}`);
    return null;
  }
  return days;
}

function boolean(value, name, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${name} must be true or false`);
    return null;
  }
  return value;
}

function text(value, name, errors, options = {}) {
  const maxLength = options.maxLength ?? MAX_TEXT_LENGTH;
  if (typeof value !== 'string') {
    errors.push(`${name} must be text`);
    return null;
  }
  if (options.required && value.trim() === '') {
    errors.push(`${name} must not be empty`);
    return null;
  }
  if (value.length > maxLength) {
    errors.push(`${name} must be at most ${maxLength} characters`);
    return null;
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

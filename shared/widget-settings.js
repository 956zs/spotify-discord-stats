import { isMetricId } from './widget-metrics.js';

// Editable settings live in two layers: config/*.json supplies defaults at build time,
// and the admin page stores overrides at runtime. Everything here is runtime-neutral so
// the Worker, the Node runtime, and tests share one definition of "valid settings".

export const ALL_TIME = 'all';
export const GLOBAL_RANGE = 'global';

const MAX_STATS_DAYS = 3650;
const MAX_TEXT_LENGTH = 256;
const MAX_USERNAME_LENGTH = 80;
const DAYS_PER_WEEK = 7;
const DAYS_PER_YEAR = 365;

export function defaultSettings(appConfig, widgetConfig) {
  return {
    statsDays: appConfig.statsDays,
    recapEnabled: appConfig.recapReports?.enabled !== false,
    widget: {
      username: widgetConfig.username,
      topHeroTitle: widgetConfig.topHeroTitle,
      mainTitle: widgetConfig.mainTitle,
      lastUpdatedPrefix: widgetConfig.lastUpdatedPrefix,
      slots: widgetConfig.slots.map((slot) => ({
        metric: slot.metric,
        range: slot.range ?? GLOBAL_RANGE,
        label: slot.label ?? '',
        value: slot.value ?? '{value}'
      }))
    }
  };
}

// Stored overrides may predate newly added keys, so missing values fall back to defaults.
// Arrays (the slot list) are replaced whole, and only when the length still matches.
export function mergeSettings(defaults, overrides) {
  if (Array.isArray(defaults)) {
    return Array.isArray(overrides) && overrides.length === defaults.length ? overrides : defaults;
  }
  if (!isPlainObject(overrides)) {
    return defaults;
  }

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in defaults)) {
      continue;
    }
    const nested = isPlainObject(defaults[key]) || Array.isArray(defaults[key]);
    merged[key] = nested ? mergeSettings(defaults[key], value) : value;
  }
  return merged;
}

// Builds a clean settings object from untrusted input: unknown keys are dropped and
// every kept value is type- and length-checked. `slotCount` is the number of stat
// slots wired up in the Discord widget editor.
export function validateSettings(input, slotCount) {
  const errors = [];
  if (!isPlainObject(input)) {
    return { settings: null, errors: ['settings must be an object'] };
  }

  const widgetInput = isPlainObject(input.widget) ? input.widget : {};
  const settings = {
    statsDays: statsDays(input.statsDays, 'statsDays', errors),
    recapEnabled: boolean(input.recapEnabled, 'recapEnabled', errors),
    widget: {
      username: text(widgetInput.username, 'widget.username', errors, {
        required: true,
        maxLength: MAX_USERNAME_LENGTH
      }),
      topHeroTitle: text(widgetInput.topHeroTitle, 'widget.topHeroTitle', errors),
      mainTitle: text(widgetInput.mainTitle, 'widget.mainTitle', errors),
      lastUpdatedPrefix: text(widgetInput.lastUpdatedPrefix, 'widget.lastUpdatedPrefix', errors),
      slots: slots(widgetInput.slots, slotCount, errors)
    }
  };

  return errors.length ? { settings: null, errors } : { settings, errors };
}

// A slot's own range, or the global one when it follows it.
export function resolveSlotRange(slotRange, globalDays) {
  return slotRange === GLOBAL_RANGE ? globalDays : slotRange;
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

function statsDays(value, name, errors) {
  if (isAllTime(value)) {
    return ALL_TIME;
  }
  const days = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(days) || days < 1 || days > MAX_STATS_DAYS) {
    errors.push(`${name} must be "${ALL_TIME}" or a whole number from 1 to ${MAX_STATS_DAYS}`);
    return null;
  }
  return days;
}

function slots(value, slotCount, errors) {
  if (!Array.isArray(value) || value.length !== slotCount) {
    errors.push(`widget.slots must list exactly ${slotCount} slots`);
    return null;
  }

  return value.map((slot, index) => {
    const name = `widget.slots[${index}]`;
    const input = isPlainObject(slot) ? slot : {};
    if (!isMetricId(input.metric)) {
      errors.push(`${name}.metric is not a known metric`);
    }
    return {
      metric: input.metric,
      range: input.range === GLOBAL_RANGE ? GLOBAL_RANGE : statsDays(input.range, `${name}.range`, errors),
      label: text(input.label, `${name}.label`, errors, { required: true }),
      value: text(input.value, `${name}.value`, errors, { required: true })
    };
  });
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

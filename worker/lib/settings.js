import { appConfig, widgetConfig } from '../config.js';
import { defaultSettings, mergeSettings, validateSettings } from '../../shared/widget-settings.js';
import { HttpError } from './http.js';
import { getState, setState } from './state.js';

const SETTINGS_STATE_KEY = 'admin_settings';

export function getDefaultSettings() {
  return defaultSettings(appConfig, widgetConfig);
}

// A corrupt stored row must not take the widget down, so it degrades to defaults.
export async function loadSettings(db) {
  const raw = await getState(db, SETTINGS_STATE_KEY);
  if (!raw) {
    return getDefaultSettings();
  }

  try {
    return mergeSettings(getDefaultSettings(), JSON.parse(raw));
  } catch (error) {
    console.warn('stored settings are unreadable, using defaults', error.message);
    return getDefaultSettings();
  }
}

export function parseSettingsInput(input) {
  const { settings, errors } = validateSettings(input);
  if (!settings) {
    throw new HttpError(`invalid settings: ${errors.join('; ')}`, 400);
  }
  return settings;
}

export async function saveSettings(db, input) {
  const settings = parseSettingsInput(input);
  await setState(db, SETTINGS_STATE_KEY, JSON.stringify(settings));
  return settings;
}

import { cryptoRandomHex } from './crypto.js';
import { MS_PER_MINUTE } from '../../shared/time.js';
import { getState, setState } from './state.js';

const OAUTH_STATE_BYTES = 24;
const OAUTH_STATE_TTL_MINUTES = 10;
const OAUTH_STATE_TTL_MS = OAUTH_STATE_TTL_MINUTES * MS_PER_MINUTE;

export async function createOAuthState(db) {
  const state = cryptoRandomHex(OAUTH_STATE_BYTES);
  await setState(
    db,
    `spotify_oauth_state:${state}`,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString()
    })
  );
  return state;
}

export async function consumeOAuthState(db, state) {
  const key = `spotify_oauth_state:${state}`;
  const raw = await getState(db, key);
  if (!raw || raw === 'used') {
    return false;
  }

  const parsed = parseStoredState(raw);
  if (!parsed || Date.parse(parsed.expiresAt) < Date.now()) {
    return false;
  }

  await setState(db, key, 'used');
  return true;
}

function parseStoredState(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

import { appConfig } from './config.js';
import { env } from './env.js';
import { getState, setState } from './db.js';
import { getSpotifyLoginUrl } from './oauth-server.js';
import { getSpotifyRefreshTokenIssuedAt } from './spotify.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startSpotifyReauthReminder(client) {
  const intervalHours = appConfig.reauthReminderIntervalHours;
  if (intervalHours <= 0) {
    console.log('Spotify reauth reminder disabled.');
    return;
  }

  setInterval(() => {
    runSpotifyReauthReminder(client).catch((error) => {
      console.error('Spotify reauth reminder failed:', error);
    });
  }, intervalHours * 60 * 60 * 1000);

  console.log(`Spotify reauth reminder every ${intervalHours}h.`);
}

export async function runSpotifyReauthReminder(client) {
  const reminderUserId =
    env('DISCORD_REMINDER_USER_ID') || env('DISCORD_USER_ID');
  if (!reminderUserId) {
    console.log('No Discord reminder user configured.');
    return { sent: false, reason: 'missing_reminder_user' };
  }

  const issuedAtRaw = getSpotifyRefreshTokenIssuedAt();
  if (!issuedAtRaw) {
    return sendOncePerDay(
      client,
      reminderUserId,
      'missing-issued-at',
      `Spotify refresh token issue date is not set.\n\n${reauthorizeText()}`
    );
  }

  const issuedAt = new Date(issuedAtRaw);
  if (Number.isNaN(issuedAt.getTime())) {
    return sendOncePerDay(
      client,
      reminderUserId,
      'invalid-issued-at',
      `Spotify refresh token issue date is invalid: \`${issuedAtRaw}\`. Use an ISO timestamp such as \`${new Date().toISOString()}\`.`
    );
  }

  const validDays = appConfig.spotifyRefreshTokenValidDays;
  const remindDays = appConfig.spotifyReauthRemindDays;
  const expiresAt = new Date(issuedAt.getTime() + validDays * MS_PER_DAY);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / MS_PER_DAY);

  if (daysLeft > remindDays) {
    return { sent: false, reason: 'not_due', daysLeft };
  }

  const message =
    daysLeft >= 0
      ? `Spotify refresh token will need reauthorization in ${daysLeft} day(s). Expires around ${expiresAt.toISOString()}.\n\n${reauthorizeText()}`
      : `Spotify refresh token may already be expired. It expired around ${expiresAt.toISOString()}.\n\n${reauthorizeText()}`;

  return sendOncePerDay(client, reminderUserId, `reauth-${expiresAt.toISOString().slice(0, 10)}`, message);
}

function reauthorizeText() {
  const loginUrl = getSpotifyLoginUrl();
  if (loginUrl) {
    return `Authorize here: ${loginUrl}`;
  }

  return 'No public OAuth URL is configured. Set `PUBLIC_BASE_URL` and `SPOTIFY_REDIRECT_URI`, or run `npm run spotify:auth-url` and `npm run spotify:token -- "<callback url>"` manually.';
}

async function sendOncePerDay(client, userId, reason, message) {
  const today = new Date().toISOString().slice(0, 10);
  const stateKey = `spotify_reauth_reminder_sent:${reason}`;
  if (getState(stateKey) === today) {
    return { sent: false, reason: 'already_sent_today' };
  }

  const user = await client.users.fetch(userId);
  await user.send(message);
  setState(stateKey, today);
  return { sent: true, reason };
}

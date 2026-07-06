import { buildSpotifyAuthorizeUrl, exchangeSpotifyCode } from './spotify.js';
import { createOAuthState, consumeOAuthState } from './oauth-state.js';
import { trySendDiscordDm } from './discord.js';
import { html } from './http.js';

export async function startSpotifyLogin(env) {
  const state = await createOAuthState(env.DB);
  return Response.redirect(buildSpotifyAuthorizeUrl(env, state), 302);
}

export async function handleSpotifyCallback(url, env) {
  const spotifyError = url.searchParams.get('error');
  if (spotifyError) {
    return html('Spotify authorization denied', `Spotify returned: ${spotifyError}`, 400);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return html('Spotify authorization failed', 'Missing code or state.', 400);
  }

  if (!(await consumeOAuthState(env.DB, state))) {
    return html('Spotify authorization failed', 'Invalid or expired state.', 400);
  }

  const token = await exchangeSpotifyCode(env, code);
  const notification = await trySendDiscordDm(
    env,
    'Spotify authorization completed. New refresh token was saved in D1.'
  );

  if (!token.refresh_token) {
    console.warn('Spotify token response did not contain a refresh token.');
  }

  return html('Spotify authorization complete', callbackMessage(notification));
}

function callbackMessage(notification) {
  const savedAt = new Date().toISOString();
  if (notification.sent) {
    return `Refresh token saved at ${savedAt}. You can close this tab.`;
  }

  return `Refresh token saved at ${savedAt}. Discord DM was skipped: ${notification.error}. You can close this tab.`;
}

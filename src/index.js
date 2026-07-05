import { Client, GatewayIntentBits } from 'discord.js';
import { requiredEnv } from './env.js';
import { appConfig } from './config.js';
import { getDbHealth } from './db.js';
import { syncOnce } from './sync.js';
import { runSpotifyReauthReminder, startSpotifyReauthReminder } from './reminder.js';
import { startSpotifyOAuthServer } from './oauth-server.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('DB health:', getDbHealth());
  startSpotifyOAuthServer(client);
  runSpotifyReauthReminder(client).catch((error) => {
    console.error('Spotify reauth reminder failed:', error);
  });
  startSpotifyReauthReminder(client);
  startBackgroundSync();
});

function startBackgroundSync() {
  const intervalSeconds = appConfig.syncIntervalSeconds;
  if (intervalSeconds <= 0) {
    console.log('Background sync disabled.');
    return;
  }

  const run = async () => {
    try {
      const result = await syncOnce();
      console.log('Sync complete:', {
        fetched: result.recentlyPlayed.fetched,
        inserted: result.recentlyPlayed.inserted,
        genresUpdated: result.genres.updated,
        discordPatched: result.discord.patched,
        discordSkipped: result.discord.skipped
      });
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  };

  setTimeout(run, 5000);
  setInterval(run, intervalSeconds * 1000);
  console.log(`Background sync every ${intervalSeconds}s.`);
}

await client.login(requiredEnv('DISCORD_TOKEN'));

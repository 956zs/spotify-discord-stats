import process from 'node:process';
import { exchangeSpotifyCode } from './spotify.js';

const input = process.argv[2];
const token = await exchangeSpotifyCode(input);

console.log('Access token:', token.access_token);
console.log('Refresh token:', token.refresh_token);
console.log('Expires in:', token.expires_in);
console.log('Saved refresh token to SQLite.');

import process from 'node:process';
import { runWrangler } from './wrangler.js';

// `node scripts/cf.js <wrangler args>`: wrangler with wrangler.local.toml when it exists.
runWrangler(process.argv.slice(2));

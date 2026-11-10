import process from 'node:process';
import { runWrangler, tryWrangler } from './wrangler.js';

// One command for the first deploy and every update, locally and on Cloudflare's
// Deploy button / Workers Builds:
// - the database exists: apply new migrations first, then deploy the new code;
// - it does not exist yet: deploy first (Wrangler creates the database), then migrate.
const PROBE = ['d1', 'info', 'DB', '--json'];
const MIGRATE = ['d1', 'migrations', 'apply', 'DB', '--remote'];
const DEPLOY = ['deploy', ...process.argv.slice(2)];
// `d1 migrations apply` reports a missing database as an authentication error, so the
// probe uses `d1 info`, which says "Couldn't find a D1 DB ...".
const MISSING_DATABASE = /Couldn't find (?:an auto-provisioned |a )?D1 DB/i;

const probe = tryWrangler(PROBE, { quiet: true });
if (probe.status === 0) {
  runWrangler(MIGRATE);
  runWrangler(DEPLOY);
} else if (MISSING_DATABASE.test(probe.output)) {
  console.log('The database does not exist yet. Deploying first so Wrangler creates it.');
  runWrangler(DEPLOY);
  runWrangler(MIGRATE);
} else {
  process.stderr.write(probe.output);
  console.error('Could not check the database, so nothing was deployed.');
  process.exit(probe.status ?? 1);
}

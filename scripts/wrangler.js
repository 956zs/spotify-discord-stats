import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Run the project's own wrangler through node, so it works without a global
// install and on Windows, where spawning `wrangler` directly fails.
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('wrangler/package.json');
const wranglerBin = path.join(path.dirname(packageJsonPath), require(packageJsonPath).bin.wrangler);

// A local wrangler.local.toml (gitignored) replaces the shipped wrangler.toml, so a
// personal setup (account_id, custom domain, database_id, vars) stays out of the repo.
export const LOCAL_CONFIG = 'wrangler.local.toml';

export function configArgs(args = []) {
  if (args.includes('--config') || args.includes('-c') || !fs.existsSync(path.join(process.cwd(), LOCAL_CONFIG))) {
    return [];
  }
  return ['--config', LOCAL_CONFIG];
}

export function runWrangler(args) {
  console.log(`wrangler ${[...args, ...configArgs(args)].join(' ')}`);
  exitOnFailure(spawnWrangler(args, { stdio: 'inherit' }));
}

// Runs wrangler and returns { status, output } without exiting. `quiet` keeps the
// output to the caller instead of echoing it.
export function tryWrangler(args, { quiet = false } = {}) {
  if (!quiet) {
    console.log(`wrangler ${[...args, ...configArgs(args)].join(' ')}`);
  }
  const result = spawnWrangler(args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) {
    console.error(`Could not run wrangler: ${result.error.message}`);
    process.exit(1);
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!quiet) {
    process.stdout.write(output);
  }
  return { status: result.status, output };
}

export function runWranglerJson(args) {
  const result = spawnWrangler([...args, '--json'], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit']
  });
  exitOnFailure(result);
  return JSON.parse(result.stdout);
}

function spawnWrangler(args, options) {
  return spawnSync(process.execPath, [wranglerBin, ...args, ...configArgs(args)], { cwd: process.cwd(), ...options });
}

export function exitOnFailure(result) {
  if (result.error) {
    console.error(`Could not run wrangler: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (result.stdout) {
      console.error(result.stdout);
    }
    process.exit(result.status ?? 1);
  }
}

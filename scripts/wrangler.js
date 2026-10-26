import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Run the project's own wrangler through node, so it works without a global
// install and on Windows, where spawning `wrangler` directly fails.
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('wrangler/package.json');
const wranglerBin = path.join(path.dirname(packageJsonPath), require(packageJsonPath).bin.wrangler);

export function runWrangler(args) {
  console.log(`wrangler ${args.join(' ')}`);
  exitOnFailure(spawnWrangler(args, { stdio: 'inherit' }));
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
  return spawnSync(process.execPath, [wranglerBin, ...args], { cwd: process.cwd(), ...options });
}

function exitOnFailure(result) {
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

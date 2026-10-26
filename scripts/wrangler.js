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
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  if (result.error) {
    console.error(`Could not run wrangler: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

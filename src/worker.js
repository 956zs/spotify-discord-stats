import process from 'node:process';
import { appConfig } from './config.js';
import { syncOnce } from './sync.js';

const once = process.argv.includes('--once');

async function run() {
  const result = await syncOnce();
  console.log(JSON.stringify(result, null, 2));
}

if (once) {
  await run();
} else {
  const intervalSeconds = appConfig.syncIntervalSeconds;
  await run();
  setInterval(() => {
    run().catch((error) => console.error(error));
  }, intervalSeconds * 1000);
}

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const DEFAULT_DB_NAME = 'spotify-discord-stats';
const DEFAULT_OUTPUT_DIR = 'backups/d1';

const options = parseArgs(process.argv.slice(2));
const outputPath = options.output ?? defaultOutputPath(options);

fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });

console.warn('D1 export may include app_state values. Treat the backup as secret data.');
runWranglerExport(outputPath);
fs.chmodSync(outputPath, 0o600);
console.log(`Backup written to ${outputPath}`);

function runWranglerExport(outputPath) {
  const args = ['d1', 'export', options.dbName, options.remote ? '--remote' : '--local', '--output', outputPath];
  if (options.noSchema) {
    args.push('--no-schema');
  }
  if (options.noData) {
    args.push('--no-data');
  }
  for (const table of options.tables) {
    args.push('--table', table);
  }

  const result = spawnSync('wrangler', args, { stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function defaultOutputPath(options) {
  const mode = options.remote ? 'remote' : 'local';
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  return path.join(DEFAULT_OUTPUT_DIR, `${options.dbName}-${mode}-${timestamp}.sql`);
}

function parseArgs(args) {
  const parsed = {
    dbName: DEFAULT_DB_NAME,
    remote: false,
    output: null,
    noSchema: false,
    noData: false,
    tables: []
  };

  for (let index = 0; index < args.length; index += 1) {
    readArg(parsed, args, index);
    if (argTakesValue(args[index])) {
      index += 1;
    }
  }

  return parsed;
}

function readArg(parsed, args, index) {
  const arg = args[index];
  if (arg === '--db') {
    parsed.dbName = requiredValue(args, index);
  } else if (arg === '--remote') {
    parsed.remote = true;
  } else if (arg === '--local') {
    parsed.remote = false;
  } else if (arg === '--output') {
    parsed.output = requiredValue(args, index);
  } else if (arg === '--no-schema') {
    parsed.noSchema = true;
  } else if (arg === '--no-data') {
    parsed.noData = true;
  } else if (arg === '--table') {
    parsed.tables.push(requiredValue(args, index));
  } else {
    throw new Error(`Unknown option: ${arg}`);
  }
}

function argTakesValue(arg) {
  return ['--db', '--output', '--table'].includes(arg);
}

function requiredValue(args, index) {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${args[index]} requires a value`);
  }
  return value;
}

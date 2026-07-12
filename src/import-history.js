import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { exportRowToPlayRecords } from '../shared/play-records.js';
import { upsertExportPlay } from './db.js';

const options = parseArgs(process.argv.slice(2));
if (options.targets.length === 0) {
  usage();
  process.exit(1);
}

let files = [];
for (const target of options.targets) {
  files = files.concat(findJsonFiles(path.resolve(target)));
}

let seen = 0;
let inserted = 0;
for (const file of files) {
  const json = parseJson(file);
  if (!json) {
    continue;
  }
  const rows = Array.isArray(json) ? json : [];
  for (const row of rows) {
    seen += 1;
    if (!isImportable(row)) {
      continue;
    }
    if (upsertExportPlay(row)) {
      inserted += 1;
    }
  }
  console.log(`Imported ${file}: ${rows.length} rows`);
}

console.log(`Done. Seen ${seen}, inserted ${inserted}.`);

function findJsonFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return target.endsWith('.json') ? [target] : [];
  }

  const results = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.log(`Skipping invalid JSON: ${file} (${error.message})`);
    return null;
  }
}

function isImportable(row) {
  const records = exportRowToPlayRecords(row);
  if (!records) {
    return false;
  }
  return isWithinImportRange(records.play.playedAt);
}

function parseArgs(args) {
  const parsed = { after: null, before: null, targets: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--after') {
      parsed.after = parseBoundary('--after', args[++index]);
    } else if (arg === '--before') {
      parsed.before = parseBoundary('--before', args[++index]);
    } else {
      parsed.targets.push(arg);
    }
  }
  return parsed;
}

function parseBoundary(name, value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date or ISO timestamp`);
  }
  return date.toISOString();
}

function isWithinImportRange(playedAt) {
  return (!options.after || playedAt >= options.after) && (!options.before || playedAt < options.before);
}

function usage() {
  console.error(`Usage:
  npm run spotify:import -- [--after ISO_DATE] [--before ISO_DATE] /path/to/json-or-directory`);
}

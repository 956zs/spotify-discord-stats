import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { upsertExportPlay } from './db.js';

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: npm run spotify:import -- /path/to/json-or-directory');
  process.exit(1);
}

let files = [];
for (const target of targets) {
  files = files.concat(findJsonFiles(path.resolve(target)));
}

let seen = 0;
let inserted = 0;
for (const file of files) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(json) ? json : [];
  for (const row of rows) {
    seen += 1;
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

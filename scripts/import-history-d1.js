import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { exportRowToPlayRecords } from '../shared/play-records.js';

const CHUNK_INDEX_PAD_WIDTH = 4;
const DEFAULT_BATCH_SIZE = 200;
const STATEMENTS_PER_EXPORT_ROW = 3;

const options = parseArgs(process.argv.slice(2));
if (options.targets.length === 0) {
  usage();
  process.exit(1);
}

const jsonFiles = options.targets.flatMap((target) => findJsonFiles(path.resolve(target)));
if (jsonFiles.length === 0) {
  console.error('No JSON files found.');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spotify-d1-import-'));
let seen = 0;
let skipped = 0;
let statements = [];
let chunkIndex = 0;
const importStartedAt = new Date().toISOString();

console.log(`Import started at ${importStartedAt}`);

for (const file of jsonFiles) {
  const rows = parseJsonRows(file);
  if (!rows) {
    continue;
  }
  if (!Array.isArray(rows)) {
    console.log(`Skipping non-array JSON: ${file}`);
    continue;
  }

  for (const row of rows) {
    seen += 1;
    const rowStatements = exportRowToSql(row);
    if (rowStatements.length === 0) {
      skipped += 1;
      continue;
    }

    statements.push(...rowStatements);
    if (statements.length >= options.batchSize * STATEMENTS_PER_EXPORT_ROW) {
      executeChunk();
    }
  }

  console.log(`Read ${file}: ${rows.length} rows`);
}

if (statements.length > 0) {
  executeChunk();
}

console.log(`Done. Seen ${seen}, skipped ${skipped}, chunks ${chunkIndex}.`);
console.log(`SQL chunks kept in ${tempDir}`);
console.log(`Import rollback marker: ${importStartedAt}`);
console.log('Rollback only this import with the SQL in docs/backup-rollback-and-import.md.');

function executeChunk() {
  chunkIndex += 1;
  const filePath = path.join(
    tempDir,
    `chunk-${String(chunkIndex).padStart(CHUNK_INDEX_PAD_WIDTH, '0')}.sql`
  );
  fs.writeFileSync(filePath, `BEGIN TRANSACTION;\n${statements.join('\n')}\nCOMMIT;\n`);
  statements = [];

  if (options.dryRun) {
    console.log(`Wrote ${filePath}`);
    return;
  }

  const args = ['d1', 'execute', options.dbName, options.remote ? '--remote' : '--local', '--file', filePath];
  console.log(`wrangler ${args.join(' ')}`);
  const result = spawnSync('wrangler', args, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function exportRowToSql(row) {
  const records = exportRowToPlayRecords(row);
  if (!records) {
    return [];
  }
  if (!isWithinImportRange(records.play.playedAt)) {
    return [];
  }

  return [
    playToSql(records.play, importStartedAt),
    ...records.artists.map(artistToSql)
  ];
}

function playToSql(play, createdAt) {
  return `INSERT INTO plays (
  played_at, played_at_ms, track_key, track_id, track_uri, track_name,
  album_key, album_id, album_uri, album_name, album_image_url, duration_ms,
  ms_played, source, created_at
)
VALUES (
  ${sqlString(play.playedAt)}, ${play.playedAtMs}, ${sqlString(play.trackKey)}, ${sqlString(play.trackId)}, ${sqlString(play.trackUri)}, ${sqlString(play.trackName)},
  ${sqlString(play.albumKey)}, ${sqlString(play.albumId)}, ${sqlString(play.albumUri)}, ${sqlString(play.albumName)}, ${sqlString(play.albumImageUrl)}, ${sqlNumber(play.durationMs)}, ${sqlNumber(play.msPlayed)},
  'spotify_export', ${sqlString(createdAt)}
)
ON CONFLICT(played_at, track_key) DO UPDATE SET
  track_id = COALESCE(plays.track_id, excluded.track_id),
  track_uri = COALESCE(plays.track_uri, excluded.track_uri),
  track_name = COALESCE(excluded.track_name, plays.track_name),
  album_key = COALESCE(plays.album_key, excluded.album_key),
  album_name = COALESCE(plays.album_name, excluded.album_name),
  album_image_url = COALESCE(plays.album_image_url, excluded.album_image_url),
  ms_played = COALESCE(excluded.ms_played, plays.ms_played);`;
}

function artistToSql(artist) {
  return [
    `INSERT OR IGNORE INTO play_artists (
  played_at, track_key, artist_key, artist_id, artist_uri, artist_name
)
SELECT
  ${sqlString(artist.playedAt)}, ${sqlString(artist.trackKey)}, ${sqlString(artist.artistKey)}, ${sqlString(artist.artistId)}, ${sqlString(artist.artistUri)}, ${sqlString(artist.artistName)}
WHERE NOT EXISTS (
  SELECT 1 FROM play_artists
  WHERE played_at = ${sqlString(artist.playedAt)}
    AND track_key = ${sqlString(artist.trackKey)}
);`,
    `INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
VALUES (${sqlString(artist.artistKey)}, ${sqlString(artist.artistId)}, ${sqlString(artist.artistUri)}, ${sqlString(artist.artistName)})
ON CONFLICT(artist_key) DO UPDATE SET
  artist_name = excluded.artist_name;`
  ].join('\n');
}

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

function parseArgs(args) {
  const parsed = {
    dbName: 'spotify-discord-stats',
    remote: false,
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    after: null,
    before: null,
    targets: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--db') {
      parsed.dbName = args[++index];
    } else if (arg === '--remote') {
      parsed.remote = true;
    } else if (arg === '--local') {
      parsed.remote = false;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--batch-size') {
      parsed.batchSize = Number.parseInt(args[++index], 10);
    } else if (arg === '--after') {
      parsed.after = parseBoundary('--after', args[++index]);
    } else if (arg === '--before') {
      parsed.before = parseBoundary('--before', args[++index]);
    } else {
      parsed.targets.push(arg);
    }
  }

  if (!Number.isFinite(parsed.batchSize) || parsed.batchSize <= 0) {
    throw new Error('--batch-size must be a positive number');
  }

  return parsed;
}

function parseJsonRows(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.log(`Skipping invalid JSON: ${file} (${error.message})`);
    return null;
  }
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

function sqlString(value) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.trunc(number)) : 'NULL';
}

function usage() {
  console.error(`Usage:
  npm run cf:import -- [--local|--remote] [--db spotify-discord-stats] /path/to/export

Examples:
  npm run cf:import -- --local ~/Downloads/SpotifyData
  npm run cf:import -- --remote ~/Downloads/SpotifyData
  npm run cf:import -- --remote --before 2026-07-05T00:00:00Z ~/Downloads/SpotifyData
  npm run cf:import -- --dry-run ~/Downloads/SpotifyData`);
}

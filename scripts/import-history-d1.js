import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

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

for (const file of jsonFiles) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
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
    if (statements.length >= options.batchSize * 3) {
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

function executeChunk() {
  chunkIndex += 1;
  const filePath = path.join(tempDir, `chunk-${String(chunkIndex).padStart(4, '0')}.sql`);
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
  const playedAt = parseExportPlayedAt(row);
  const trackName = row.master_metadata_track_name ?? row.trackName ?? row.track_name ?? null;
  const artistName =
    row.master_metadata_album_artist_name ?? row.artistName ?? row.artist_name ?? null;

  if (!playedAt || !trackName || !artistName) {
    return [];
  }

  const playedAtMs = Date.parse(playedAt);
  if (Number.isNaN(playedAtMs)) {
    return [];
  }

  const albumName =
    row.master_metadata_album_album_name ?? row.albumName ?? row.album_name ?? null;
  const trackUri = row.spotify_track_uri ?? row.spotifyTrackUri ?? row.track_uri ?? null;
  const trackId = spotifyIdFromUri(trackUri);
  const trackKey = trackId || trackUri || fallbackKey('track', trackName, artistName, albumName);
  const albumKey = albumName ? fallbackKey('album', albumName, artistName) : null;
  const artistKey = fallbackKey('artist', artistName);
  const msPlayed = row.ms_played ?? row.msPlayed ?? null;
  const createdAt = new Date().toISOString();

  return [
    `INSERT INTO plays (
  played_at, played_at_ms, track_key, track_id, track_uri, track_name,
  album_key, album_id, album_uri, album_name, duration_ms, ms_played,
  source, created_at
)
VALUES (
  ${sqlString(playedAt)}, ${playedAtMs}, ${sqlString(trackKey)}, ${sqlString(trackId)}, ${sqlString(trackUri)}, ${sqlString(trackName)},
  ${sqlString(albumKey)}, NULL, NULL, ${sqlString(albumName)}, NULL, ${sqlNumber(msPlayed)},
  'spotify_export', ${sqlString(createdAt)}
)
ON CONFLICT(played_at, track_key) DO UPDATE SET
  track_id = COALESCE(plays.track_id, excluded.track_id),
  track_uri = COALESCE(plays.track_uri, excluded.track_uri),
  track_name = COALESCE(excluded.track_name, plays.track_name),
  album_key = COALESCE(plays.album_key, excluded.album_key),
  album_name = COALESCE(plays.album_name, excluded.album_name),
  ms_played = COALESCE(excluded.ms_played, plays.ms_played);`,
    `INSERT OR IGNORE INTO play_artists (
  played_at, track_key, artist_key, artist_id, artist_uri, artist_name
)
SELECT
  ${sqlString(playedAt)}, ${sqlString(trackKey)}, ${sqlString(artistKey)}, NULL, NULL, ${sqlString(artistName)}
WHERE NOT EXISTS (
  SELECT 1 FROM play_artists
  WHERE played_at = ${sqlString(playedAt)}
    AND track_key = ${sqlString(trackKey)}
);`,
    `INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
VALUES (${sqlString(artistKey)}, NULL, NULL, ${sqlString(artistName)})
ON CONFLICT(artist_key) DO UPDATE SET
  artist_name = excluded.artist_name;`
  ];
}

function parseExportPlayedAt(row) {
  if (row.ts) {
    return new Date(row.ts).toISOString();
  }

  if (row.endTime) {
    const normalized = String(row.endTime).replace(' ', 'T');
    return new Date(`${normalized}Z`).toISOString();
  }

  if (row.played_at) {
    return new Date(row.played_at).toISOString();
  }

  return null;
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
    batchSize: 200,
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
    } else {
      parsed.targets.push(arg);
    }
  }

  if (!Number.isFinite(parsed.batchSize) || parsed.batchSize <= 0) {
    throw new Error('--batch-size must be a positive number');
  }

  return parsed;
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

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fallbackKey(prefix, ...parts) {
  return `${prefix}:${parts.map(normalizeKey).join('|')}`;
}

function spotifyIdFromUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  const parts = uri.split(':');
  if (parts.length !== 3 || parts[0] !== 'spotify') {
    return null;
  }

  return parts[2] || null;
}

function usage() {
  console.error(`Usage:
  npm run cf:import -- [--local|--remote] [--db spotify-discord-stats] /path/to/export

Examples:
  npm run cf:import -- --local ~/Downloads/SpotifyData
  npm run cf:import -- --remote ~/Downloads/SpotifyData
  npm run cf:import -- --dry-run ~/Downloads/SpotifyData`);
}

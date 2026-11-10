import { runMetricQueries } from '../../shared/widget-metrics-query.js';

// Incrementally maintained widget stats (migration 0006).
//
// Every widget range keeps a "window" in D1: per-key play counts (stat_counts) for the
// plays with played_at >= since, plus running totals (stat_windows). A sync then only
// reads the plays that entered the window (rowid past the stored cursor) and the ones
// that left it (played_at between the old and the new window start), instead of
// rescanning the whole window. Results are the same as runMetricQueries(); the tests
// in test/stat-windows.test.js compare both on random histories.
//
// Rows are picked up by rowid, so late or imported plays with an older played_at are
// still counted. Anything that rewrites already counted rows (an import updating
// existing plays, a rollback deleting plays) must call invalidateStatWindows(); rowid
// renumbering is caught by the cursor id check.

const LOCAL_TIME = "'+8 hours'";
const LATE_NIGHT_END_KEY = '05';
const MAX_DELTA_ROWS = 10000;
const MAX_ATTEMPTS = 4;

// Kinds each materialized query needs. Queries not listed here (newSongs, newArtists,
// firstPlay) still run directly against plays.
const QUERY_KINDS = {
  summary: ['track', 'album'],
  artistCount: ['artist'],
  topTrack: ['track'],
  topArtist: ['artist'],
  topAlbum: ['album'],
  peakHour: ['hour'],
  peakWeekday: ['weekday'],
  listeningDays: ['date'],
  busiestDay: ['date'],
  lateNight: ['hour']
};

// Kinds whose distinct keys are kept as totals (unique songs, albums, artists).
const DISTINCT_TOTALS = { track: 'tracks', album: 'albums', artist: 'artists' };

const PLAY_KINDS = ['track', 'album', 'hour', 'weekday', 'date'];

// Window rows of plays with the grouping values computed by SQLite itself, so local
// dates and hours match the direct queries exactly.
const PLAY_COLUMNS = `
  track_key, track_name,
  COALESCE(album_key, album_name) AS album_group,
  COALESCE(album_name, '') AS album_name,
  COALESCE(ms_played, duration_ms, 0) AS ms,
  COALESCE(strftime('%H', played_at, ${LOCAL_TIME}), '') AS hour_key,
  COALESCE(strftime('%w', played_at, ${LOCAL_TIME}), '') AS weekday_key,
  COALESCE(date(played_at, ${LOCAL_TIME}), '') AS date_key`;

// INSERT ... SELECT statements that count one kind over the window. Bindings: ?1 range,
// ?2 since, ?3 plays cursor, ?4 play_artists cursor, and ?5 the window token when
// `guarded` (the rows are then only written if that token still holds).
function buildSql(kind, guarded = false) {
  const guard = guarded ? ' AND EXISTS (SELECT 1 FROM stat_windows WHERE range_key = ?1 AND token = ?5)' : '';
  const window = `played_at >= ?2 AND rowid <= ?3${guard}`;
  switch (kind) {
    case 'track':
      return `
        INSERT INTO stat_counts (range_key, kind, key, name, plays, ms)
        SELECT ?1, 'track', track_key, track_name, COUNT(*), COALESCE(SUM(COALESCE(ms_played, duration_ms, 0)), 0)
        FROM plays WHERE ${window}
        GROUP BY track_key, track_name`;
    case 'album':
      return `
        INSERT INTO stat_counts (range_key, kind, key, name, plays, ms)
        SELECT ?1, 'album', COALESCE(album_key, album_name), COALESCE(album_name, ''), COUNT(*), 0
        FROM plays WHERE ${window} AND COALESCE(album_key, album_name) IS NOT NULL
        GROUP BY COALESCE(album_key, album_name), COALESCE(album_name, '')`;
    case 'artist':
      return `
        INSERT INTO stat_counts (range_key, kind, key, name, plays, ms)
        SELECT ?1, 'artist', artist_key, artist_name, COUNT(*), 0
        FROM play_artists WHERE played_at >= ?2 AND rowid <= ?4${guard}
        GROUP BY artist_key, artist_name`;
    default:
      return `
        INSERT INTO stat_counts (range_key, kind, key, name, plays, ms)
        SELECT ?1, '${kind}', k, k, COUNT(*), 0
        FROM (SELECT ${GROUP_EXPRESSIONS[kind]} AS k FROM plays WHERE ${window})
        GROUP BY k`;
  }
}

const GROUP_EXPRESSIONS = {
  hour: `COALESCE(strftime('%H', played_at, ${LOCAL_TIME}), '')`,
  weekday: `COALESCE(strftime('%w', played_at, ${LOCAL_TIME}), '')`,
  date: `COALESCE(date(played_at, ${LOCAL_TIME}), '')`
};

const PLAY_CURSOR_ID = "(SELECT played_at || '|' || track_key FROM plays WHERE rowid = ?)";
const ARTIST_CURSOR_ID =
  "(SELECT played_at || '|' || track_key || '|' || artist_key FROM play_artists WHERE rowid = ?)";

// Same top-N order as the direct GROUP BY queries; idx_stat_counts_rank serves it.
const RANK_ORDER = 'ORDER BY plays DESC, ms DESC, name COLLATE NOCASE ASC, key ASC LIMIT 1';

export function queryKinds(queryIds) {
  const kinds = new Set(['track']);
  for (const id of queryIds) {
    for (const kind of QUERY_KINDS[id] ?? []) {
      kinds.add(kind);
    }
  }
  return [...kinds].sort();
}

// Same result shape as runMetricQueries(db, since, queryIds), served from the range's
// window. With `allowBuild: false` (admin previews of unsaved settings) a range without
// a usable window runs the direct queries instead of building one. Also falls back to
// the direct queries if concurrent updates keep winning.
export async function loadWindowResults(db, rangeKey, since, queryIds, options = {}) {
  const request = { rangeKey, since, queryIds, kinds: queryKinds(queryIds), allowBuild: options.allowBuild ?? true };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const results = await syncWindow(db, request);
    if (results === NO_WINDOW) {
      break;
    }
    if (results) {
      return results;
    }
  }
  return runMetricQueries(db, since, queryIds);
}

const NO_WINDOW = Symbol('no window');

// Forces every window to be rebuilt and drops the cached widget results.
export async function invalidateStatWindows(db) {
  await db.batch([
    db.prepare('DELETE FROM stat_windows'),
    db.prepare("DELETE FROM app_state WHERE key LIKE 'widget_metrics_cache:%'")
  ]);
}

// Drops the windows of ranges the widget no longer uses.
export async function pruneStatWindows(db, keepRangeKeys) {
  const rows = (await db.prepare('SELECT range_key FROM stat_windows').all()).results ?? [];
  const stale = rows.map((row) => row.range_key).filter((key) => !keepRangeKeys.includes(key));
  if (stale.length === 0) {
    return [];
  }
  await db.batch(stale.flatMap((key) => [
    db.prepare('DELETE FROM stat_counts WHERE range_key = ?').bind(key),
    db.prepare('DELETE FROM stat_windows WHERE range_key = ?').bind(key)
  ]));
  return stale;
}

// Brings the window up to date and reads the results in the same batch. Returns null
// if another request updated the window at the same time (the caller retries).
async function syncWindow(db, request) {
  const { rangeKey, since, kinds } = request;
  const [stateResult, playMaxResult, artistMaxResult, playIdResult, artistIdResult] = await db.batch([
    db.prepare('SELECT * FROM stat_windows WHERE range_key = ?').bind(rangeKey),
    db.prepare('SELECT COALESCE(MAX(rowid), 0) AS cursor FROM plays'),
    db.prepare('SELECT COALESCE(MAX(rowid), 0) AS cursor FROM play_artists'),
    db.prepare(`SELECT played_at || '|' || track_key AS id FROM plays
      WHERE rowid = (SELECT play_cursor FROM stat_windows WHERE range_key = ?)`).bind(rangeKey),
    db.prepare(`SELECT played_at || '|' || track_key || '|' || artist_key AS id FROM play_artists
      WHERE rowid = (SELECT artist_cursor FROM stat_windows WHERE range_key = ?)`).bind(rangeKey)
  ]);

  const state = stateResult.results?.[0] ?? null;
  const target = {
    since,
    playCursor: Number(playMaxResult.results[0].cursor),
    artistCursor: Number(artistMaxResult.results[0].cursor)
  };

  if (!state || !isConsistent(state, target, {
    playId: playIdResult.results?.[0]?.id ?? null,
    artistId: artistIdResult.results?.[0]?.id ?? null
  })) {
    return request.allowBuild ? buildWindow(db, request, target, mergeKinds(state, kinds)) : NO_WINDOW;
  }

  const window = parseState(state);
  const missing = kinds.filter((kind) => !window.kinds.includes(kind));
  if (missing.length > 0) {
    return request.allowBuild ? addKinds(db, rangeKey, window, missing) : NO_WINDOW;
  }
  if (window.since === since && window.playCursor === target.playCursor
    && window.artistCursor === target.artistCursor) {
    return runWithResults(db, request, [], window.totals);
  }
  return updateWindow(db, request, window, target);
}

// Whether the stored counts can be moved forward to `target` (otherwise rebuild).
function isConsistent(state, target, ids) {
  if (target.since < state.since) {
    return false;
  }
  if (target.playCursor < state.play_cursor || target.artistCursor < state.artist_cursor) {
    return false;
  }
  // Rowids that now point at other rows mean the tables were rewritten.
  if (state.play_cursor > 0 && ids.playId !== state.play_cursor_id) {
    return false;
  }
  if (state.artist_cursor > 0 && ids.artistId !== state.artist_cursor_id) {
    return false;
  }
  return true;
}

function mergeKinds(state, kinds) {
  const merged = new Set(kinds);
  for (const kind of state?.kinds?.split(',') ?? []) {
    if (kind) {
      merged.add(kind);
    }
  }
  return [...merged].sort();
}

function parseState(state) {
  return {
    since: state.since,
    kinds: state.kinds.split(','),
    playCursor: Number(state.play_cursor),
    artistCursor: Number(state.artist_cursor),
    totals: JSON.parse(state.totals),
    token: state.token
  };
}

async function buildWindow(db, request, target, kinds) {
  const { rangeKey } = request;
  const token = crypto.randomUUID();
  const bindings = [rangeKey, target.since, target.playCursor, target.artistCursor];
  const statements = [db.prepare('DELETE FROM stat_counts WHERE range_key = ?').bind(rangeKey)];
  for (const kind of kinds) {
    // Each build statement uses only some of ?1..?4; bind the ones it names.
    const sql = buildSql(kind);
    statements.push(db.prepare(sql).bind(...bindingsFor(sql, bindings)));
  }
  statements.push(
    db.prepare(`
      INSERT OR REPLACE INTO stat_windows (
        range_key, since, kinds, play_cursor, play_cursor_id, artist_cursor, artist_cursor_id, totals, token
      )
      SELECT ?1, ?2, ?3, ?4, ${PLAY_CURSOR_ID.replace('?', '?4')}, ?5, ${ARTIST_CURSOR_ID.replace('?', '?5')},
        json_object(
          'plays', (SELECT COALESCE(SUM(plays), 0) FROM stat_counts WHERE range_key = ?1 AND kind = 'track'),
          'ms', (SELECT COALESCE(SUM(ms), 0) FROM stat_counts WHERE range_key = ?1 AND kind = 'track'),
          'tracks', (SELECT COUNT(DISTINCT key) FROM stat_counts WHERE range_key = ?1 AND kind = 'track'),
          'albums', (SELECT COUNT(DISTINCT key) FROM stat_counts WHERE range_key = ?1 AND kind = 'album'),
          'artists', (SELECT COUNT(DISTINCT key) FROM stat_counts WHERE range_key = ?1 AND kind = 'artist')
        ),
        ?6
    `).bind(rangeKey, target.since, kinds.join(','), target.playCursor, target.artistCursor, token)
  );
  return runWithResults(db, request, statements, null);
}

// Counts kinds a window does not track yet (the slots now use more metrics) at the
// window's current position, so only those kinds are read and written instead of
// rebuilding the whole window. Returns null: the caller retries and then updates the
// window as usual.
async function addKinds(db, rangeKey, window, missing) {
  const token = crypto.randomUUID();
  const kinds = [...new Set([...window.kinds, ...missing])].sort();
  const bindings = [rangeKey, window.since, window.playCursor, window.artistCursor, token];
  const statements = [
    db.prepare('UPDATE stat_windows SET kinds = ?, token = ? WHERE range_key = ? AND token = ?')
      .bind(kinds.join(','), token, rangeKey, window.token)
  ];
  const totalPaths = [];
  for (const kind of missing) {
    const sql = buildSql(kind, true);
    statements.push(
      db.prepare(`DELETE FROM stat_counts WHERE range_key = ?1 AND kind = ?2
        AND EXISTS (SELECT 1 FROM stat_windows WHERE range_key = ?1 AND token = ?3)`).bind(rangeKey, kind, token),
      db.prepare(sql).bind(...bindingsFor(sql, bindings))
    );
    if (DISTINCT_TOTALS[kind]) {
      totalPaths.push(`'$.${DISTINCT_TOTALS[kind]}',
        (SELECT COUNT(DISTINCT key) FROM stat_counts WHERE range_key = ?1 AND kind = '${kind}')`);
    }
  }
  if (totalPaths.length > 0) {
    statements.push(db.prepare(`UPDATE stat_windows SET totals = json_set(totals, ${totalPaths.join(', ')})
      WHERE range_key = ?1 AND token = ?2`).bind(rangeKey, token));
  }
  await db.batch(statements);
  return null;
}

function bindingsFor(sql, bindings) {
  const highest = Math.max(...[...sql.matchAll(/\?(\d)/g)].map((match) => Number(match[1])));
  return bindings.slice(0, highest);
}

async function updateWindow(db, request, window, target) {
  const { rangeKey } = request;
  const kinds = window.kinds;
  const needsArtists = kinds.includes('artist');
  const reads = [];
  const leaving = target.since > window.since;
  const entering = target.playCursor > window.playCursor;
  const artistsEntering = needsArtists && target.artistCursor > window.artistCursor;

  if (leaving) {
    reads.push(['play', -1, db.prepare(`SELECT ${PLAY_COLUMNS} FROM plays
      WHERE played_at >= ? AND played_at < ? AND rowid <= ?`).bind(window.since, target.since, window.playCursor)]);
  }
  if (entering) {
    reads.push(['play', 1, db.prepare(`SELECT ${PLAY_COLUMNS} FROM plays
      WHERE rowid > ? AND rowid <= ? AND played_at >= ?`).bind(window.playCursor, target.playCursor, target.since)]);
  }
  if (needsArtists && leaving) {
    reads.push(['artist', -1, db.prepare(`SELECT artist_key, artist_name FROM play_artists
      WHERE played_at >= ? AND played_at < ? AND rowid <= ?`).bind(window.since, target.since, window.artistCursor)]);
  }
  if (artistsEntering) {
    reads.push(['artist', 1, db.prepare(`SELECT artist_key, artist_name FROM play_artists
      WHERE rowid > ? AND rowid <= ? AND played_at >= ?`).bind(window.artistCursor, target.artistCursor, target.since)]);
  }

  const deltas = new Map();
  const totals = { ...window.totals };
  let deltaRows = 0;
  if (reads.length > 0) {
    const results = await db.batch(reads.map(([, , statement]) => statement));
    results.forEach((result, index) => {
      const [source, sign] = reads[index];
      for (const row of result.results ?? []) {
        deltaRows += 1;
        if (source === 'play') {
          totals.plays += sign;
          totals.ms += sign * Number(row.ms);
          for (const group of playGroups(row, kinds)) {
            addDelta(deltas, group, sign);
          }
        } else {
          addDelta(deltas, { kind: 'artist', key: row.artist_key, name: row.artist_name, ms: 0 }, sign);
        }
      }
    });
  }
  if (deltaRows > MAX_DELTA_ROWS) {
    return buildWindow(db, request, target, kinds);
  }

  const changes = await applyDeltas(db, rangeKey, deltas, totals);
  if (!changes) {
    // Counts went negative: the window no longer matches plays. Start over.
    return buildWindow(db, request, target, kinds);
  }

  const token = crypto.randomUUID();
  const guard = 'EXISTS (SELECT 1 FROM stat_windows WHERE range_key = ? AND token = ?)';
  const statements = [
    db.prepare(`
      UPDATE stat_windows
      SET since = ?, play_cursor = ?, play_cursor_id = ${PLAY_CURSOR_ID},
        artist_cursor = ?, artist_cursor_id = ${ARTIST_CURSOR_ID}, totals = ?, token = ?
      WHERE range_key = ? AND token = ?
    `).bind(
      target.since, target.playCursor, target.playCursor, target.artistCursor, target.artistCursor,
      JSON.stringify(totals), token, rangeKey, window.token
    )
  ];
  for (const row of changes) {
    statements.push(row.plays > 0
      ? db.prepare(`
          INSERT INTO stat_counts (range_key, kind, key, name, plays, ms)
          SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}
          ON CONFLICT (range_key, kind, key, name) DO UPDATE SET plays = excluded.plays, ms = excluded.ms
        `).bind(rangeKey, row.kind, row.key, row.name, row.plays, row.ms, rangeKey, token)
      : db.prepare(`
          DELETE FROM stat_counts WHERE range_key = ? AND kind = ? AND key = ? AND name = ? AND ${guard}
        `).bind(rangeKey, row.kind, row.key, row.name, rangeKey, token));
  }

  return runWithResults(db, request, statements, totals, (results) => Number(results[0].meta?.changes ?? 0) === 1);
}

function playGroups(row, kinds) {
  const groups = [];
  if (kinds.includes('track')) {
    groups.push({ kind: 'track', key: row.track_key, name: row.track_name, ms: Number(row.ms) });
  }
  if (kinds.includes('album') && row.album_group !== null) {
    groups.push({ kind: 'album', key: row.album_group, name: row.album_name, ms: 0 });
  }
  for (const kind of ['hour', 'weekday', 'date']) {
    if (kinds.includes(kind)) {
      const key = row[`${kind}_key`];
      groups.push({ kind, key, name: key, ms: 0 });
    }
  }
  return groups;
}

function addDelta(deltas, group, sign) {
  const id = groupId(group);
  const delta = deltas.get(id) ?? { kind: group.kind, key: group.key, name: group.name, plays: 0, ms: 0 };
  delta.plays += sign;
  delta.ms += sign * group.ms;
  deltas.set(id, delta);
}

function groupId(group) {
  return JSON.stringify([group.kind, group.key, group.name]);
}

// Reads the current counts of every touched key (all of its names, so distinct key
// totals stay right), applies the deltas and updates `totals` in place. Returns the
// rows to write, or null if a count would go negative.
async function applyDeltas(db, rangeKey, deltas, totals) {
  const touched = [...deltas.values()].filter((delta) => delta.plays !== 0 || delta.ms !== 0);
  if (touched.length === 0) {
    return [];
  }

  const entities = new Map();
  for (const delta of touched) {
    entities.set(JSON.stringify([delta.kind, delta.key]), [delta.kind, delta.key]);
  }
  const current = (await db.prepare(`
    SELECT kind, key, name, plays, ms FROM stat_counts
    WHERE range_key = ?
      AND (kind, key) IN (SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?))
  `).bind(rangeKey, JSON.stringify([...entities.values()])).all()).results ?? [];

  const rows = new Map(current.map((row) => [groupId(row), { ...row, plays: Number(row.plays), ms: Number(row.ms) }]));
  const presentBefore = presentEntities(rows.values());

  const changes = [];
  for (const delta of touched) {
    const id = groupId(delta);
    const row = rows.get(id) ?? { kind: delta.kind, key: delta.key, name: delta.name, plays: 0, ms: 0 };
    row.plays += delta.plays;
    row.ms += delta.ms;
    if (row.plays < 0 || (row.plays === 0 && row.ms !== 0)) {
      return null;
    }
    rows.set(id, row);
    changes.push(row);
  }

  const presentAfter = presentEntities(rows.values());
  for (const [kind, total] of Object.entries(DISTINCT_TOTALS)) {
    totals[total] += (presentAfter.get(kind)?.size ?? 0) - (presentBefore.get(kind)?.size ?? 0);
  }
  return changes;
}

function presentEntities(rows) {
  const present = new Map();
  for (const row of rows) {
    if (row.plays > 0) {
      if (!present.has(row.kind)) {
        present.set(row.kind, new Set());
      }
      present.get(row.kind).add(row.key);
    }
  }
  return present;
}

// Runs `statements` (a window build or update) and the result reads as one batch, so
// the reads see exactly that window. `totals` is null after a build: the batch then
// reads them back. `committed(results)` says whether the update won its guard.
async function runWithResults(db, request, statements, totals, committed = () => true) {
  const { rangeKey, since, queryIds } = request;
  const reads = [];
  const direct = [];
  const top = (kind, extra = '') => db
    .prepare(`SELECT key, name, plays FROM stat_counts WHERE range_key = ? AND kind = ? ${extra} ${RANK_ORDER}`)
    .bind(rangeKey, kind);

  if (totals === null) {
    reads.push(['totals', db.prepare('SELECT totals FROM stat_windows WHERE range_key = ?').bind(rangeKey)]);
  }
  for (const id of queryIds) {
    switch (id) {
      case 'summary':
      case 'artistCount':
        break;
      case 'topTrack':
        reads.push([id, top('track')]);
        break;
      case 'topArtist':
        reads.push([id, top('artist')]);
        break;
      case 'topAlbum':
        reads.push([id, top('album', "AND TRIM(name) != ''")]);
        break;
      case 'peakHour':
        reads.push([id, top('hour')]);
        break;
      case 'peakWeekday':
        reads.push([id, top('weekday')]);
        break;
      case 'busiestDay':
        reads.push([id, top('date')]);
        break;
      case 'listeningDays':
        reads.push([id, db.prepare(`SELECT key FROM stat_counts WHERE range_key = ? AND kind = 'date'
          ORDER BY key ASC`).bind(rangeKey)]);
        break;
      case 'lateNight':
        reads.push([id, db.prepare(`SELECT COALESCE(SUM(plays), 0) AS plays FROM stat_counts
          WHERE range_key = ? AND kind = 'hour' AND key >= '00' AND key < ?`).bind(rangeKey, LATE_NIGHT_END_KEY)]);
        break;
      default:
        direct.push(id);
    }
  }

  const all = [...statements, ...reads.map(([, statement]) => statement)];
  const batch = all.length > 0 ? await db.batch(all) : [];
  if (!committed(batch)) {
    return null;
  }
  const rows = new Map(reads.map(([id], index) => [id, batch[statements.length + index].results ?? []]));
  const windowTotals = totals ?? JSON.parse(rows.get('totals')[0].totals);

  const results = {};
  for (const id of queryIds) {
    if (id === 'summary') {
      results.summary = {
        songsPlayed: windowTotals.plays,
        listeningMs: windowTotals.ms,
        uniqueSongs: windowTotals.tracks,
        differentAlbums: windowTotals.albums
      };
    } else if (id === 'artistCount') {
      results.artistCount = { differentArtists: windowTotals.artists };
    } else if (rows.has(id)) {
      results[id] = await mapResult(db, id, rows.get(id), since, windowTotals);
    }
  }
  if (direct.length > 0) {
    Object.assign(results, await runMetricQueries(db, since, direct));
  }
  // Same key order as runMetricQueries, so cached JSON stays comparable.
  return Object.fromEntries(queryIds.map((id) => [id, results[id]]));
}

async function mapResult(db, id, rows, since, totals) {
  const row = rows[0] ?? null;
  switch (id) {
    case 'topTrack': {
      if (!row) {
        return null;
      }
      const artists = (await db.prepare(`
        SELECT DISTINCT artist_name
        FROM play_artists
        WHERE track_key = ? AND played_at >= ?
        ORDER BY artist_name COLLATE NOCASE ASC
      `).bind(row.key, since).all()).results ?? [];
      return {
        name: row.name,
        artists: artists.map((artist) => artist.artist_name).join(', '),
        plays: Number(row.plays)
      };
    }
    case 'topArtist':
    case 'topAlbum':
      return row ? { name: row.name, plays: Number(row.plays) } : null;
    case 'peakHour':
      return row ? { hour: numericKey(row.key), plays: Number(row.plays) } : null;
    case 'peakWeekday':
      return row ? { weekday: numericKey(row.key), plays: Number(row.plays) } : null;
    case 'busiestDay':
      return row ? { date: row.key === '' ? null : row.key, plays: Number(row.plays) } : null;
    case 'listeningDays':
      return { dates: rows.map((date) => (date.key === '' ? null : date.key)) };
    case 'lateNight':
      return { plays: Number(row?.plays ?? 0), total: totals.plays };
    default:
      throw new Error(`unknown window query ${id}`);
  }
}

// '' stands for SQLite's NULL hour / weekday, which the direct queries report as 0.
function numericKey(key) {
  return key === '' ? 0 : Number(key);
}

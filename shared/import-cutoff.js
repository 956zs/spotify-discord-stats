// Plays synced from the Recently Played API store millisecond timestamps, while
// export rows are whole seconds, so the two never collide on (played_at, track_key).
// Importing only what was played before the first synced play avoids counting the
// overlap twice.
export const FIRST_SYNCED_PLAY_SQL =
  "SELECT MIN(played_at) AS first_synced FROM plays WHERE source = 'spotify_api'";

export function resolveImportCutoff(options = {}, firstSyncedAt = null) {
  if (options.before) {
    return { before: options.before, reason: 'flag' };
  }
  if (options.noCutoff) {
    return { before: null, reason: 'disabled' };
  }
  if (!firstSyncedAt) {
    return { before: null, reason: 'no_synced_plays' };
  }

  const date = new Date(firstSyncedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid first synced play time: ${firstSyncedAt}`);
  }
  return { before: date.toISOString(), reason: 'first_synced_play' };
}

export function describeImportCutoff(cutoff) {
  switch (cutoff.reason) {
    case 'flag':
      return `Importing plays before ${cutoff.before} (--before).`;
    case 'first_synced_play':
      return `Importing plays before ${cutoff.before}, the first play synced from Spotify. Pass --no-cutoff to import everything.`;
    case 'disabled':
      return 'Importing every play (--no-cutoff).';
    default:
      return 'No synced plays yet; importing every play.';
  }
}

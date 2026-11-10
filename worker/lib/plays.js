import { spotifyItemToPlayRecords } from '../../shared/play-records.js';
import { nowIso } from '../../shared/time.js';
import { invalidateStatWindows } from './stat-windows.js';

// Columns the widget stats count. If an upsert changes one of them on a play that is
// already stored, the incrementally maintained stat windows have to be rebuilt.
const COUNTED_COLUMNS = ['track_name', 'album_key', 'album_name', 'duration_ms', 'ms_played'];

// One D1 call per play: the existing row, the play upsert, and its artists run as one
// batch (a transaction), which keeps a sync of many plays under the Workers Free limit
// of 50 D1 calls per invocation and never leaves a play without its artists.
export async function upsertSpotifyPlay(db, item) {
  const records = spotifyItemToPlayRecords(item);
  if (!records) {
    return false;
  }

  const [existingResult, storedResult] = await db.batch([
    db.prepare(`SELECT ${COUNTED_COLUMNS.join(', ')} FROM plays WHERE played_at = ? AND track_key = ?`)
      .bind(records.play.playedAt, records.play.trackKey),
    upsertPlayStatement(db, records.play),
    ...records.artists.flatMap((artist) => upsertPlayArtistStatements(db, artist))
  ]);

  const existing = existingResult.results?.[0] ?? null;
  const stored = storedResult.results?.[0] ?? null;
  if (existing && COUNTED_COLUMNS.some((column) => existing[column] !== stored?.[column])) {
    await invalidateStatWindows(db);
  }
  return !existing;
}

function upsertPlayStatement(db, play) {
  return db
    .prepare(`
      INSERT INTO plays (
        played_at, played_at_ms, track_key, track_id, track_uri, track_name,
        album_key, album_id, album_uri, album_name, album_image_url,
        duration_ms, ms_played, source, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(played_at, track_key) DO UPDATE SET
        track_id = COALESCE(plays.track_id, excluded.track_id),
        track_uri = COALESCE(plays.track_uri, excluded.track_uri),
        track_name = COALESCE(excluded.track_name, plays.track_name),
        album_key = COALESCE(plays.album_key, excluded.album_key),
        album_id = COALESCE(plays.album_id, excluded.album_id),
        album_uri = COALESCE(plays.album_uri, excluded.album_uri),
        album_name = COALESCE(plays.album_name, excluded.album_name),
        album_image_url = COALESCE(plays.album_image_url, excluded.album_image_url),
        duration_ms = COALESCE(plays.duration_ms, excluded.duration_ms),
        ms_played = COALESCE(excluded.ms_played, plays.ms_played)
      RETURNING ${COUNTED_COLUMNS.join(', ')}
    `)
    .bind(...playBindings(play), nowIso());
}

// The artists upsert skips the write when nothing changes (D1 bills every updated row).
function upsertPlayArtistStatements(db, artist) {
  return [
    db
      .prepare(`
        INSERT OR IGNORE INTO play_artists (
          played_at, track_key, artist_key, artist_id, artist_uri, artist_name
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(...artistBindings(artist)),
    db
      .prepare(`
        INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(artist_key) DO UPDATE SET
          artist_id = COALESCE(excluded.artist_id, artists.artist_id),
          artist_uri = COALESCE(excluded.artist_uri, artists.artist_uri),
          artist_name = excluded.artist_name
        WHERE artists.artist_id IS NOT COALESCE(excluded.artist_id, artists.artist_id)
          OR artists.artist_uri IS NOT COALESCE(excluded.artist_uri, artists.artist_uri)
          OR artists.artist_name IS NOT excluded.artist_name
      `)
      .bind(artist.artistKey, artist.artistId, artist.artistUri, artist.artistName)
  ];
}

function playBindings(play) {
  return [
    play.playedAt,
    play.playedAtMs,
    play.trackKey,
    play.trackId,
    play.trackUri,
    play.trackName,
    play.albumKey,
    play.albumId,
    play.albumUri,
    play.albumName,
    play.albumImageUrl,
    play.durationMs,
    play.msPlayed,
    play.source
  ];
}

function artistBindings(artist) {
  return [
    artist.playedAt,
    artist.trackKey,
    artist.artistKey,
    artist.artistId,
    artist.artistUri,
    artist.artistName
  ];
}

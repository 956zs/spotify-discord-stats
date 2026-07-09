import { spotifyItemToPlayRecords } from '../../shared/play-records.js';
import { nowIso } from '../../shared/time.js';

export async function upsertSpotifyPlay(db, item) {
  const records = spotifyItemToPlayRecords(item);
  if (!records) {
    return false;
  }

  const inserted = await upsertPlay(db, records.play);
  for (const artist of records.artists) {
    await upsertPlayArtist(db, artist);
  }
  return inserted;
}

async function upsertPlay(db, play) {
  const existing = await db
    .prepare('SELECT 1 FROM plays WHERE played_at = ? AND track_key = ?')
    .bind(play.playedAt, play.trackKey)
    .first();

  await db
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
    `)
    .bind(...playBindings(play), nowIso())
    .run();

  return !existing;
}

async function upsertPlayArtist(db, artist) {
  await db
    .prepare(`
      INSERT OR IGNORE INTO play_artists (
        played_at, track_key, artist_key, artist_id, artist_uri, artist_name
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(...artistBindings(artist))
    .run();

  await db
    .prepare(`
      INSERT INTO artists (artist_key, artist_id, artist_uri, artist_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(artist_key) DO UPDATE SET
        artist_id = COALESCE(excluded.artist_id, artists.artist_id),
        artist_uri = COALESCE(excluded.artist_uri, artists.artist_uri),
        artist_name = excluded.artist_name
    `)
    .bind(artist.artistKey, artist.artistId, artist.artistUri, artist.artistName)
    .run();
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

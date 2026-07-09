import { fallbackKey, spotifyIdFromUri } from './keys.js';
import { isoToMs } from './time.js';

export function spotifyItemToPlayRecords(item) {
  if (!item?.track || item.track.type !== 'track' || !item.played_at) {
    return null;
  }

  const track = item.track;
  const playedAt = item.played_at;
  const playedAtMs = isoToMs(playedAt);
  if (playedAtMs === null) {
    return null;
  }

  const album = track.album ?? {};
  const trackId = track.id || spotifyIdFromUri(track.uri);
  const albumId = album.id || spotifyIdFromUri(album.uri);
  const trackKey = trackId || track.uri || fallbackKey('track', track.name, album.name);

  return {
    play: {
      playedAt,
      playedAtMs,
      trackKey,
      trackId: trackId ?? null,
      trackUri: track.uri ?? null,
      trackName: track.name ?? 'Unknown Track',
      albumKey: albumId || album.uri || fallbackKey('album', album.name),
      albumId: albumId ?? null,
      albumUri: album.uri ?? null,
      albumName: album.name ?? null,
      albumImageUrl: bestAlbumImageUrl(album.images),
      durationMs: track.duration_ms ?? null,
      msPlayed: null,
      source: 'spotify_api'
    },
    artists: spotifyArtistsToRecords(track.artists, playedAt, trackKey)
  };
}

export function exportRowToPlayRecords(row) {
  const playedAt = parseExportPlayedAt(row);
  if (!playedAt) {
    return null;
  }

  const playedAtMs = isoToMs(playedAt);
  const metadata = exportRowMetadata(row);
  if (playedAtMs === null || !metadata.trackName || !metadata.artistName) {
    return null;
  }

  const trackKey = exportTrackKey(metadata);

  return {
    play: exportPlayRecord({ row, playedAt, playedAtMs, trackKey, metadata }),
    artists: [exportArtistRecord({ playedAt, trackKey, metadata })]
  };
}

function exportRowMetadata(row) {
  return {
    trackName: pickFirst(row, [
      'master_metadata_track_name',
      'trackName',
      'track_name'
    ]),
    artistName: pickFirst(row, [
      'master_metadata_album_artist_name',
      'artistName',
      'artist_name'
    ]),
    albumName: pickFirst(row, [
      'master_metadata_album_album_name',
      'albumName',
      'album_name'
    ]),
    trackUri: pickFirst(row, ['spotify_track_uri', 'spotifyTrackUri', 'track_uri'])
  };
}

function exportTrackKey(metadata) {
  const trackId = spotifyIdFromUri(metadata.trackUri);
  return (
    trackId ||
    metadata.trackUri ||
    fallbackKey('track', metadata.trackName, metadata.artistName, metadata.albumName)
  );
}

function exportPlayRecord(options) {
  const trackId = spotifyIdFromUri(options.metadata.trackUri);
  const albumName = options.metadata.albumName;

  return {
    playedAt: options.playedAt,
    playedAtMs: options.playedAtMs,
    trackKey: options.trackKey,
    trackId,
    trackUri: options.metadata.trackUri,
    trackName: options.metadata.trackName,
    albumKey: albumName ? fallbackKey('album', albumName, options.metadata.artistName) : null,
    albumId: null,
    albumUri: null,
    albumName,
    albumImageUrl: null,
    durationMs: null,
    msPlayed: options.row.ms_played ?? options.row.msPlayed ?? null,
    source: 'spotify_export'
  };
}

function exportArtistRecord(options) {
  return {
    playedAt: options.playedAt,
    trackKey: options.trackKey,
    artistKey: fallbackKey('artist', options.metadata.artistName),
    artistId: null,
    artistUri: null,
    artistName: options.metadata.artistName
  };
}

function spotifyArtistsToRecords(artists = [], playedAt, trackKey) {
  return artists.map((artist) => {
    const artistId = artist.id || spotifyIdFromUri(artist.uri);
    return {
      playedAt,
      trackKey,
      artistKey: artistId || artist.uri || fallbackKey('artist', artist.name),
      artistId: artistId ?? null,
      artistUri: artist.uri ?? null,
      artistName: artist.name ?? 'Unknown Artist'
    };
  });
}

function bestAlbumImageUrl(images = []) {
  return images
    .map(normalizeImage)
    .filter(Boolean)
    .sort((left, right) => right.area - left.area)
    .at(0)?.url ?? null;
}

function normalizeImage(image) {
  const url = validHttpUrl(image?.url);
  if (!url) {
    return null;
  }

  const width = Number(image.width ?? 0);
  const height = Number(image.height ?? 0);
  return {
    url,
    area: Math.max(0, width) * Math.max(0, height)
  };
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseExportPlayedAt(row) {
  if (row.ts) {
    return toValidIso(row.ts);
  }

  if (row.endTime) {
    const normalized = String(row.endTime).replace(' ', 'T');
    return toValidIso(`${normalized}Z`);
  }

  if (row.played_at) {
    return toValidIso(row.played_at);
  }

  return null;
}

function toValidIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickFirst(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) {
      return row[name];
    }
  }
  return null;
}

const LAST_PLAYED_KIND = 'last_played';
const NONE_KIND = 'none';

export function playRowToSongStatus(row) {
  if (!row) {
    return emptySongStatus();
  }

  return songToStatus(LAST_PLAYED_KIND, {
    title: row.track_name,
    artists: compactStrings([row.artist_names]),
    album: nonEmptyString(row.album_name),
    imageUrl: nonEmptyString(row.album_image_url)
  });
}

export function emptySongStatus() {
  return {
    kind: NONE_KIND,
    title: null,
    artists: [],
    album: null,
    imageUrl: null,
    value: ''
  };
}

function songToStatus(kind, song) {
  if (!song?.title) {
    return emptySongStatus();
  }

  return {
    kind,
    title: song.title,
    artists: [...song.artists],
    album: song.album,
    imageUrl: song.imageUrl ?? null,
    value: formatSong(song)
  };
}

function formatSong(song) {
  return `♪ ${song.title}`;
}

function compactStrings(values) {
  return values.map(nonEmptyString).filter(Boolean);
}

function nonEmptyString(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text === '' ? null : text;
}

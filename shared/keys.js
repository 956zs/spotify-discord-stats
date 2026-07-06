export function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function fallbackKey(prefix, ...parts) {
  return `${prefix}:${parts.map(normalizeKey).join('|')}`;
}

export function spotifyIdFromUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  const parts = uri.split(':');
  if (parts.length !== 3 || parts[0] !== 'spotify') {
    return null;
  }

  return parts[2] || null;
}

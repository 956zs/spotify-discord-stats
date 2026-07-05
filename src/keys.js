export function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function fallbackKey(prefix, ...parts) {
  return `${prefix}:${parts.map(normalizeKey).join('|')}`;
}

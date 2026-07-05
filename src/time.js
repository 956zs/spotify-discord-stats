export function nowIso() {
  return new Date().toISOString();
}

export function isoToMs(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function sinceIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function formatMinutes(ms) {
  if (!ms || ms < 0) {
    return '0 minutes';
  }
  return `${Math.round(ms / 60000)} minutes`;
}

export function formatLocalUpdatedAt(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Taipei'
  });
  return formatter.format(date);
}

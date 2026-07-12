const TAIWAN_LOCALE = 'zh-TW';

export function formatCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return '0';
  }
  return new Intl.NumberFormat(TAIWAN_LOCALE).format(count);
}

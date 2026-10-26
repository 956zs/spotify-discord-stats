import { HERO_TEMPLATE_BASE64, HERO_TEMPLATE_SHA256 } from './hero-template-data.js';
import { HttpError } from './http.js';

// The 1300x1200 hero size template shown next to the crop tool. Public: it is only a
// guide image, the same one that ships in docs/images/templates.
export const HERO_TEMPLATE_PATH = '/admin/hero-template.png';
const CACHE_SECONDS = 7 * 24 * 60 * 60;

let templateBytes = null;

export function heroTemplateBytes() {
  templateBytes ??= Uint8Array.from(atob(HERO_TEMPLATE_BASE64), (char) => char.charCodeAt(0));
  return templateBytes;
}

export function heroTemplateResponse(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new HttpError('method not allowed', 405);
  }
  const etag = `"${HERO_TEMPLATE_SHA256}"`;
  const headers = {
    'Content-Type': 'image/png',
    'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  };
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === 'HEAD' ? null : heroTemplateBytes(), { status: 200, headers });
}

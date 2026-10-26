import { heroImagePathWithVersion } from '../../shared/widget-hero.js';
import { ERROR_CODES, HttpError } from './http.js';

export const HERO_IMAGE_KEY = 'hero';

// D1 caps a row at about 2 MB, and Discord shows the hero at 1300x1200 at most, so a
// well-compressed image fits comfortably below this.
export const MAX_WIDGET_IMAGE_BYTES = 1.5 * 1024 * 1024;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// File signatures; the declared Content-Type must match the bytes so the public route
// can never serve something that is not one of these images.
const SIGNATURES = {
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/gif': (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  'image/webp': (b) => startsWith(b, ascii('RIFF')) && startsWith(b.subarray(8), ascii('WEBP'))
};

export function detectImageType(bytes) {
  return ALLOWED_TYPES.find((type) => SIGNATURES[type](bytes)) ?? null;
}

// Reads and checks an upload request. Throws HttpError with a zh-TW message and a
// `code` the admin page translates.
export async function readImageUpload(request) {
  const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new HttpError('只接受 PNG、JPEG、WebP 或 GIF 圖片', 415, ERROR_CODES.imageType);
  }

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WIDGET_IMAGE_BYTES) {
    throw new HttpError(tooLargeMessage(), 413, ERROR_CODES.imageTooLarge);
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_WIDGET_IMAGE_BYTES) {
    throw new HttpError(tooLargeMessage(), 413, ERROR_CODES.imageTooLarge);
  }
  if (bytes.byteLength === 0) {
    throw new HttpError('圖片是空的', 400, ERROR_CODES.imageEmpty);
  }
  if (detectImageType(bytes) !== contentType) {
    throw new HttpError('檔案內容和圖片格式不符，請上傳真正的 PNG、JPEG、WebP 或 GIF', 400, ERROR_CODES.imageMismatch);
  }
  return { contentType, bytes };
}

export async function saveWidgetImage(db, key, { contentType, bytes }, now = new Date()) {
  const sha256 = await sha256Hex(bytes);
  const updatedAt = now.toISOString();
  await db
    .prepare(`
      INSERT INTO widget_images (key, content_type, data, sha256, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        content_type = excluded.content_type,
        data = excluded.data,
        sha256 = excluded.sha256,
        updated_at = excluded.updated_at
    `)
    .bind(key, contentType, bytes, sha256, updatedAt)
    .run();
  return imageMeta({ key, content_type: contentType, sha256, updated_at: updatedAt, size: bytes.byteLength });
}

export async function deleteWidgetImage(db, key) {
  const result = await db.prepare('DELETE FROM widget_images WHERE key = ?').bind(key).run();
  return { deleted: Number(result?.meta?.changes ?? 0) > 0 };
}

// Metadata only (no bytes), for payloads and the admin page.
export async function getWidgetImageMeta(db, key) {
  const row = await db
    .prepare('SELECT key, content_type, sha256, updated_at, LENGTH(data) AS size FROM widget_images WHERE key = ?')
    .bind(key)
    .first();
  return row ? imageMeta(row) : null;
}

// Public, unauthenticated: Discord's media proxy fetches this.
export async function widgetImageResponse(db, key, request) {
  const row = await db
    .prepare('SELECT content_type, data, sha256 FROM widget_images WHERE key = ?')
    .bind(key)
    .first();
  if (!row) {
    return new Response('not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  const etag = `"${row.sha256}"`;
  const headers = {
    'Content-Type': row.content_type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  };
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  const body = request.method === 'HEAD' ? null : toBytes(row.data);
  return new Response(body, { status: 200, headers });
}

function imageMeta(row) {
  return {
    contentType: row.content_type,
    sha256: row.sha256,
    size: Number(row.size ?? 0),
    updatedAt: row.updated_at,
    url: heroImagePathWithVersion(row.sha256)
  };
}

// D1 returns BLOBs as number arrays, node:sqlite as Uint8Array.
function toBytes(data) {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function tooLargeMessage() {
  return `圖片太大了，上限是 ${MAX_WIDGET_IMAGE_BYTES / 1024 / 1024} MB，請先壓縮或縮小尺寸`;
}

function ascii(text) {
  return [...text].map((char) => char.charCodeAt(0));
}

function startsWith(bytes, prefix) {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

import { HERO_IMAGE_PATH } from '../../shared/widget-hero.js';
import { ADMIN_CLIENT, I18N_RUNTIME } from './admin/client.js';
import { LOGIN_KEYS, MESSAGES, isLanguage, pickMessages, translator, DEFAULT_LANGUAGE } from './admin/i18n.js';
import { adminMarkup, loginMarkup } from './admin/markup.js';
import { ADMIN_STYLE, LOGIN_STYLE } from './admin/styles.js';
import { cryptoRandomHex } from './crypto.js';
import { HERO_TEMPLATE_PATH } from './hero-template.js';
import { MAX_WIDGET_IMAGE_BYTES } from './widget-images.js';

// Assembles the admin and login pages: markup (admin/markup.js), styles
// (admin/styles.js), copy (admin/i18n.js) and the page scripts (admin/client.js).
// Everything is inline under a per-response CSP nonce.

const NONCE_BYTES = 16;
// The hero crop tool outputs exactly the size Discord shows the Widget Top image at.
const CROP = { width: 1300, height: 1200, maxZoom: 4 };

export function adminPageResponse(lang = DEFAULT_LANGUAGE) {
  const language = isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  const boot = {
    messages: MESSAGES,
    heroPath: HERO_IMAGE_PATH,
    heroMaxBytes: MAX_WIDGET_IMAGE_BYTES,
    crop: CROP
  };
  return page({
    lang: language,
    style: ADMIN_STYLE,
    body: adminMarkup(translator(language), { templatePath: HERO_TEMPLATE_PATH, crop: CROP }),
    script: bootScript(boot) + I18N_RUNTIME + ADMIN_CLIENT
  });
}

export function loginPageResponse(status = 200, failed = false, lang = DEFAULT_LANGUAGE) {
  const language = isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  return page({
    lang: language,
    style: LOGIN_STYLE,
    body: loginMarkup(translator(language), failed),
    script: bootScript({ messages: pickMessages(LOGIN_KEYS) }) + I18N_RUNTIME,
    status
  });
}

// JSON inside a <script> element: escape "<" so no "</script>" or "<!--" can end it.
function bootScript(boot) {
  return `const BOOT = ${JSON.stringify(boot).replaceAll('<', '\\u003c')};\n`;
}

function page({ lang, style, body, script, status = 200 }) {
  const nonce = cryptoRandomHex(NONCE_BYTES);
  return new Response(
    `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<title>Spotify Stats Admin</title>
<style nonce="${nonce}">${style}</style>
</head>
<body>
${body}
<script nonce="${nonce}">${script}</script>
</body>
</html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': [
          "default-src 'none'",
          `script-src 'nonce-${nonce}'`,
          `style-src 'nonce-${nonce}'`,
          "img-src 'self' https://i.scdn.co https://*.scdn.co https://*.spotifycdn.com",
          "connect-src 'self'",
          "form-action 'self'",
          "base-uri 'none'",
          "frame-ancestors 'none'"
        ].join('; ')
      }
    }
  );
}

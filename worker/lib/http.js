// Stable machine ids for errors the admin page shows. The page translates by `code`
// and falls back to the readable `message` (zh-TW or English, as before).
export const ERROR_CODES = Object.freeze({
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  methodNotAllowed: 'method_not_allowed',
  notFound: 'not_found',
  expectedJson: 'expected_json',
  invalidJson: 'invalid_json',
  invalidSettings: 'invalid_settings',
  imageType: 'image_type',
  imageTooLarge: 'image_too_large',
  imageEmpty: 'image_empty',
  imageMismatch: 'image_mismatch',
  missingConfig: 'missing_config',
  spotifyNotConnected: 'spotify_not_connected',
  spotifyTokenFailed: 'spotify_token_failed',
  spotifyRateLimited: 'spotify_rate_limited',
  spotifyApiFailed: 'spotify_api_failed',
  discordDmFailed: 'discord_dm_failed'
});

export class HttpError extends Error {
  // `details` (optional) is a list of strings the page shows after the translated text.
  constructor(message, status = 500, code = undefined, details = undefined) {
    super(message);
    this.status = status;
    if (code) {
      this.code = code;
    }
    if (details) {
      this.details = details;
    }
  }
}

// JSON body for a thrown error: { error, code?, details? }.
export function errorBody(error) {
  const body = { error: error.message };
  if (error.code) {
    body.code = error.code;
  }
  if (Array.isArray(error.details) && error.details.length > 0) {
    body.details = error.details;
  }
  return body;
}

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export function html(title, body, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </body>
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

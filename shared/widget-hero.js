// The Widget Top hero image. In the widget editor the image is "User Data" with a
// fallback application asset, so sending no hero field shows that asset.
//   asset  - send nothing, the fallback asset shows
//   upload - an image uploaded on the admin page, served by the Worker
//   album  - the album artwork of the last played song
export const HERO_ASSET = 'asset';
export const HERO_UPLOAD = 'upload';
export const HERO_ALBUM = 'album';
export const HERO_MODES = [HERO_ASSET, HERO_UPLOAD, HERO_ALBUM];

// Public route for the uploaded image. `?v=` changes with every upload so Discord's
// media proxy and browsers fetch the new file instead of a cached one.
export const HERO_IMAGE_PATH = '/widget/hero';
const HERO_VERSION_LENGTH = 12;

// Unknown or missing modes (older stored settings, garbage input) mean "asset".
export function normalizeHeroMode(value) {
  return HERO_MODES.includes(value) ? value : HERO_ASSET;
}

export function heroImageVersion(sha256) {
  return String(sha256 ?? '').slice(0, HERO_VERSION_LENGTH);
}

export function heroImagePathWithVersion(sha256) {
  return `${HERO_IMAGE_PATH}?v=${heroImageVersion(sha256)}`;
}

// The image URL to send, or null to leave the fallback asset in place. `heroUpload` is
// the stored image's metadata ({ sha256 }) and `publicBaseUrl` the Worker's public
// origin; both are only known to runtimes that can serve the upload.
export function resolveHeroImageUrl(mode, { lastPlayed, heroUpload, publicBaseUrl } = {}) {
  const normalized = normalizeHeroMode(mode);
  if (normalized === HERO_UPLOAD) {
    if (!heroUpload?.sha256 || !publicBaseUrl) {
      return null;
    }
    return publicHttpsUrl(`${publicBaseUrl.replace(/\/+$/, '')}${heroImagePathWithVersion(heroUpload.sha256)}`);
  }
  if (normalized === HERO_ALBUM) {
    return publicHttpsUrl(lastPlayed?.imageUrl);
  }
  return null;
}

// Discord only fetches public https media.
function publicHttpsUrl(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

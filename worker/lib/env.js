export function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required binding/secret: ${name}`);
  }
  return value;
}

// Public origin of the Worker: PUBLIC_BASE_URL, else the origin of SPOTIFY_REDIRECT_URI.
export function publicBaseUrl(env) {
  if (env.PUBLIC_BASE_URL) {
    return String(env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  }
  try {
    return env.SPOTIFY_REDIRECT_URI ? new URL(env.SPOTIFY_REDIRECT_URI).origin : null;
  } catch {
    return null;
  }
}

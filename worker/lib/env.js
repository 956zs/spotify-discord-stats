import { HttpError } from './http.js';

export function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required binding/secret: ${name}`);
  }
  return value;
}

export function requireAdminToken(url, env) {
  const expected = requiredEnv(env, 'ADMIN_TOKEN');
  const provided =
    url.searchParams.get('token') ||
    url.searchParams.get('admin_token') ||
    url.searchParams.get('key');

  if (provided !== expected) {
    throw new HttpError('unauthorized', 401);
  }
}

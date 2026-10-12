export function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required binding/secret: ${name}`);
  }
  return value;
}

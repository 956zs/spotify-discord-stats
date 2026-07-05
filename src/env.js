import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const loadedEnvFiles = new Set();

export function loadEnv(filePath = '.env') {
  const resolved = path.resolve(filePath);
  if (loadedEnvFiles.has(resolved) || !fs.existsSync(resolved)) {
    return;
  }

  loadedEnvFiles.add(resolved);
  const text = fs.readFileSync(resolved, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

export function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

export function requiredEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function envInt(name, fallback) {
  const value = env(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env ${name} must be an integer`);
  }
  return parsed;
}

export function envBool(name, fallback = false) {
  const value = env(name);
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function getState(db, key) {
  const row = await db.prepare('SELECT value FROM app_state WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}

export async function setState(db, key, value) {
  await db
    .prepare(`
      INSERT INTO app_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .bind(key, String(value))
    .run();
}

/** Ordered SQL migrations. PostgreSQL schema version is explicit, never inferred. */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccordError, publicError } from '@accord/contracts';
import type { Database } from './client.js';

const MIGRATIONS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Applies numbered SQL migrations in order, once, inside a transaction each. */
export async function applyMigrations(db: Database): Promise<{ appliedVersion: number }> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     integer PRIMARY KEY,
      name        text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(MIGRATIONS_DIRECTORY)).filter((name) => name.endsWith('.sql')).sort();
  const applied = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
  const done = new Set(applied.rows.map((row) => row.version));
  let highest = done.size === 0 ? 0 : Math.max(...done);

  for (const file of files) {
    const version = Number.parseInt(file.slice(0, file.indexOf('_')), 10);
    if (!Number.isInteger(version)) {
      throw new AccordError(publicError('INVALID_INPUT', `migration ${file} has no ordered numeric prefix`));
    }
    if (done.has(version)) continue;
    const sql = await readFile(join(MIGRATIONS_DIRECTORY, file), 'utf8');
    await db.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
    });
    highest = Math.max(highest, version);
  }
  return { appliedVersion: highest };
}

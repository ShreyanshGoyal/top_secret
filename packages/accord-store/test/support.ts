/** Real-PostgreSQL test support. There is no in-memory substitute here on purpose: these tests
 * exist to prove the SQL, the constraints and the locking, so a missing database is a clear failure
 * rather than a silent pass.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createStore } from '../src/index.js';
import type { StorePort } from '../src/types.js';

export function databaseUrl(): string {
  const url = process.env['ACCORD_TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'PostgreSQL integration tests need a real database.\n'
      + '  Set ACCORD_TEST_DATABASE_URL (preferred) or DATABASE_URL to a throwaway PostgreSQL instance.\n'
      + '  These tests create and drop their own schema; never point them at production.',
    );
  }
  return url;
}

export interface TestDatabase {
  store: StorePort;
  schema: string;
  reset(): Promise<void>;
  close(): Promise<void>;
}

/** Each run gets its own schema, so concurrent runs and leftovers cannot collide. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const base = databaseUrl();
  const schema = `accord_test_${randomBytes(6).toString('hex')}`;

  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const url = new URL(base);
  url.searchParams.set('options', `-csearch_path=${schema}`);
  const store = createStore({ databaseUrl: url.toString(), maxConnections: 8, statementTimeoutMs: 10_000 });
  await store.migrate();

  return {
    store,
    schema,
    async reset() {
      const client = new pg.Client({ connectionString: url.toString() });
      await client.connect();
      await client.query(
        'TRUNCATE publication_receipts, outbox, findings, baseline_reports, investigation_steps, investigations, owner_actions, inbound_events, job_intents, decision_versions, threads RESTART IDENTITY CASCADE',
      );
      await client.end();
    },
    async close() {
      await store.close();
      const cleanup = new pg.Client({ connectionString: base });
      await cleanup.connect();
      await cleanup.query(`DROP SCHEMA ${schema} CASCADE`);
      await cleanup.end();
    },
  };
}

/** PostgreSQL connection and transaction helpers. Every query is parameterized.
 * A transaction never stays open across a slow external call.
 */
import pg from 'pg';
import { AccordError, publicError } from '@accord/contracts';
import type { StoreConfig } from './types.js';

const { Pool } = pg;

export interface Queryable {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: readonly unknown[]): Promise<pg.QueryResult<Row>>;
}

export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

/** Postgres errors must never reach the model or Slack with their raw detail. */
export function databaseError(error: unknown, context: string): AccordError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === '23505') return new AccordError(publicError('INVALID_INPUT', `${context}: duplicate key`), { cause: error });
  if (code === '40001' || code === '40P01') return new AccordError(publicError('PROVIDER_ERROR', `${context}: serialization failure`), { cause: error });
  if (code === '57014') return new AccordError(publicError('TIMEOUT', `${context}: statement timeout`), { cause: error });
  if (code === '28P01' || code === '28000') return new AccordError(publicError('AUTH', `${context}: database authentication failed`), { cause: error });
  return new AccordError(publicError('PROVIDER_ERROR', `${context}: database error${code ? ` (${code})` : ''}`), { cause: error });
}

export function createDatabase(config: StoreConfig): Database {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.maxConnections,
    statement_timeout: config.statementTimeoutMs,
    application_name: 'accord',
  });

  return {
    async query(text, params) {
      try {
        return await pool.query(text, params ? [...params] : undefined);
      } catch (error) {
        throw databaseError(error, 'query');
      }
    },
    async transaction(fn) {
      const client = await pool.connect().catch((error: unknown) => {
        throw databaseError(error, 'connect');
      });
      try {
        await client.query('BEGIN');
        const tx: Queryable = {
          async query(text, params) {
            try {
              return await client.query(text, params ? [...params] : undefined);
            } catch (error) {
              throw databaseError(error, 'query');
            }
          },
        };
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error instanceof AccordError ? error : databaseError(error, 'transaction');
      } finally {
        client.release();
      }
    },
    async end() {
      await pool.end();
    },
  };
}

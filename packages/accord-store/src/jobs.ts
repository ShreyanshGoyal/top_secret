/** Durable job intents. A crash between the commit and the Trigger.dev API call must not lose work:
 * the intent is already persisted, and reconciliation redispatches it with a stable idempotency key.
 */
import { randomUUID } from 'node:crypto';
import type { Queryable } from './client.js';
import { toJobIntent } from './rows.js';
import type { RawJobIntent } from './rows.js';
import type { JobIntent, JobTaskType } from './types.js';

const JOB_COLUMNS = 'id, logical_key, task_type, payload, status, trigger_run_id, attempts, next_attempt_at';

export async function enqueueJobIntent(
  db: Queryable,
  input: { logicalKey: string; taskType: JobTaskType; payload: Record<string, unknown> },
): Promise<{ intent: JobIntent; created: boolean }> {
  const inserted = await db.query<RawJobIntent>(
    `INSERT INTO job_intents (id, logical_key, task_type, payload, status)
     VALUES ($1, $2, $3, $4::jsonb, 'pending')
     ON CONFLICT (logical_key) DO NOTHING
     RETURNING ${JOB_COLUMNS}`,
    [randomUUID(), input.logicalKey, input.taskType, JSON.stringify(input.payload)],
  );
  const row = inserted.rows[0];
  if (row) return { intent: toJobIntent(row), created: true };

  const existing = await db.query<RawJobIntent>(`SELECT ${JOB_COLUMNS} FROM job_intents WHERE logical_key = $1`, [input.logicalKey]);
  return { intent: toJobIntent(existing.rows[0]!), created: false };
}

export async function markJobDispatched(db: Queryable, intentId: string, triggerRunId: string): Promise<void> {
  await db.query(
    `UPDATE job_intents SET status = 'dispatched', trigger_run_id = $2, attempts = attempts + 1, updated_at = now()
      WHERE id = $1`,
    [intentId, triggerRunId],
  );
}

export async function markJobCompleted(db: Queryable, logicalKey: string): Promise<void> {
  await db.query(
    `UPDATE job_intents SET status = 'completed', updated_at = now() WHERE logical_key = $1`,
    [logicalKey],
  );
}

/** Swept by the scheduled reconcile task. In-memory timers are not a durable queue. */
export async function listPendingJobIntents(db: Queryable, limit: number): Promise<JobIntent[]> {
  const result = await db.query<RawJobIntent>(
    `SELECT ${JOB_COLUMNS} FROM job_intents
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at LIMIT $1`,
    [limit],
  );
  return result.rows.map(toJobIntent);
}

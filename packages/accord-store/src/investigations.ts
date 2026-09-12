/** Investigation runs, step checkpoints and frozen baseline reports. */
import { randomUUID } from 'node:crypto';
import { canonicalJson } from '@accord/contracts';
import type { CommitTarget, RepositoryReport, RunContext } from '@accord/contracts';
import type { Queryable } from './client.js';
import { toInvestigationRow, toRepositoryReport } from './rows.js';
import type { RawInvestigation } from './rows.js';
import type { InvestigationRow, InvestigationStatus } from './types.js';

const INVESTIGATION_COLUMNS = `id, thread_id, decision_id, decision_version, context_revision, mode,
  dataset_version, as_of, status, attempt, trigger_run_id, error`;

/**
 * One logical run per decision version, context revision and mode. A retry of the same immutable
 * run reuses the row and increments its attempt counter rather than starting a second run.
 */
export async function createInvestigation(db: Queryable, threadId: string, run: RunContext): Promise<InvestigationRow> {
  const inserted = await db.query<RawInvestigation>(
    `INSERT INTO investigations (
       id, thread_id, decision_id, decision_version, context_revision, mode, dataset_version, as_of, status, attempt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', 1)
     ON CONFLICT (decision_id, decision_version, context_revision, mode)
       DO UPDATE SET attempt = investigations.attempt + 1, updated_at = now()
     RETURNING ${INVESTIGATION_COLUMNS}`,
    [
      run.investigationId, threadId, run.decisionId, run.decisionVersion, run.contextRevision,
      run.mode, run.datasetVersion, run.asOf,
    ],
  );
  return toInvestigationRow(inserted.rows[0]!);
}

export async function getInvestigation(db: Queryable, investigationId: string): Promise<InvestigationRow | null> {
  const result = await db.query<RawInvestigation>(
    `SELECT ${INVESTIGATION_COLUMNS} FROM investigations WHERE id = $1`,
    [investigationId],
  );
  const row = result.rows[0];
  return row ? toInvestigationRow(row) : null;
}

export async function updateInvestigationStatus(
  db: Queryable,
  investigationId: string,
  status: InvestigationStatus,
  error: string | null = null,
): Promise<void> {
  await db.query(
    'UPDATE investigations SET status = $2, error = $3, updated_at = now() WHERE id = $1',
    [investigationId, status, error],
  );
}

/** The target is resolved once per run and then frozen: every fetch and line link uses this SHA. */
export async function saveInvestigationTarget(
  db: Queryable,
  input: { investigationId: string; target: CommitTarget; kind: 'target' | 'base_target' },
): Promise<void> {
  const column = input.kind === 'target' ? 'target' : 'base_target';
  await db.query(
    `UPDATE investigations SET ${column} = $2::jsonb, updated_at = now() WHERE id = $1 AND ${column} IS NULL`,
    [input.investigationId, JSON.stringify(input.target)],
  );
}

export async function supersedeStaleInvestigations(db: Queryable, threadId: string, currentContextRevision: number): Promise<number> {
  const result = await db.query(
    `UPDATE investigations SET status = 'superseded', updated_at = now()
      WHERE thread_id = $1 AND context_revision < $2
        AND status NOT IN ('completed', 'superseded', 'failed', 'cancelled')`,
    [threadId, currentContextRevision],
  );
  return result.rowCount ?? 0;
}

/** A checkpoint is only reusable when its input hash matches exactly. */
export async function saveStepResult(
  db: Queryable,
  input: { investigationId: string; stepKey: string; inputHash: string; result: unknown },
): Promise<void> {
  await db.query(
    `INSERT INTO investigation_steps (investigation_id, step_key, input_hash, result, status, completed_at)
     VALUES ($1, $2, $3, $4::jsonb, 'completed', now())
     ON CONFLICT (investigation_id, step_key)
       DO UPDATE SET input_hash = EXCLUDED.input_hash, result = EXCLUDED.result,
                     status = 'completed', completed_at = now()`,
    [input.investigationId, input.stepKey, input.inputHash, canonicalJson(input.result)],
  );
}

export async function readStepResult(
  db: Queryable,
  input: { investigationId: string; stepKey: string; inputHash: string },
): Promise<unknown | null> {
  const result = await db.query<{ result: unknown }>(
    `SELECT result FROM investigation_steps
      WHERE investigation_id = $1 AND step_key = $2 AND input_hash = $3 AND status = 'completed'`,
    [input.investigationId, input.stepKey, input.inputHash],
  );
  return result.rows[0]?.result ?? null;
}

/** Written once per decision version. A candidate report can never overwrite the baseline. */
export async function saveBaselineReport(
  db: Queryable,
  input: { decisionId: string; decisionVersion: number; report: RepositoryReport },
): Promise<void> {
  await db.query(
    `INSERT INTO baseline_reports (decision_id, decision_version, report)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (decision_id, decision_version) DO NOTHING`,
    [input.decisionId, input.decisionVersion, JSON.stringify(input.report)],
  );
}

export async function readBaselineReport(
  db: Queryable,
  input: { decisionId: string; decisionVersion: number },
): Promise<RepositoryReport | null> {
  const result = await db.query<{ report: unknown }>(
    'SELECT report FROM baseline_reports WHERE decision_id = $1 AND decision_version = $2',
    [input.decisionId, input.decisionVersion],
  );
  const row = result.rows[0];
  return row ? toRepositoryReport(row.report) : null;
}

export function newInvestigationId(): string {
  return randomUUID();
}

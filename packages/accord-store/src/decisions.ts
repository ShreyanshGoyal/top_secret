/** Immutable decision versions and the audited owner action log.
 * A material change, confirmation, tentative transition or withdrawal appends a new version;
 * the thread row points at the latest one.
 */
import { randomUUID } from 'node:crypto';
import type { Decision, OwnerAction } from '@accord/contracts';
import type { Database, Queryable } from './client.js';
import { toDecision } from './rows.js';
import type { RawDecision } from './rows.js';
import type { DecisionDraft } from './types.js';

const DECISION_COLUMNS = `d.decision_id, d.version, t.team_id, t.channel_id, t.root_ts, d.context_revision,
  d.status, d.intent, d.intent_hash, d.owner_id, d.confirmed_by, d.confirmed_at, d.source_message_ids,
  d.created_at, d.updated_at`;

export async function getActiveDecision(db: Queryable, threadId: string): Promise<Decision | null> {
  const result = await db.query<RawDecision>(
    `SELECT ${DECISION_COLUMNS}
       FROM threads t
       JOIN decision_versions d ON d.decision_id = t.active_decision_id AND d.version = t.active_version
      WHERE t.id = $1`,
    [threadId],
  );
  const row = result.rows[0];
  return row ? toDecision(row) : null;
}

export async function getDecisionVersion(db: Queryable, decisionId: string, version: number): Promise<Decision | null> {
  const result = await db.query<RawDecision>(
    `SELECT ${DECISION_COLUMNS}
       FROM decision_versions d JOIN threads t ON t.id = d.thread_id
      WHERE d.decision_id = $1 AND d.version = $2`,
    [decisionId, version],
  );
  const row = result.rows[0];
  return row ? toDecision(row) : null;
}

/**
 * Appends the next version of a decision and repoints the thread, under the thread row lock so
 * two concurrent interpretations cannot mint the same version number. Returns null when the thread
 * has already moved to a newer context revision: an obsolete pass may not rewrite decision state.
 */
export async function appendDecisionVersion(db: Database, threadId: string, draft: DecisionDraft): Promise<Decision | null> {
  return db.transaction(async (tx) => {
    const locked = await tx.query<{ context_revision: number }>(
      'SELECT context_revision FROM threads WHERE id = $1 FOR UPDATE',
      [threadId],
    );
    const current = locked.rows[0];
    if (!current || current.context_revision !== draft.contextRevision) return null;
    const decisionId = draft.decisionId ?? randomUUID();
    const latest = await tx.query<{ version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM decision_versions WHERE decision_id = $1',
      [decisionId],
    );
    const version = (latest.rows[0]?.version ?? 0) + 1;

    await tx.query(
      `INSERT INTO decision_versions (
         decision_id, version, thread_id, context_revision, status, intent, intent_hash,
         owner_id, confirmed_by, confirmed_at, source_message_ids)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb)`,
      [
        decisionId, version, threadId, draft.contextRevision, draft.status,
        draft.intent === null ? null : JSON.stringify(draft.intent), draft.intentHash,
        draft.ownerId, draft.confirmedBy, draft.confirmedAt,
        JSON.stringify(draft.sourceMessageIds),
      ],
    );
    await tx.query(
      'UPDATE threads SET active_decision_id = $2, active_version = $3, updated_at = now() WHERE id = $1',
      [threadId, decisionId, version],
    );

    const result = await tx.query<RawDecision>(
      `SELECT ${DECISION_COLUMNS}
         FROM decision_versions d JOIN threads t ON t.id = d.thread_id
        WHERE d.decision_id = $1 AND d.version = $2`,
      [decisionId, version],
    );
    return toDecision(result.rows[0]!);
  });
}

export async function readOwnerAction(db: Queryable, actionId: string): Promise<{ outcome: string } | null> {
  const result = await db.query<{ outcome: string }>('SELECT outcome FROM owner_actions WHERE action_id = $1', [actionId]);
  return result.rows[0] ?? null;
}

/** Owner actions are idempotent by action id; a replayed click records once. */
export async function recordOwnerAction(db: Queryable, action: OwnerAction, outcome: string): Promise<{ duplicate: boolean }> {
  const threadResult = await db.query<{ id: string }>(
    'SELECT id FROM threads WHERE team_id = $1 AND channel_id = $2 AND root_ts = $3',
    [action.thread.teamId, action.thread.channelId, action.thread.rootTs],
  );
  const threadId = threadResult.rows[0]?.id;
  if (!threadId) return { duplicate: false };

  const inserted = await db.query<{ action_id: string }>(
    `INSERT INTO owner_actions (
       action_id, thread_id, actor, decision_id, expected_version, expected_context_revision, kind, outcome, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (action_id) DO NOTHING
     RETURNING action_id`,
    [
      action.actionId, threadId, action.actorId, action.decisionId, action.expectedVersion,
      action.expectedContextRevision, action.kind, outcome, action.occurredAt,
    ],
  );
  return { duplicate: inserted.rows.length === 0 };
}

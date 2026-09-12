/** Findings, the publication outbox and publication receipts.
 * A finding only becomes current when its decision version AND context revision still match the
 * thread, checked in the same transaction that writes it.
 */
import { randomUUID } from 'node:crypto';
import { FindingSchema, validate } from '@accord/contracts';
import type { Finding, Id, PublicationReceipt, PublicationReceiptReader } from '@accord/contracts';
import type { Database, Queryable } from './client.js';
import { toFinding, toJobIntent, toOutboxRow } from './rows.js';
import type { RawJobIntent, RawOutbox } from './rows.js';
import type { CommitOutcome, DeliveryStatus, FindingDraft, JobIntent, OutboxRow, PublicationDraft } from './types.js';

const OUTBOX_COLUMNS = `id, thread_id, finding_id, payload, publication_revision, expected_version,
  expected_context, status, attempts, next_attempt_at, lease_owner, lease_until, delivered_ts`;

export function publishJobKey(publicationId: string): string {
  return `publish:${publicationId}`;
}

/**
 * Writes the finding and enqueues its publication atomically. The finding id is stable per thread so
 * one bot-owned Slack message can be updated with increasing publication revisions.
 */
export async function commitFinding(
  db: Database,
  input: { threadId: string; finding: FindingDraft; now: string },
): Promise<CommitOutcome> {
  return db.transaction(async (tx) => {
    const threadResult = await tx.query<{ context_revision: number; active_version: number | null }>(
      'SELECT context_revision, active_version FROM threads WHERE id = $1 FOR UPDATE',
      [input.threadId],
    );
    const thread = threadResult.rows[0];
    if (!thread) {
      return { committed: false, reason: 'superseded' as const, finding: null, publication: null, jobIntent: null };
    }

    // Both keys must still be current. Either one differing makes this result history, not the answer.
    if (thread.context_revision !== input.finding.contextRevision || thread.active_version !== input.finding.decisionVersion) {
      return { committed: false, reason: 'superseded' as const, finding: null, publication: null, jobIntent: null };
    }

    const existing = await tx.query<{ id: string; revision: number }>(
      'SELECT id, revision FROM findings WHERE thread_id = $1 ORDER BY revision DESC LIMIT 1',
      [input.threadId],
    );
    const previous = existing.rows[0];
    const findingId = previous?.id ?? randomUUID();
    const revision = (previous?.revision ?? 0) + 1;

    const finding: Finding = validate(
      FindingSchema,
      { ...input.finding, id: findingId, updatedAt: input.now },
      'Finding about to be committed',
    );

    await tx.query(
      `INSERT INTO findings (id, thread_id, decision_id, decision_version, context_revision, payload, revision)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (id) DO UPDATE SET
         decision_id = EXCLUDED.decision_id,
         decision_version = EXCLUDED.decision_version,
         context_revision = EXCLUDED.context_revision,
         payload = EXCLUDED.payload,
         revision = EXCLUDED.revision,
         updated_at = now()`,
      [findingId, input.threadId, finding.decisionId, finding.decisionVersion, finding.contextRevision, JSON.stringify(finding), revision],
    );

    // An older queued send for this thread must never overwrite the newer one.
    await tx.query(
      `UPDATE outbox SET status = 'superseded', updated_at = now()
        WHERE thread_id = $1 AND publication_revision < $2 AND status IN ('pending', 'retryable', 'uncertain')`,
      [input.threadId, revision],
    );

    const publicationId = randomUUID();
    const threadRefResult = await tx.query<{ team_id: string; channel_id: string; root_ts: string; finding_message_ts: string | null }>(
      'SELECT team_id, channel_id, root_ts, finding_message_ts FROM threads WHERE id = $1',
      [input.threadId],
    );
    const threadRef = threadRefResult.rows[0]!;
    const draft = {
      id: publicationId,
      thread: { teamId: threadRef.team_id, channelId: threadRef.channel_id, rootTs: threadRef.root_ts },
      findingId,
      decisionVersion: finding.decisionVersion,
      contextRevision: finding.contextRevision,
      revision,
      existingTs: threadRef.finding_message_ts,
    };

    await tx.query(
      `INSERT INTO outbox (
         id, thread_id, finding_id, payload, publication_revision, expected_version, expected_context, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'pending')`,
      [publicationId, input.threadId, findingId, JSON.stringify(draft), revision, finding.decisionVersion, finding.contextRevision],
    );

    const intent = await tx.query<RawJobIntent>(
      `INSERT INTO job_intents (id, logical_key, task_type, payload, status)
       VALUES ($1, $2, 'accord-publish', $3::jsonb, 'pending')
       ON CONFLICT (logical_key) DO NOTHING
       RETURNING id, logical_key, task_type, payload, status, trigger_run_id, attempts, next_attempt_at`,
      [randomUUID(), publishJobKey(publicationId), JSON.stringify({ publicationId })],
    );

    const intentRow = intent.rows[0];
    return {
      committed: true,
      reason: null,
      finding,
      publication: draft,
      jobIntent: intentRow ? toJobIntent(intentRow) : null,
    };
  });
}

export async function readFinding(db: Queryable, findingId: string): Promise<Finding | null> {
  const result = await db.query<{ payload: unknown }>('SELECT payload FROM findings WHERE id = $1', [findingId]);
  const row = result.rows[0];
  return row ? toFinding(row.payload) : null;
}

/**
 * Claims one due row with a database lease. An expired lease is reclaimable, so a crashed worker
 * does not strand a publication. No transaction is held open across the Slack call.
 */
export async function claimDueOutboxRow(
  db: Queryable,
  input: { leaseOwner: string; leaseMs: number },
): Promise<OutboxRow | null> {
  const result = await db.query<RawOutbox>(
    `UPDATE outbox SET
       status = 'sending',
       lease_owner = $1,
       lease_until = now() + make_interval(secs => $2::double precision / 1000),
       attempts = attempts + 1,
       updated_at = now()
     WHERE id = (
       SELECT id FROM outbox
        WHERE next_attempt_at <= now()
          AND (
            status IN ('pending', 'retryable', 'uncertain')
            OR (status = 'sending' AND lease_owner = $1)
            OR (status = 'sending' AND lease_until IS NOT NULL AND lease_until < now())
          )
        ORDER BY next_attempt_at, publication_revision
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     RETURNING ${OUTBOX_COLUMNS}`,
    [input.leaseOwner, input.leaseMs],
  );
  const row = result.rows[0];
  return row ? toOutboxRow(row) : null;
}

/** Claims one specific publication by id, honouring the same lease and status rules. */
export async function claimOutboxRow(
  db: Queryable,
  input: { publicationId: string; leaseOwner: string; leaseMs: number },
): Promise<OutboxRow | null> {
  const result = await db.query<RawOutbox>(
    `UPDATE outbox SET
       status = 'sending',
       lease_owner = $2,
       lease_until = now() + make_interval(secs => $3::double precision / 1000),
       attempts = attempts + 1,
       updated_at = now()
     WHERE id = $1
       AND next_attempt_at <= now()
       AND (
         status IN ('pending', 'retryable', 'uncertain')
         OR (status = 'sending' AND lease_owner = $2)
         OR (status = 'sending' AND lease_until IS NOT NULL AND lease_until < now())
       )
     RETURNING ${OUTBOX_COLUMNS}`,
    [input.publicationId, input.leaseOwner, input.leaseMs],
  );
  const row = result.rows[0];
  return row ? toOutboxRow(row) : null;
}

/**
 * Enqueues a corrective publication for the thread's current finding. Used when the decision moved
 * while a send was already in flight: the stale message is corrected rather than left standing.
 */
export async function enqueueCorrection(
  db: Database,
  threadId: string,
): Promise<{ publication: PublicationDraft; jobIntent: JobIntent | null } | null> {
  return db.transaction(async (tx) => {
    const threadResult = await tx.query<{
      team_id: string; channel_id: string; root_ts: string; finding_message_ts: string | null;
      context_revision: number; active_version: number | null;
    }>(
      `SELECT team_id, channel_id, root_ts, finding_message_ts, context_revision, active_version
         FROM threads WHERE id = $1 FOR UPDATE`,
      [threadId],
    );
    const thread = threadResult.rows[0];
    if (!thread || thread.active_version === null) return null;

    const findingResult = await tx.query<{ id: string; revision: number }>(
      'SELECT id, revision FROM findings WHERE thread_id = $1 ORDER BY revision DESC LIMIT 1',
      [threadId],
    );
    const finding = findingResult.rows[0];
    if (!finding) return null;

    const revision = finding.revision + 1;
    await tx.query('UPDATE findings SET revision = $2, updated_at = now() WHERE id = $1', [finding.id, revision]);
    await tx.query(
      `UPDATE outbox SET status = 'superseded', updated_at = now()
        WHERE thread_id = $1 AND publication_revision < $2 AND status IN ('pending', 'retryable', 'uncertain')`,
      [threadId, revision],
    );

    const publicationId = randomUUID();
    const draft: PublicationDraft = {
      id: publicationId,
      thread: { teamId: thread.team_id, channelId: thread.channel_id, rootTs: thread.root_ts },
      findingId: finding.id,
      decisionVersion: thread.active_version,
      contextRevision: thread.context_revision,
      revision,
      existingTs: thread.finding_message_ts,
    };
    await tx.query(
      `INSERT INTO outbox (
         id, thread_id, finding_id, payload, publication_revision, expected_version, expected_context, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'pending')`,
      [publicationId, threadId, finding.id, JSON.stringify(draft), revision, thread.active_version, thread.context_revision],
    );
    const intent = await tx.query<RawJobIntent>(
      `INSERT INTO job_intents (id, logical_key, task_type, payload, status)
       VALUES ($1, $2, 'accord-publish', $3::jsonb, 'pending')
       ON CONFLICT (logical_key) DO NOTHING
       RETURNING id, logical_key, task_type, payload, status, trigger_run_id, attempts, next_attempt_at`,
      [randomUUID(), publishJobKey(publicationId), JSON.stringify({ publicationId })],
    );
    const intentRow = intent.rows[0];
    return { publication: draft, jobIntent: intentRow ? toJobIntent(intentRow) : null };
  });
}

export async function readOutboxRow(db: Queryable, publicationId: string): Promise<OutboxRow | null> {
  const result = await db.query<RawOutbox>(`SELECT ${OUTBOX_COLUMNS} FROM outbox WHERE id = $1`, [publicationId]);
  const row = result.rows[0];
  return row ? toOutboxRow(row) : null;
}

export async function completeDelivery(
  db: Queryable,
  input: { publicationId: string; status: DeliveryStatus; deliveredTs: string | null; error: string | null; retryAfterMs: number | null },
): Promise<void> {
  await db.query(
    `UPDATE outbox SET
       status = $2,
       delivered_ts = COALESCE($3, delivered_ts),
       error = $4,
       next_attempt_at = CASE
         WHEN $2 IN ('retryable', 'uncertain')
           THEN now() + make_interval(secs => COALESCE($5::double precision, 5000) / 1000)
         ELSE next_attempt_at
       END,
       lease_owner = NULL,
       lease_until = NULL,
       updated_at = now()
     WHERE id = $1`,
    [input.publicationId, input.status, input.deliveredTs, input.error, input.retryAfterMs],
  );
}

export async function setThreadFindingMessageTs(db: Queryable, threadId: string, ts: string): Promise<void> {
  await db.query(
    'UPDATE threads SET finding_message_ts = COALESCE(finding_message_ts, $2), updated_at = now() WHERE id = $1',
    [threadId, ts],
  );
}

/**
 * Transport-facing only. The bridge has already authenticated this as our own bot in the allowed
 * channel; here we additionally require that it matches a real publication, thread and revision.
 */
export async function recordPublicationReceipt(
  db: Queryable,
  receipt: PublicationReceipt,
): Promise<{ recorded: boolean; reason: string | null }> {
  const match = await db.query<{ id: string }>(
    `SELECT o.id FROM outbox o JOIN threads t ON t.id = o.thread_id
      WHERE o.id = $1 AND o.finding_id = $2 AND o.publication_revision = $3
        AND t.team_id = $4 AND t.channel_id = $5 AND t.root_ts = $6`,
    [
      receipt.publicationId, receipt.findingId, receipt.publicationRevision,
      receipt.thread.teamId, receipt.thread.channelId, receipt.thread.rootTs,
    ],
  );
  if (match.rows.length === 0) {
    return { recorded: false, reason: 'no matching publication for this thread and revision' };
  }

  await db.query(
    `INSERT INTO publication_receipts (
       publication_id, provider_ts, finding_id, publication_revision, thread_id, bot_user_id, observed_at, receipt)
     SELECT $1, $2, $3, $4, o.thread_id, $5, $6, $7::jsonb FROM outbox o WHERE o.id = $1
     ON CONFLICT (publication_id, provider_ts) DO NOTHING`,
    [
      receipt.publicationId, receipt.ts, receipt.findingId, receipt.publicationRevision,
      receipt.botUserId, receipt.observedAt, JSON.stringify(receipt),
    ],
  );
  return { recorded: true, reason: null };
}

/** The separately running publisher reads the same persisted records; no process-local cache. */
export function createReceiptReader(db: Queryable): PublicationReceiptReader {
  return {
    async find(publicationId: Id) {
      const result = await db.query<{ receipt: unknown }>(
        'SELECT receipt FROM publication_receipts WHERE publication_id = $1 ORDER BY observed_at DESC LIMIT 1',
        [publicationId],
      );
      const row = result.rows[0];
      return row ? (row.receipt as PublicationReceipt) : null;
    },
  };
}

export async function listDueOutboxIds(db: Queryable, limit: number): Promise<string[]> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM outbox
      WHERE next_attempt_at <= now()
        AND (status IN ('pending', 'retryable', 'uncertain')
             OR (status = 'sending' AND lease_until IS NOT NULL AND lease_until < now()))
      ORDER BY next_attempt_at LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => row.id);
}

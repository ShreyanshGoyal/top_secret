/** Row mappers. Persisted JSONB is re-validated on the way out, never trusted because it is ours. */
import { DecisionSchema, FindingSchema, InboundEventSchema, RepositoryReportSchema, validate } from '@accord/contracts';
import type { Decision, Finding, InboundEvent, RepositoryReport, ThreadRef } from '@accord/contracts';
import type { InvestigationRow, JobIntent, OutboxRow, ThreadRow } from './types.js';

export function isoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function iso(value: Date | string): string {
  const result = isoOrNull(value);
  if (result === null) throw new Error('expected a timestamp');
  return result;
}

export interface RawThread {
  id: string;
  team_id: string;
  channel_id: string;
  root_ts: string;
  enrolled: boolean;
  context_revision: number;
  active_decision_id: string | null;
  active_version: number | null;
  finding_message_ts: string | null;
}

export function toThreadRow(raw: RawThread): ThreadRow {
  return {
    id: raw.id,
    thread: { teamId: raw.team_id, channelId: raw.channel_id, rootTs: raw.root_ts },
    enrolled: raw.enrolled,
    contextRevision: raw.context_revision,
    activeDecisionId: raw.active_decision_id,
    activeVersion: raw.active_version,
    findingMessageTs: raw.finding_message_ts,
  };
}

export interface RawDecision {
  decision_id: string;
  version: number;
  team_id: string;
  channel_id: string;
  root_ts: string;
  context_revision: number;
  status: string;
  intent: unknown;
  intent_hash: string | null;
  owner_id: string;
  confirmed_by: string | null;
  confirmed_at: Date | null;
  source_message_ids: unknown;
  created_at: Date;
  updated_at: Date;
}

export function toDecision(raw: RawDecision): Decision {
  const thread: ThreadRef = { teamId: raw.team_id, channelId: raw.channel_id, rootTs: raw.root_ts };
  return validate(DecisionSchema, {
    id: raw.decision_id,
    thread,
    version: raw.version,
    contextRevision: raw.context_revision,
    status: raw.status,
    intent: raw.intent ?? null,
    ownerId: raw.owner_id,
    sourceMessageIds: raw.source_message_ids ?? [],
    intentHash: raw.intent_hash,
    confirmedBy: raw.confirmed_by,
    confirmedAt: isoOrNull(raw.confirmed_at),
    createdAt: iso(raw.created_at),
    updatedAt: iso(raw.updated_at),
  }, 'persisted Decision');
}

export function toFinding(payload: unknown): Finding {
  return validate(FindingSchema, payload, 'persisted Finding');
}

export function toInboundEvent(payload: unknown): InboundEvent {
  return validate(InboundEventSchema, payload, 'persisted InboundEvent');
}

export function toRepositoryReport(payload: unknown): RepositoryReport {
  return validate(RepositoryReportSchema, payload, 'persisted RepositoryReport');
}

export interface RawInvestigation {
  id: string;
  thread_id: string;
  decision_id: string;
  decision_version: number;
  context_revision: number;
  mode: string;
  dataset_version: string;
  as_of: string;
  status: string;
  attempt: number;
  trigger_run_id: string | null;
  error: string | null;
}

export function toInvestigationRow(raw: RawInvestigation): InvestigationRow {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    run: {
      investigationId: raw.id,
      decisionId: raw.decision_id,
      decisionVersion: raw.decision_version,
      contextRevision: raw.context_revision,
      datasetVersion: raw.dataset_version,
      asOf: raw.as_of,
      mode: raw.mode as 'baseline' | 'verify_pr',
    },
    status: raw.status as InvestigationRow['status'],
    attempt: raw.attempt,
    triggerRunId: raw.trigger_run_id,
    error: raw.error,
  };
}

export interface RawOutbox {
  id: string;
  thread_id: string;
  finding_id: string;
  payload: unknown;
  publication_revision: number;
  expected_version: number;
  expected_context: number;
  status: string;
  attempts: number;
  next_attempt_at: Date | null;
  lease_owner: string | null;
  lease_until: Date | null;
  delivered_ts: string | null;
}

export function toOutboxRow(raw: RawOutbox): OutboxRow {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    findingId: raw.finding_id,
    draft: raw.payload as OutboxRow['draft'],
    publicationRevision: raw.publication_revision,
    expectedVersion: raw.expected_version,
    expectedContextRevision: raw.expected_context,
    status: raw.status as OutboxRow['status'],
    attempts: raw.attempts,
    nextAttemptAt: isoOrNull(raw.next_attempt_at),
    leaseOwner: raw.lease_owner,
    leaseUntil: isoOrNull(raw.lease_until),
    deliveredTs: raw.delivered_ts,
  };
}

export interface RawJobIntent {
  id: string;
  logical_key: string;
  task_type: string;
  payload: unknown;
  status: string;
  trigger_run_id: string | null;
  attempts: number;
  next_attempt_at: Date | null;
}

export function toJobIntent(raw: RawJobIntent): JobIntent {
  return {
    id: raw.id,
    logicalKey: raw.logical_key,
    taskType: raw.task_type as JobIntent['taskType'],
    payload: (raw.payload ?? {}) as Record<string, unknown>,
    status: raw.status as JobIntent['status'],
    triggerRunId: raw.trigger_run_id,
    attempts: raw.attempts,
    nextAttemptAt: isoOrNull(raw.next_attempt_at),
  };
}

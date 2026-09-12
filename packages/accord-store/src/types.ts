/** @accord/store public type surface. Owner: Agent 1.
 * PostgreSQL is the durable authority. Only @accord/core and apps/worker consume this package;
 * Agents 2, 3 and 4 depend on @accord/contracts and the core ApplicationPort instead.
 */
import type {
  Decision, DecisionStatus, Finding, Id, InboundEvent, IsoTime, OwnerAction, Publication,
  PublicationReceipt, PublicationReceiptReader, RepositoryReport, RunContext, ThreadRef, ThreadView,
} from '@accord/contracts';

export interface StoreConfig {
  databaseUrl: string;
  maxConnections: number;
  statementTimeoutMs: number;
}

export interface ThreadRow {
  id: Id;
  thread: ThreadRef;
  enrolled: boolean;
  contextRevision: number;
  activeDecisionId: Id | null;
  activeVersion: number | null;
  findingMessageTs: string | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

export type JobTaskType = 'accord-process-context' | 'accord-investigate' | 'accord-publish' | 'accord-reconcile';

export interface JobIntent {
  id: Id;
  logicalKey: string;
  taskType: JobTaskType;
  payload: Record<string, unknown>;
  status: 'pending' | 'dispatched' | 'completed' | 'failed';
  triggerRunId: string | null;
  attempts: number;
  nextAttemptAt: IsoTime | null;
}

export type DeliveryStatus = 'pending' | 'sending' | 'delivered' | 'uncertain' | 'retryable' | 'permanent_failure' | 'superseded';

export interface OutboxRow {
  id: Id;
  threadId: Id;
  findingId: Id;
  publication: Publication;
  publicationRevision: number;
  expectedDecisionVersion: number;
  expectedContextRevision: number;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: IsoTime | null;
  leaseOwner: string | null;
  leaseUntil: IsoTime | null;
  deliveredTs: string | null;
}

export interface AcceptedEvent {
  duplicate: boolean;
  threadId: Id;
  contextRevision: number;
  jobIntent: JobIntent | null;
}

export type InvestigationStatus =
  | 'queued' | 'interpreting' | 'waiting_for_clarification' | 'investigating' | 'analyzing_impact'
  | 'verifying' | 'completed' | 'superseded' | 'failed' | 'cancelled';

export interface InvestigationRow {
  id: Id;
  run: RunContext;
  status: InvestigationStatus;
  attempt: number;
  triggerRunId: string | null;
  error: string | null;
}

/**
 * Every method is parameterized and transaction-aware. Callers never build SQL strings.
 * Methods that publish results compare decision version AND context revision inside one transaction.
 */
export interface StorePort {
  migrate(): Promise<{ appliedVersion: number }>;
  close(): Promise<void>;

  getThreadView(thread: ThreadRef): Promise<ThreadView>;
  acceptEvent(event: InboundEvent, options: { enrollIfMentioned: boolean }): Promise<AcceptedEvent>;

  getActiveDecision(threadId: Id): Promise<Decision | null>;
  appendDecisionVersion(input: { threadId: Id; decision: Omit<Decision, 'version'>; status: DecisionStatus }): Promise<Decision>;
  recordOwnerAction(action: OwnerAction, outcome: string): Promise<void>;

  createInvestigation(run: RunContext): Promise<InvestigationRow>;
  updateInvestigationStatus(investigationId: Id, status: InvestigationStatus, error?: string | null): Promise<void>;
  saveStepResult(input: { investigationId: Id; stepKey: string; inputHash: string; result: unknown }): Promise<void>;
  readStepResult(input: { investigationId: Id; stepKey: string; inputHash: string }): Promise<unknown | null>;
  saveBaselineReport(input: { decisionId: Id; decisionVersion: number; report: RepositoryReport }): Promise<void>;
  readBaselineReport(input: { decisionId: Id; decisionVersion: number }): Promise<RepositoryReport | null>;

  /** Saves the finding and its publication atomically, or returns superseded without writing. */
  commitFinding(input: { threadId: Id; finding: Finding; publication: Publication }): Promise<{ committed: boolean; reason: 'superseded' | null }>;

  claimDueOutboxRow(input: { leaseOwner: string; leaseMs: number; now: IsoTime }): Promise<OutboxRow | null>;
  completeDelivery(input: { outboxId: Id; status: DeliveryStatus; deliveredTs: string | null; error: string | null; nextAttemptAt: IsoTime | null }): Promise<void>;
  recordPublicationReceipt(receipt: PublicationReceipt): Promise<void>;
  receiptReader(): PublicationReceiptReader;

  enqueueJobIntent(intent: Omit<JobIntent, 'id' | 'status' | 'attempts' | 'triggerRunId'>): Promise<JobIntent>;
  markJobDispatched(intentId: Id, triggerRunId: string): Promise<void>;
  listPendingJobIntents(limit: number): Promise<JobIntent[]>;
}

export type StoreFactory = (config: StoreConfig) => Promise<StorePort>;

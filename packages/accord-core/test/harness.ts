/** Explicit test adapters. Every double is injected; nothing is selected by a missing key. */
import { AccordError, publicError } from '@accord/contracts';
import type {
  ClockPort, DeliveryResult, Evidence, ImpactPort, ImpactReport, InboundEvent, Interpretation,
  ModelPort, PolicyIntent, PrivacyPort, Publication, PublisherPort, RepositoryPort, RepositoryReport,
  RetentionProjection, RunContext, SafeLoggerPort, SlackMessage, ThreadRef, VerificationReport,
} from '@accord/contracts';
import { CONTRACT_VERSION, excerptHash } from '@accord/contracts';
import type { JobSchedulerPort } from '../src/types.js';
import { createFakeStore } from './fake-store.js';
import type { FakeStore } from './fake-store.js';

export const OWNER = 'U0OWNER';
export const ENGINEER = 'U0ENGINEER';
export const BOT = 'U0BOT';
export const AS_OF = '2026-09-12T00:00:00.000Z';
export const DATASET = 'accord-demo-2026-09-12';
export const REPOSITORY = { owner: 'ShreyanshGoyal', name: 'top_secret' };

export const THREAD: ThreadRef = { teamId: 'T0TEAM', channelId: 'C0CHANNEL', rootTs: '1757635200.000100' };

let sequence = 0;
export function message(text: string, authorId = OWNER): SlackMessage {
  sequence += 1;
  return {
    id: `${THREAD.teamId}:${THREAD.channelId}:1757635200.${String(sequence).padStart(6, '0')}`,
    ts: `1757635200.${String(sequence).padStart(6, '0')}`,
    authorId,
    text,
    permalink: null,
    editedTs: null,
  };
}

export function inbound(text: string, options: { authorId?: string; wasMention?: boolean; snapshot?: SlackMessage[]; snapshotComplete?: boolean } = {}): InboundEvent {
  const current = message(text, options.authorId ?? OWNER);
  return {
    contractVersion: CONTRACT_VERSION,
    eventKey: `Ev${current.ts}`,
    kind: 'message',
    thread: THREAD,
    message: current,
    snapshot: options.snapshot ?? [current],
    snapshotComplete: options.snapshotComplete ?? true,
    receivedAt: AS_OF,
    wasMention: options.wasMention ?? false,
  };
}

export const INTENT_90: PolicyIntent = {
  scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] },
  retentionDays: 90,
  appliesTo: 'currently_stored_records',
  effective: 'immediate',
};

export function interpretation(overrides: Partial<Interpretation> = {}): Interpretation {
  return {
    disposition: 'propose',
    intent: null,
    sourceMessageIds: [],
    question: null,
    explanation: 'test',
    pullRequestUrl: null,
    expectedDecisionVersion: null,
    ...overrides,
  };
}

export const PROJECTION_30: RetentionProjection = { schemaVersion: 1, defaultDays: 30, rules: [] };

export function evidence(id: string): Evidence {
  const excerpt = '{"defaultDays":30}';
  return {
    id,
    kind: 'code',
    summary: 'generated retention policy',
    locator: 'https://github.com/ShreyanshGoyal/top_secret/blob/0123456789abcdef0123456789abcdef01234567/fixtures/retention-app/policy.generated.json',
    excerpt,
    excerptHash: excerptHash(excerpt),
    capturedAt: AS_OF,
    repository: REPOSITORY,
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    path: 'fixtures/retention-app/policy.generated.json',
    startLine: 1,
    endLine: 3,
  };
}

export function repositoryReport(run: RunContext, overrides: Partial<RepositoryReport> = {}): RepositoryReport {
  return {
    run,
    target: {
      repository: REPOSITORY,
      sha: '0123456789abcdef0123456789abcdef01234567',
      baseSha: null,
      pullRequestNumber: null,
      pullRequestUrl: null,
      pathPrefix: 'fixtures/retention-app/',
    },
    conclusion: 'conflict',
    observedProjection: PROJECTION_30,
    sourceProjection: PROJECTION_30,
    generatorConsistency: 'consistent',
    trustedRuntime: 'matched',
    sourcePaths: ['fixtures/retention-app/retention.idl'],
    generatedPaths: ['fixtures/retention-app/policy.generated.json'],
    trace: [],
    evidence: [evidence('code:policy:1-3')],
    unknowns: [],
    summary: 'cleanup selects the intended scope after 30 days',
    ...overrides,
  };
}

export function impactReport(run: RunContext, overrides: Partial<ImpactReport> = {}): ImpactReport {
  return {
    run,
    status: 'complete',
    eligibleAccounts: 6,
    eligibleRecords: 19,
    observedSelectedInScope: 9,
    intendedSelectedInScope: 2,
    prematurelySelectedRecords: 7,
    prematurelySelectedAccounts: 2,
    overRetainedRecords: 0,
    outOfScopeChangedRecords: 0,
    observedSelectedTotal: 17,
    intendedSelectedTotal: 10,
    queryId: 'accord-query-0001',
    observedAt: AS_OF,
    evidence: [],
    error: null,
    ...overrides,
  };
}

export function fixedClock(now = AS_OF): ClockPort {
  return { now: () => now };
}

export function silentLogger(): SafeLoggerPort & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    info: (event) => { events.push(event); },
    error: (event) => { events.push(`error:${event}`); },
  };
}

/** Deliberately strict: it enforces the configured audience the way the real port must. */
export function testPrivacy(): PrivacyPort {
  return {
    sanitize: (input) => input.replace(/xox[abprs]-[A-Za-z0-9-]+/g, '[redacted]'),
    assertAudience: ({ thread, repository, datasetVersion }) => {
      if (thread.teamId !== THREAD.teamId || thread.channelId !== THREAD.channelId) {
        throw new AccordError(publicError('FORBIDDEN', 'thread outside the configured audience'));
      }
      if (repository.owner !== REPOSITORY.owner || repository.name !== REPOSITORY.name) {
        throw new AccordError(publicError('FORBIDDEN', 'repository outside the allowlist'));
      }
      if (datasetVersion !== DATASET) {
        throw new AccordError(publicError('FORBIDDEN', 'dataset outside the allowlist'));
      }
    },
    assertAllowedPath: (path) => {
      if (!path.startsWith('fixtures/retention-app/')) {
        throw new AccordError(publicError('FORBIDDEN', 'path outside the allowed prefix'));
      }
    },
  };
}

export function fakeModel(replies: (Interpretation | Error)[]): ModelPort & { calls: number } {
  let index = 0;
  const port = {
    calls: 0,
    async interpret(): Promise<Interpretation> {
      port.calls += 1;
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      if (reply instanceof Error) throw reply;
      if (!reply) throw new AccordError(publicError('PROVIDER_ERROR', 'no reply configured'));
      return reply;
    },
  };
  return port;
}

export function fakeScheduler(): JobSchedulerPort & { dispatched: string[] } {
  const dispatched: string[] = [];
  return {
    dispatched,
    async dispatch(intent) {
      dispatched.push(intent.logicalKey);
      return { triggerRunId: `run_${dispatched.length}` };
    },
  };
}

export interface RepositoryStub {
  inspect?: (input: { run: RunContext }) => Promise<RepositoryReport>;
  verify?: (input: { run: RunContext }) => Promise<VerificationReport>;
  sha?: string;
}

export function fakeRepository(stub: RepositoryStub = {}): RepositoryPort {
  return {
    async resolveTarget(input) {
      return {
        repository: input.repository,
        sha: stub.sha ?? '0123456789abcdef0123456789abcdef01234567',
        baseSha: input.pullRequestUrl ? '0123456789abcdef0123456789abcdef01234567' : null,
        pullRequestNumber: input.pullRequestUrl ? 7 : null,
        pullRequestUrl: input.pullRequestUrl,
        pathPrefix: input.pathPrefix,
      };
    },
    async inspect(input) {
      return stub.inspect ? stub.inspect(input) : repositoryReport(input.run);
    },
    async verify(input) {
      if (stub.verify) return stub.verify(input);
      throw new AccordError(publicError('UNSUPPORTED', 'no verification configured'));
    },
  };
}

export function fakeImpact(analyze?: (run: RunContext) => Promise<ImpactReport>): ImpactPort {
  return {
    async analyze(input) {
      return analyze ? analyze(input.run) : impactReport(input.run);
    },
  };
}

export function fakePublisher(results: DeliveryResult[], reconcileResult: { status: 'found'; ts: string } | { status: 'not_found' | 'unknown' } = { status: 'unknown' }): PublisherPort & { sent: Publication[] } {
  let index = 0;
  const sent: Publication[] = [];
  return {
    sent,
    async deliver(publication) {
      sent.push(publication);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      return result ?? { status: 'delivered', ts: '1757635300.000100' };
    },
    async reconcile() {
      return reconcileResult;
    },
  };
}

export interface Harness {
  store: FakeStore;
  scheduler: ReturnType<typeof fakeScheduler>;
  logger: ReturnType<typeof silentLogger>;
}

export function baseDeps(options: { store?: FakeStore } = {}) {
  const store = options.store ?? createFakeStore();
  const scheduler = fakeScheduler();
  const logger = silentLogger();
  return {
    store,
    scheduler,
    logger,
    privacy: testPrivacy(),
    clock: fixedClock(),
    ownerId: OWNER,
    botUserId: BOT,
    repositoryTarget: { ...REPOSITORY, ref: 'main', pathPrefix: 'fixtures/retention-app/' },
    dataset: { version: DATASET, asOf: AS_OF },
  };
}

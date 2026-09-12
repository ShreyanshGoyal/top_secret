/** Contract-valid example values, for tests and cross-owner fixtures only.
 * Imported through the '@accord/contracts/examples' subpath; never from the package root,
 * so no production entrypoint can pick these up by accident. They are inert data, not behavior.
 */
import { excerptHash, policyIntentHash } from './canonical.js';
import type {
  Decision, Evidence, ImpactReport, InboundEvent, Interpretation, PolicyIntent, Publication,
  RepositoryReport, RetentionProjection, RunContext, SlackMessage, ThreadRef, ThreadView,
} from './types.js';
import { CONTRACT_VERSION } from './types.js';

export const DEMO_AS_OF = '2026-09-12T00:00:00.000Z';
export const DEMO_DATASET_VERSION = 'accord-demo-2026-09-12';

export const exampleThread: ThreadRef = {
  teamId: 'T0EXAMPLE00',
  channelId: 'C0EXAMPLE00',
  rootTs: '1757635200.000100',
};

export const exampleOwnerId = 'U0OWNEREXAMPLE';

export const exampleMessage: SlackMessage = {
  id: 'T0EXAMPLE00:C0EXAMPLE00:1757635200.000100',
  ts: '1757635200.000100',
  authorId: exampleOwnerId,
  text: 'Free verified university accounts get 90 days for existing records now.',
  permalink: null,
  editedTs: null,
};

export const exampleInboundEvent: InboundEvent = {
  contractVersion: CONTRACT_VERSION,
  eventKey: 'Ev0EXAMPLE0001',
  kind: 'message',
  thread: exampleThread,
  message: exampleMessage,
  snapshot: [exampleMessage],
  snapshotComplete: true,
  receivedAt: '2026-09-12T00:00:01.000Z',
  wasMention: true,
};

export const exampleIntent: PolicyIntent = {
  scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] },
  retentionDays: 90,
  appliesTo: 'currently_stored_records',
  effective: 'immediate',
};

export const exampleDecision: Decision = {
  id: '11111111-1111-4111-8111-111111111111',
  thread: exampleThread,
  version: 1,
  contextRevision: 1,
  status: 'confirmed',
  intent: exampleIntent,
  ownerId: exampleOwnerId,
  sourceMessageIds: [exampleMessage.id],
  intentHash: policyIntentHash(exampleIntent),
  confirmedBy: exampleOwnerId,
  confirmedAt: '2026-09-12T00:00:02.000Z',
  createdAt: '2026-09-12T00:00:02.000Z',
  updatedAt: '2026-09-12T00:00:02.000Z',
};

export const exampleInterpretation: Interpretation = {
  disposition: 'confirm',
  intent: exampleIntent,
  sourceMessageIds: [exampleMessage.id],
  question: null,
  explanation: 'Owner stated a complete retention change for currently stored records with immediate effect.',
  pullRequestUrl: null,
  expectedDecisionVersion: null,
};

export const exampleRun: RunContext = {
  investigationId: '22222222-2222-4222-8222-222222222222',
  decisionId: exampleDecision.id,
  decisionVersion: 1,
  contextRevision: 1,
  datasetVersion: DEMO_DATASET_VERSION,
  asOf: DEMO_AS_OF,
  mode: 'baseline',
};

export const exampleBaselineProjection: RetentionProjection = {
  schemaVersion: 1,
  defaultDays: 30,
  rules: [],
};

const exampleExcerpt = '{"schemaVersion":1,"defaultDays":30,"rules":[]}';

export const exampleCodeEvidence: Evidence = {
  id: 'code:retention-policy.generated.json:1-20',
  kind: 'code',
  summary: 'Generated retention policy data used by the cleanup selector.',
  locator: 'https://github.com/example/example/blob/0123456789abcdef0123456789abcdef01234567/fixtures/retention-app/policy.generated.json#L1-L20',
  excerpt: exampleExcerpt,
  excerptHash: excerptHash(exampleExcerpt),
  capturedAt: '2026-09-12T00:00:10.000Z',
  repository: { owner: 'example', name: 'example' },
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  path: 'fixtures/retention-app/policy.generated.json',
  startLine: 1,
  endLine: 20,
};

export const exampleRepositoryReport: RepositoryReport = {
  run: exampleRun,
  target: {
    repository: { owner: 'example', name: 'example' },
    sha: '0123456789abcdef0123456789abcdef01234567',
    baseSha: null,
    pullRequestNumber: null,
    pullRequestUrl: null,
    pathPrefix: 'fixtures/retention-app/',
  },
  conclusion: 'conflict',
  observedProjection: exampleBaselineProjection,
  sourceProjection: exampleBaselineProjection,
  generatorConsistency: 'consistent',
  trustedRuntime: 'matched',
  sourcePaths: ['fixtures/retention-app/retention.idl'],
  generatedPaths: ['fixtures/retention-app/policy.generated.json'],
  trace: [],
  evidence: [exampleCodeEvidence],
  unknowns: [],
  summary: 'Cleanup selection still applies the 30-day default to the intended scope.',
};

export const exampleImpactReport: ImpactReport = {
  run: exampleRun,
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
  observedAt: '2026-09-12T00:00:20.000Z',
  evidence: [],
  error: null,
};

export const exampleFindingId = '33333333-3333-4333-8333-333333333333';

export const examplePublication: Publication = {
  id: '44444444-4444-4444-8444-444444444444',
  thread: exampleThread,
  findingId: exampleFindingId,
  decisionVersion: 1,
  contextRevision: 1,
  revision: 1,
  text: `Accord finding ${exampleFindingId} · update 1 · delivery 44444444-4444-4444-8444-444444444444`,
  existingTs: null,
};

export const exampleThreadView: ThreadView = {
  thread: exampleThread,
  enrolled: true,
  contextRevision: 1,
  decision: exampleDecision,
  finding: {
    id: exampleFindingId,
    decisionId: exampleDecision.id,
    decisionVersion: 1,
    contextRevision: 1,
    run: exampleRun,
    status: 'confirmed_conflict',
    title: 'Cleanup selects university records before the confirmed 90-day retention',
    summary: 'Observed cleanup behavior applies 30 days to free verified university accounts.',
    question: null,
    repository: exampleRepositoryReport,
    impact: exampleImpactReport,
    verification: null,
    evidence: [exampleCodeEvidence],
    limitations: ['Deployment state is unverified.'],
    updatedAt: '2026-09-12T00:00:25.000Z',
  },
  publicationPending: true,
};

/** A thread Accord has never seen. Reading it must not create state. */
export const exampleEmptyThreadView: ThreadView = {
  thread: { teamId: 'T0EXAMPLE00', channelId: 'C0EXAMPLE00', rootTs: '1757635999.000100' },
  enrolled: false,
  contextRevision: 0,
  decision: null,
  finding: null,
  publicationPending: false,
};

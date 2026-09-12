import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Decision, Evidence, ImpactReport, RepositoryReport, ThreadRef, ThreadView } from '@accord/contracts';
import { CONTRACT_VERSION, policyIntentHash } from '@accord/contracts';
import { escapeSlackText, formatScope, renderFinding } from '../src/renderer.js';

const exampleThread: ThreadRef = {
  teamId: 'T0EXAMPLE00',
  channelId: 'C0EXAMPLE00',
  rootTs: '1757635200.000100',
};

const exampleFindingId = '33333333-3333-4333-8333-333333333333';
const exampleDecisionId = '11111111-1111-4111-8111-111111111111';

const exampleIntent = {
  scope: { plans: ['free' as const], organizationTypes: ['university' as const], universityVerified: [true] },
  retentionDays: 90,
  appliesTo: 'currently_stored_records' as const,
  effective: 'immediate' as const,
};

const exampleDecision: Decision = {
  id: exampleDecisionId,
  thread: exampleThread,
  version: 1,
  contextRevision: 1,
  status: 'confirmed',
  intent: exampleIntent,
  ownerId: 'U0OWNEREXAMPLE',
  sourceMessageIds: ['T0EXAMPLE00:C0EXAMPLE00:1757635200.000100'],
  intentHash: policyIntentHash(exampleIntent),
  confirmedBy: 'U0OWNEREXAMPLE',
  confirmedAt: '2026-09-12T00:00:02.000Z',
  createdAt: '2026-09-12T00:00:02.000Z',
  updatedAt: '2026-09-12T00:00:02.000Z',
};

const exampleRun = {
  investigationId: '22222222-2222-4222-8222-222222222222',
  decisionId: exampleDecisionId,
  decisionVersion: 1,
  contextRevision: 1,
  datasetVersion: 'accord-demo-2026-09-12',
  asOf: '2026-09-12T00:00:00.000Z',
  mode: 'baseline' as const,
};

const exampleCodeEvidence: Evidence = {
  id: 'code:retention-policy.generated.json:1-20',
  kind: 'code',
  summary: 'Generated retention policy data used by the cleanup selector.',
  locator: 'https://github.com/example/example/blob/0123456789abcdef0123456789abcdef01234567/fixtures/retention-app/policy.generated.json#L1-L20',
  excerpt: '{"schemaVersion":1,"defaultDays":30,"rules":[]}',
  excerptHash: '3203490b8f44d8528994a3bc6c06a88b5ec1e67cf5e40a08e162f43c3a9f02fe',
  capturedAt: '2026-09-12T00:00:10.000Z',
  repository: { owner: 'example', name: 'example' },
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  path: 'fixtures/retention-app/policy.generated.json',
  startLine: 1,
  endLine: 20,
};

const exampleRepositoryReport: RepositoryReport = {
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
  observedProjection: { schemaVersion: 1, defaultDays: 30, rules: [] },
  sourceProjection: { schemaVersion: 1, defaultDays: 30, rules: [] },
  generatorConsistency: 'consistent',
  trustedRuntime: 'matched',
  sourcePaths: ['fixtures/retention-app/retention.idl'],
  generatedPaths: ['fixtures/retention-app/policy.generated.json'],
  trace: [],
  evidence: [exampleCodeEvidence],
  unknowns: [],
  summary: 'Cleanup selection still applies the 30-day default to the intended scope.',
};

const exampleImpactReport: ImpactReport = {
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

const exampleThreadView: ThreadView = {
  thread: exampleThread,
  enrolled: true,
  contextRevision: 1,
  decision: exampleDecision,
  finding: {
    id: exampleFindingId,
    decisionId: exampleDecisionId,
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

const exampleEmptyThreadView: ThreadView = {
  thread: { teamId: 'T0EXAMPLE00', channelId: 'C0EXAMPLE00', rootTs: '1757635999.000100' },
  enrolled: false,
  contextRevision: 0,
  decision: null,
  finding: null,
  publicationPending: false,
};

describe('escapeSlackText', () => {
  it('escapes Slack broadcast and mention delimiters', () => {
    const raw = '<@U12345> check <!here> and <!channel> & <https://evil.com|link>';
    const escaped = escapeSlackText(raw);
    assert.strictEqual(escaped, '&lt;@U12345&gt; check &lt;!here&gt; and &lt;!channel&gt; &amp; &lt;https://evil.com|link&gt;');
  });
});

describe('formatScope', () => {
  it('formats free verified university scope', () => {
    const s = formatScope({ plans: ['free'], organizationTypes: ['university'], universityVerified: [true] }, 90);
    assert.strictEqual(s, 'Free verified university accounts should retain existing records for 90 days.');
  });
});

describe('renderFinding', () => {
  it('renders unenrolled or empty thread view cleanly', () => {
    const text = renderFinding(exampleEmptyThreadView);
    assert.ok(text.includes('Accord is following this thread'));
  });

  it('renders confirmed conflict with exact counts (S11 assertion)', () => {
    const text = renderFinding(exampleThreadView, '44444444-4444-4444-8444-444444444444');
    assert.ok(text.includes('Confirmed implementation conflict · decision v1'));
    assert.ok(text.includes('Free verified university accounts should retain existing records for 90 days.'));
    assert.ok(text.includes('7 currently stored demo records across 2 accounts would be selected too early'));
    assert.ok(!text.includes('0 currently stored demo records'));
    assert.ok(text.includes('Evidence:'));
    assert.ok(text.includes('Checked commit 0123456; deployment unverified.'));
    assert.ok(text.includes(`Accord finding ${exampleFindingId} · update 1 · delivery 44444444-4444-4444-8444-444444444444`));
  });

  it('handles null impact counts without substituting zero (S11)', () => {
    const nullImpactView: ThreadView = {
      ...exampleThreadView,
      finding: {
        ...exampleThreadView.finding!,
        impact: {
          ...exampleImpactReport,
          status: 'unavailable',
          prematurelySelectedRecords: null,
          prematurelySelectedAccounts: null,
        },
      },
    };
    const text = renderFinding(nullImpactView);
    assert.ok(text.includes('Data impact unverified; stored-record counts unavailable. No records were deleted.'));
    assert.ok(!text.includes('0 currently stored'));
  });

  it('renders needs_clarification with question', () => {
    const view: ThreadView = {
      ...exampleThreadView,
      finding: {
        ...exampleThreadView.finding!,
        status: 'needs_clarification',
        question: 'Does this apply to unpaid students?',
        impact: null,
        repository: null,
      },
    };
    const text = renderFinding(view);
    assert.ok(text.includes('Potential conflict; scope not confirmed · decision v1'));
    assert.ok(text.includes('Clarification needed: Does this apply to unpaid students?'));
  });

  it('renders conditional_impact for tentative decisions', () => {
    const view: ThreadView = {
      ...exampleThreadView,
      decision: {
        ...exampleDecision,
        status: 'tentative',
      },
      finding: {
        ...exampleThreadView.finding!,
        status: 'conditional_impact',
      },
    };
    const text = renderFinding(view);
    assert.ok(text.includes('Conditional assessment; decision tentative · decision v1'));
  });

  it('renders no_conflict when implementation aligns', () => {
    const view: ThreadView = {
      ...exampleThreadView,
      finding: {
        ...exampleThreadView.finding!,
        status: 'no_conflict',
        repository: {
          ...exampleRepositoryReport,
          conclusion: 'aligned',
        },
      },
    };
    const text = renderFinding(view);
    assert.ok(text.includes('No conflict found for this scope at this commit · decision v1'));
  });

  it('renders verified_at_commit with unverified deployment warning', () => {
    const view: ThreadView = {
      ...exampleThreadView,
      finding: {
        ...exampleThreadView.finding!,
        status: 'verified_at_commit',
        verification: {
          run: exampleThreadView.finding!.run!,
          target: exampleRepositoryReport.target,
          verdict: 'verified_at_commit',
          checks: [
            { name: 'idl_digest', status: 'pass', explanation: 'Authoritative IDL matches digest', evidenceIds: [] },
          ],
          deployment: 'unverified',
          evidence: [],
        },
      },
    };
    const text = renderFinding(view);
    assert.ok(text.includes('Supported behavior verified at exact commit · decision v1'));
    assert.ok(text.includes('deployment unverified'));
  });

  it('renders withdrawn decision', () => {
    const view: ThreadView = {
      ...exampleThreadView,
      finding: {
        ...exampleThreadView.finding!,
        status: 'withdrawn',
        impact: null,
        repository: null,
      },
    };
    const text = renderFinding(view);
    assert.ok(text.includes('Triggering decision withdrawn; previous finding no longer active · decision v1'));
  });
});

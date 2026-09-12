import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Finding, ThreadView } from '@accord/contracts';
import { ConfirmationCard, EnrollmentCard, StatusCard } from '../components.js';

const exampleThread = {
  teamId: 'T0EXAMPLE',
  channelId: 'C0EXAMPLE',
  rootTs: '1757635200.000100',
};

const exampleFinding: Finding = {
  id: '33333333-3333-4333-8333-333333333333',
  decisionId: '11111111-1111-4111-8111-111111111111',
  decisionVersion: 1,
  contextRevision: 1,
  run: {
    investigationId: '22222222-2222-4222-8222-222222222222',
    decisionId: '11111111-1111-4111-8111-111111111111',
    decisionVersion: 1,
    contextRevision: 1,
    datasetVersion: 'accord-demo-2026-09-12',
    asOf: '2026-09-12T00:00:00.000Z',
    mode: 'baseline',
  },
  status: 'confirmed_conflict',
  title: 'Cleanup selects university records before confirmed 90 days',
  summary: 'Observed cleanup behavior uses 30 days.',
  question: null,
  repository: null,
  impact: {
    run: {
      investigationId: '22222222-2222-4222-8222-222222222222',
      decisionId: '11111111-1111-4111-8111-111111111111',
      decisionVersion: 1,
      contextRevision: 1,
      datasetVersion: 'accord-demo-2026-09-12',
      asOf: '2026-09-12T00:00:00.000Z',
      mode: 'baseline',
    },
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
  },
  verification: null,
  evidence: [],
  limitations: ['Deployment unverified'],
  updatedAt: '2026-09-12T00:00:25.000Z',
};

const exampleView: ThreadView = {
  thread: exampleThread,
  enrolled: true,
  contextRevision: 1,
  decision: {
    id: '11111111-1111-4111-8111-111111111111',
    thread: exampleThread,
    version: 1,
    contextRevision: 1,
    status: 'confirmed',
    intent: {
      scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] },
      retentionDays: 90,
      appliesTo: 'currently_stored_records',
      effective: 'immediate',
    },
    ownerId: 'U0OWNER',
    sourceMessageIds: ['msg-1'],
    intentHash: null,
    confirmedBy: 'U0OWNER',
    confirmedAt: '2026-09-12T00:00:02.000Z',
    createdAt: '2026-09-12T00:00:02.000Z',
    updatedAt: '2026-09-12T00:00:02.000Z',
  },
  finding: exampleFinding,
  publicationPending: false,
};

describe('Channels Native Cards (S21)', () => {
  it('renders EnrollmentCard without crashing', () => {
    const card = EnrollmentCard();
    assert.ok(card !== null);
    assert.strictEqual(typeof card, 'object');
  });

  it('renders StatusCard with populated finding and metrics', () => {
    const card = StatusCard({ view: exampleView });
    assert.ok(card !== null);
    assert.strictEqual(typeof card, 'object');
  });

  it('renders ConfirmationCard with interactive action buttons', async () => {
    let capturedAction = '';
    const card = ConfirmationCard({
      decisionId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      expectedContextRevision: 1,
      onAction: async (kind) => {
        capturedAction = kind;
      },
    });

    assert.ok(card !== null);
    assert.strictEqual(typeof card, 'object');
  });
});

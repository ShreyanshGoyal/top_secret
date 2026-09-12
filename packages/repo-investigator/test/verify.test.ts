import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Decision,
  PolicyIntent,
  ProviderDependencies,
  RepositoryConfig,
  RunContext,
} from '@accord/contracts';
import { createRepositoryPort } from '../src/index.js';
import { LocalScenarioGitHubClient } from './mock-github.js';

const FAKE_LOGGER = { info: () => {}, error: () => {} };
const FAKE_CLOCK = { now: () => '2026-09-12T00:00:00.000Z' };
const FAKE_PRIVACY = { sanitizeText: (t: string) => t, assertAudience: () => {} };

const DEPS: ProviderDependencies = {
  logger: FAKE_LOGGER,
  clock: FAKE_CLOCK,
  privacy: FAKE_PRIVACY as any,
};

const CONFIG: RepositoryConfig = {
  repository: { owner: 'ShreyanshGoyal', name: 'top_secret' },
  pathPrefix: 'fixtures/retention-app',
  githubToken: 'ghp_dummytoken123456789012345678901234',
  openAIKey: 'sk-dummykey123456789012345678901234',
  model: 'gpt-4o',
  trustedProfileVersion: '1.0.0',
};

const INTENT: PolicyIntent = {
  scope: {
    plans: ['free'],
    organizationTypes: ['university'],
    universityVerified: [true],
  },
  retentionDays: 90,
  appliesTo: 'currently_stored_records',
  effective: 'immediate',
};

const DECISION: Decision = {
  id: '11111111-1111-4111-8111-111111111111',
  thread: { teamId: 'T1', channelId: 'C1', rootTs: '1726140000.000100' },
  version: 1,
  contextRevision: 1,
  status: 'confirmed',
  intent: INTENT,
  ownerId: 'U_OWNER',
  sourceMessageIds: ['m1'],
  intentHash: 'hash-001',
  confirmedBy: 'U_OWNER',
  confirmedAt: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const BASELINE_RUN: RunContext = {
  investigationId: '22222222-2222-4222-8222-222222222222',
  decisionId: '11111111-1111-4111-8111-111111111111',
  decisionVersion: 1,
  contextRevision: 1,
  datasetVersion: 'v1',
  asOf: '2026-09-12T00:00:00.000Z',
  mode: 'baseline',
};

const VERIFY_RUN: RunContext = {
  investigationId: '33333333-3333-4333-8333-333333333333',
  decisionId: '11111111-1111-4111-8111-111111111111',
  decisionVersion: 1,
  contextRevision: 2,
  datasetVersion: 'v1',
  asOf: '2026-09-12T00:00:00.000Z',
  mode: 'verify_pr',
};

async function inspectScenario(scenarioName: string, run: RunContext) {
  const client = new LocalScenarioGitHubClient('2222222222222222222222222222222222222222');
  client.loadScenario(scenarioName);
  const port = createRepositoryPort(CONFIG, DEPS, client);
  const target = await port.resolveTarget({
    repository: CONFIG.repository,
    ref: 'candidate-branch',
    pullRequestUrl: 'https://github.com/ShreyanshGoyal/top_secret/pull/42',
    pathPrefix: CONFIG.pathPrefix,
  });
  return port.inspect({
    run,
    decision: DECISION,
    target,
  });
}

test('PR verification suite (R04 - R09)', async () => {
  const baselineReport = await inspectScenario('baseline', BASELINE_RUN);
  const port = createRepositoryPort(CONFIG, DEPS, new LocalScenarioGitHubClient());

  // R07: Correct PR passes all checks and is verified_at_commit
  const correctCandidate = await inspectScenario('correct', VERIFY_RUN);
  const correctResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: correctCandidate,
  });
  assert.equal(correctResult.verdict, 'verified_at_commit');
  assert.equal(correctResult.deployment, 'unverified');
  assert.ok(correctResult.checks.every((c) => c.status === 'pass'));

  // R04: UI-only PR rejected as still_conflicting
  const uiOnlyCandidate = await inspectScenario('ui-only', VERIFY_RUN);
  const uiOnlyResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: uiOnlyCandidate,
  });
  assert.equal(uiOnlyResult.verdict, 'still_conflicting');

  // R05: Generated-only PR rejected as non_durable
  const genOnlyCandidate = await inspectScenario('generated-only', VERIFY_RUN);
  const genOnlyResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: genOnlyCandidate,
  });
  assert.equal(genOnlyResult.verdict, 'non_durable');

  // R06: Source-only PR rejected as still_conflicting
  const srcOnlyCandidate = await inspectScenario('source-only', VERIFY_RUN);
  const srcOnlyResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: srcOnlyCandidate,
  });
  assert.equal(srcOnlyResult.verdict, 'still_conflicting');

  // R08: Overbroad PR rejected as scope_regression
  const overbroadCandidate = await inspectScenario('overbroad', VERIFY_RUN);
  const overbroadResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: overbroadCandidate,
  });
  assert.equal(overbroadResult.verdict, 'scope_regression');

  // R09: Unknown runtime rejected as insufficient_evidence
  const unknownRuntimeCandidate = await inspectScenario('unknown-runtime', VERIFY_RUN);
  const unknownResult = await port.verify({
    run: VERIFY_RUN,
    decision: DECISION,
    baseline: baselineReport,
    candidate: unknownRuntimeCandidate,
  });
  assert.equal(unknownResult.verdict, 'insufficient_evidence');
});

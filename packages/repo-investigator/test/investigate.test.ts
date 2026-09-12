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

const FAKE_LOGGER = {
  info: () => {},
  error: () => {},
};

const FAKE_CLOCK = {
  now: () => '2026-09-12T00:00:00.000Z',
};

const FAKE_PRIVACY = {
  sanitizeText: (t: string) => t,
  assertAudience: () => {},
};

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

const RUN: RunContext = {
  investigationId: '22222222-2222-4222-8222-222222222222',
  decisionId: '11111111-1111-4111-8111-111111111111',
  decisionVersion: 1,
  contextRevision: 1,
  datasetVersion: 'v1',
  asOf: '2026-09-12T00:00:00.000Z',
  mode: 'baseline',
};

test('R01: resolveTarget resolves to immutable full SHA and rejects branch drift', async () => {
  const client = new LocalScenarioGitHubClient('abcdefabcdefabcdefabcdefabcdefabcdefabcd');
  const port = createRepositoryPort(CONFIG, DEPS, client);

  const target = await port.resolveTarget({
    repository: CONFIG.repository,
    ref: 'main',
    pullRequestUrl: null,
    pathPrefix: CONFIG.pathPrefix,
  });

  assert.equal(target.sha, 'abcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(target.baseSha, null);
  assert.equal(target.pullRequestNumber, null);
});

test('R03: baseline inspection traces full source-to-cleanup path and finds conflict', async () => {
  const client = new LocalScenarioGitHubClient();
  client.loadScenario('baseline');
  const port = createRepositoryPort(CONFIG, DEPS, client);

  const target = await port.resolveTarget({
    repository: CONFIG.repository,
    ref: 'main',
    pullRequestUrl: null,
    pathPrefix: CONFIG.pathPrefix,
  });

  const report = await port.inspect({
    run: RUN,
    decision: DECISION,
    target,
  });

  assert.equal(report.conclusion, 'conflict');
  assert.equal(report.trustedRuntime, 'matched');
  assert.equal(report.generatorConsistency, 'consistent');
  assert.equal(report.observedProjection?.defaultDays, 30);

  // Verify trace edges
  const edgeRelations = report.trace.map((e) => e.relationship).sort();
  assert.deepEqual(edgeRelations, ['calls', 'generates', 'imports']);

  // Verify evidence items exist
  assert.ok(report.evidence.length >= 3);
  for (const ev of report.evidence) {
    assert.match(ev.locator, /^https:\/\/github\.com\/ShreyanshGoyal\/top_secret\/blob\//);
    assert.ok(ev.excerpt.length > 0);
  }
});

test('R02: override inspection finds aligned runtime behavior with default30 preserved', async () => {
  const client = new LocalScenarioGitHubClient();
  client.loadScenario('override');
  const port = createRepositoryPort(CONFIG, DEPS, client);

  const target = await port.resolveTarget({
    repository: CONFIG.repository,
    ref: 'main',
    pullRequestUrl: null,
    pathPrefix: CONFIG.pathPrefix,
  });

  const report = await port.inspect({
    run: RUN,
    decision: DECISION,
    target,
  });

  assert.equal(report.conclusion, 'aligned');
  assert.equal(report.trustedRuntime, 'matched');
  assert.equal(report.generatorConsistency, 'consistent');
  assert.equal(report.observedProjection?.defaultDays, 30);
  assert.equal(report.observedProjection?.rules[0]?.days, 90);
});

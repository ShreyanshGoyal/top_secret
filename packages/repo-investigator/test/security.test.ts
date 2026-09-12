import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProviderDependencies, RepositoryConfig } from '@accord/contracts';
import { createRepositoryPort, isPathBlocked } from '../src/index.js';
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

test('R12: blocked sensitive paths are strictly blocked from tool reading', () => {
  assert.equal(isPathBlocked('.env'), true);
  assert.equal(isPathBlocked('.env.local'), true);
  assert.equal(isPathBlocked('server.key'), true);
  assert.equal(isPathBlocked('cert.pem'), true);
  assert.equal(isPathBlocked('id_rsa'), true);
  assert.equal(isPathBlocked('credentials.json'), true);
  assert.equal(isPathBlocked('node_modules/pkg/index.js'), true);
  assert.equal(isPathBlocked('fixtures/retention-app/src/cleanup.ts'), false);
});

test('R15: cross-repo PR URL is rejected before credentialed fetch', async () => {
  const port = createRepositoryPort(CONFIG, DEPS, new LocalScenarioGitHubClient());

  await assert.rejects(async () => {
    await port.resolveTarget({
      repository: CONFIG.repository,
      ref: 'main',
      pullRequestUrl: 'https://github.com/Attacker/other_repo/pull/1',
      pathPrefix: CONFIG.pathPrefix,
    });
  }, /Cross-repository PR rejected/);

  // Rejects invalid hosts and schemes
  await assert.rejects(async () => {
    await port.resolveTarget({
      repository: CONFIG.repository,
      ref: 'main',
      pullRequestUrl: 'https://malicious.com/ShreyanshGoyal/top_secret/pull/1',
      pathPrefix: CONFIG.pathPrefix,
    });
  }, /Invalid GitHub pull request URL/);

  // Rejects credentials in PR URL
  await assert.rejects(async () => {
    await port.resolveTarget({
      repository: CONFIG.repository,
      ref: 'main',
      pullRequestUrl: 'https://user:pass@github.com/ShreyanshGoyal/top_secret/pull/1',
      pathPrefix: CONFIG.pathPrefix,
    });
  }, /Invalid GitHub pull request URL/);
});

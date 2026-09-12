import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccordError } from '@accord/contracts';
import { assertAllowedPath, createPrivacyPort, createSafeLogger, sanitizeText } from '../src/index.js';

const config = {
  teamId: 'T-allowed', channelId: 'C-allowed', repository: { owner: 'ShreyanshGoyal', name: 'top_secret' },
  datasetVersion: 'accord-demo-2026-09-12', knownSecretValues: ['ACCORD_TEST_SECRET_DO_NOT_DISCLOSE_known-value'],
};

test('sanitization redacts configured, recognizable and synthetic secrets without changing line count', () => {
  const source = 'one\nACCORD_TEST_SECRET_DO_NOT_DISCLOSE_known-value\nghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456\nsk-proj-abcdefghijklmnopqrst\nfive';
  const sanitized = sanitizeText(source, config.knownSecretValues);
  assert.equal(sanitized.split('\n').length, source.split('\n').length);
  assert.equal(sanitized.includes('known-value'), false);
  assert.equal(sanitized.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'), false);
  assert.equal(sanitized.includes('abcdefghijklmnopqrst'), false);
  const privateKey = 'before\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\nafter';
  assert.equal(sanitizeText(privateKey, []).split('\n').length, privateKey.split('\n').length);
});

test('audience mismatches fail before a credentialed provider can be selected', () => {
  const privacy = createPrivacyPort(config);
  privacy.assertAudience({ thread: { teamId: 'T-allowed', channelId: 'C-allowed', rootTs: '1757635200.000100' }, repository: config.repository, datasetVersion: config.datasetVersion });
  assert.throws(() => privacy.assertAudience({ thread: { teamId: 'T-other', channelId: 'C-allowed', rootTs: '1757635200.000100' }, repository: config.repository, datasetVersion: config.datasetVersion }), AccordError);
  assert.throws(() => privacy.assertAudience({ thread: { teamId: 'T-allowed', channelId: 'C-allowed', rootTs: '1757635200.000100' }, repository: { owner: 'other', name: 'repo' }, datasetVersion: config.datasetVersion }), AccordError);
});

test('secret paths are rejected while the explicit generated policy path remains inspectable', () => {
  for (const path of ['.env', 'fixtures/.env.local', 'keys/service.pem', '../outside', '.ssh/id_rsa', 'credentials/token.json']) assert.throws(() => assertAllowedPath(path), AccordError);
  assert.doesNotThrow(() => assertAllowedPath('fixtures/retention-app/generated/retention-policy.json'));
  assert.doesNotThrow(() => assertAllowedPath('fixtures/retention-app/src/cleanup.ts'));
});

test('safe logger cannot pass raw message or secret-shaped text into its sink', () => {
  const entries: unknown[] = [];
  const logger = createSafeLogger({ component: 'privacy-test', sink: { write(entry) { entries.push(entry); } } });
  logger.info('privacy.redaction', { phase: 'before-model', rawMessage: 'ACCORD_TEST_SECRET_DO_NOT_DISCLOSE_suffix', code: 'FORBIDDEN' } as never);
  assert.deepEqual(entries, [{ level: 'info', event: 'privacy.redaction', fields: { component: 'privacy-test', phase: 'before-model', code: 'FORBIDDEN' } }]);
});

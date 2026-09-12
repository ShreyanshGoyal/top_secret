import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImpactPort } from '@accord/data-impact';
import { createPrivacyPort } from '@accord/privacy';
import type { ImpactRequest } from '@accord/contracts';

const required = ['CLICKHOUSE_URL', 'CLICKHOUSE_DATABASE', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'ACCORD_DATASET_VERSION'];
const missing = required.filter((name) => !process.env[name]);
const integration = missing.length > 0 ? test.skip : test;
const run = { investigationId: '22222222-2222-4222-8222-222222222222', decisionId: '11111111-1111-4111-8111-111111111111', decisionVersion: 1, contextRevision: 1, datasetVersion: process.env.ACCORD_DATASET_VERSION ?? 'missing-dataset', asOf: '2026-09-12T00:00:00.000Z', mode: 'baseline' as const };
const request: ImpactRequest = { run, intent: { scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] }, retentionDays: 90, appliesTo: 'currently_stored_records', effective: 'immediate' }, observedProjection: { schemaVersion: 1, defaultDays: 30, rules: [] }, baselineProjection: { schemaVersion: 1, defaultDays: 30, rules: [] }, repositoryEvidenceIds: ['code:policy'] };

integration(`real ClickHouse fixture returns the required aggregates${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`, async () => {
  const privacy = createPrivacyPort({ teamId: 'T-test', channelId: 'C-test', repository: { owner: 'ShreyanshGoyal', name: 'top_secret' }, datasetVersion: run.datasetVersion, knownSecretValues: [process.env.CLICKHOUSE_PASSWORD ?? ''] });
  const impact = createImpactPort({ url: process.env.CLICKHOUSE_URL!, database: process.env.CLICKHOUSE_DATABASE!, username: process.env.CLICKHOUSE_USER!, password: process.env.CLICKHOUSE_PASSWORD!, allowedDatasetVersion: run.datasetVersion }, { privacy, clock: { now: () => '2026-09-12T00:00:20.000Z' }, logger: { info: () => undefined, error: () => undefined } });
  const report = await impact.analyze(request);
  assert.equal(report.status, 'complete'); assert.equal(report.eligibleAccounts, 2); assert.equal(report.eligibleRecords, 11); assert.equal(report.observedSelectedInScope, 9); assert.equal(report.intendedSelectedInScope, 2); assert.equal(report.prematurelySelectedRecords, 7); assert.equal(report.prematurelySelectedAccounts, 2); assert.equal(report.observedSelectedTotal, 17); assert.equal(report.intendedSelectedTotal, 10);
});

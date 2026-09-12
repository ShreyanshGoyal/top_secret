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

async function runtimeQuery(sql: string): Promise<Response> {
  const url = new URL(process.env.CLICKHOUSE_URL!);
  url.searchParams.set('database', process.env.CLICKHOUSE_DATABASE!);
  return fetch(url, {
    method: 'POST',
    body: sql,
    headers: {
      authorization: `Basic ${Buffer.from(`${process.env.CLICKHOUSE_USER!}:${process.env.CLICKHOUSE_PASSWORD!}`).toString('base64')}`,
    },
  });
}

integration(`real ClickHouse fixture returns the required aggregates${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`, async () => {
  const privacy = createPrivacyPort({ teamId: 'T-test', channelId: 'C-test', repository: { owner: 'ShreyanshGoyal', name: 'top_secret' }, datasetVersion: run.datasetVersion, knownSecretValues: [process.env.CLICKHOUSE_PASSWORD ?? ''] });
  const impact = createImpactPort({ url: process.env.CLICKHOUSE_URL!, database: process.env.CLICKHOUSE_DATABASE!, username: process.env.CLICKHOUSE_USER!, password: process.env.CLICKHOUSE_PASSWORD!, allowedDatasetVersion: run.datasetVersion }, { privacy, clock: { now: () => '2026-09-12T00:00:20.000Z' }, logger: { info: () => undefined, error: () => undefined } });
  const report = await impact.analyze(request);
  assert.equal(report.status, 'complete'); assert.equal(report.eligibleAccounts, 2); assert.equal(report.eligibleRecords, 11); assert.equal(report.observedSelectedInScope, 9); assert.equal(report.intendedSelectedInScope, 2); assert.equal(report.prematurelySelectedRecords, 7); assert.equal(report.prematurelySelectedAccounts, 2); assert.equal(report.observedSelectedTotal, 17); assert.equal(report.intendedSelectedTotal, 10);
});

integration('runtime ClickHouse identity is restricted to the approved view', async () => {
  // The INSERT has a zero-row SELECT, making the check non-mutating even if a
  // role configuration regresses. `readonly = 1` is ClickHouse's server-side
  // enforcement for DDL and all other write-capable statements.
  for (const [label, sql] of [
    ['source table', 'SELECT count() FROM accord_demo.records'],
    ['private table', 'SELECT count() FROM accord_demo.accord_private_operator_notes'],
    ['write', "INSERT INTO accord_demo.accord_private_operator_notes SELECT 'permission-probe' WHERE 0"],
  ] as const) {
    const response = await runtimeQuery(sql);
    await response.arrayBuffer();
    assert.equal(response.ok, false, `runtime identity unexpectedly has ${label} access`);
  }
  const readOnly = await runtimeQuery("SELECT value FROM system.settings WHERE name = 'readonly'");
  assert.equal(readOnly.ok, true);
  assert.equal((await readOnly.text()).trim(), '1');
});

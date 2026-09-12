import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { AccordError } from '@accord/contracts';
import type { ImpactRequest, ProviderDependencies } from '@accord/contracts';
import { createImpactPort } from '../src/index.js';

const run = { investigationId: '22222222-2222-4222-8222-222222222222', decisionId: '11111111-1111-4111-8111-111111111111', decisionVersion: 1, contextRevision: 1, datasetVersion: 'accord-demo-2026-09-12', asOf: '2026-09-12T00:00:00.000Z', mode: 'baseline' as const };
const request: ImpactRequest = { run, intent: { scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] }, retentionDays: 90, appliesTo: 'currently_stored_records', effective: 'immediate' }, observedProjection: { schemaVersion: 1, defaultDays: 30, rules: [] }, baselineProjection: { schemaVersion: 1, defaultDays: 30, rules: [] }, repositoryEvidenceIds: ['code:policy'] };
const deps: ProviderDependencies = {
  clock: { now: () => '2026-09-12T00:00:20.000Z' },
  privacy: { sanitize: (text) => text, assertAudience: () => undefined, assertAllowedPath: () => undefined },
  logger: { info: () => undefined, error: () => undefined },
};
const aggregate = { eligible_accounts: '2', eligible_records: '11', observed_selected_in_scope: '9', intended_selected_in_scope: '2', prematurely_selected_records: '7', prematurely_selected_accounts: '2', over_retained_records: '0', out_of_scope_changed_records: '0', observed_selected_total: '17', intended_selected_total: '10' };

async function withServer(handler: Parameters<typeof createServer>[0], action: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('test server did not bind');
  try { await action(`http://127.0.0.1:${address.port}`); } finally { server.close(); await once(server, 'close'); }
}
function port(url: string) { return createImpactPort({ url, database: 'accord_demo', username: 'runtime', password: 'not-a-real-secret', allowedDatasetVersion: run.datasetVersion }, deps); }

test('uses a fixed parameterized aggregate query and returns ClickHouse-derived counts', async () => {
  await withServer((req, res) => {
    assert.equal(req.method, 'POST'); assert.match(req.url ?? '', /query_id=/); assert.match(req.url ?? '', /param_dataset_version=accord-demo-2026-09-12/); assert.match(req.headers.authorization ?? '', /^Basic /);
    let sql = ''; req.on('data', (chunk) => { sql += chunk; }); req.on('end', () => { assert.match(sql, /FROM accord_retention_view/); assert.equal(sql.includes('DROP'), false); res.setHeader('content-type', 'application/json'); res.end(`${JSON.stringify(aggregate)}\n`); });
  }, async (url) => {
    const report = await port(url).analyze(request);
    assert.equal(report.status, 'complete'); assert.equal(report.prematurelySelectedRecords, 7); assert.equal(report.observedSelectedTotal, 17); assert.equal(report.intendedSelectedTotal, 10);
    assert.match(report.evidence[0]?.locator ?? '', /^accord-query:/);
  });
});

test('retries exactly once for a transient provider failure', async () => {
  let calls = 0;
  await withServer((_req, res) => { calls += 1; if (calls === 1) { res.statusCode = 503; res.end('temporary'); } else res.end(`${JSON.stringify(aggregate)}\n`); }, async (url) => {
    const report = await port(url).analyze(request); assert.equal(calls, 2); assert.equal(report.status, 'complete');
  });
});

test('a permanent data failure reports null counts rather than zero', async () => {
  await withServer((_req, res) => { res.statusCode = 401; res.end('denied'); }, async (url) => {
    const report = await port(url).analyze(request); assert.equal(report.status, 'unavailable'); assert.equal(report.eligibleRecords, null); assert.equal(report.prematurelySelectedRecords, null); assert.equal(report.error?.code, 'AUTH');
  });
});

test('wrong dataset is forbidden before a ClickHouse request', async () => {
  let calls = 0;
  await withServer((_req, res) => { calls += 1; res.end(`${JSON.stringify(aggregate)}\n`); }, async (url) => {
    await assert.rejects(() => port(url).analyze({ ...request, run: { ...run, datasetVersion: 'foreign-dataset' } }), AccordError);
    assert.equal(calls, 0);
  });
});

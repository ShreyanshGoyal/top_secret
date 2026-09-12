import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isEligibleForCleanup } from '@accord/contracts';

type Account = { accountId: string; plan: string; organizationType: string; universityVerified: boolean };
type Record = { recordId: string; accountId: string; createdAt: string };
const asOf = '2026-09-12T00:00:00.000Z';
const accounts = JSON.parse(await readFile('infra/clickhouse/seed/accounts.json', 'utf8')) as Account[];
const records = JSON.parse(await readFile('infra/clickhouse/seed/records.json', 'utf8')) as Record[];
const byId = new Map(accounts.map((account) => [account.accountId, account]));
const target = (record: Record) => { const account = byId.get(record.accountId); return account?.plan === 'free' && account.organizationType === 'university' && account.universityVerified; };
const selected = (days: number, scopedDays?: number) => records.filter((record) => isEligibleForCleanup(record.createdAt, asOf, target(record) && scopedDays ? scopedDays : days));

test('the immutable seed has the exact retention boundary fixture', () => {
  assert.equal(accounts.length, 6); assert.equal(records.length, 19); assert.equal(records.filter(target).length, 11);
  assert.deepEqual(selected(30).map((record) => record.recordId), ['a01-r31', 'a01-r89', 'a01-r90', 'a01-r91', 'a02-r31', 'a02-r60', 'a02-r89', 'a02-r90', 'a02-r91', 'a03-r31', 'a03-r91', 'a04-r31', 'a04-r91', 'a05-r31', 'a05-r91', 'a06-r31', 'a06-r91']);
  assert.equal(selected(30, 90).length, 10);
  const premature = selected(30).filter((record) => target(record) && !isEligibleForCleanup(record.createdAt, asOf, 90));
  assert.deepEqual(premature.map((record) => record.recordId), ['a01-r31', 'a01-r89', 'a01-r90', 'a02-r31', 'a02-r60', 'a02-r89', 'a02-r90']);
  assert.equal(isEligibleForCleanup(records.find((record) => record.recordId === 'a01-r30')!.createdAt, asOf, 30), false);
  assert.equal(isEligibleForCleanup(records.find((record) => record.recordId === 'a01-r90')!.createdAt, asOf, 90), false);
});

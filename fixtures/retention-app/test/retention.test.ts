import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRetentionDays,
  isCleanupEligible,
  dryRunCleanup,
  getRetentionPolicyDisplay
} from '../src/index.js';
import type { AccountRecord, DataRecord } from '@accord/retention-fixture';

const AS_OF = '2026-09-12T00:00:00.000Z';

const ACCOUNTS: AccountRecord[] = [
  { id: 'a01', plan: 'free', organizationType: 'university', universityVerified: true },
  { id: 'a02', plan: 'free', organizationType: 'university', universityVerified: true },
  { id: 'a03', plan: 'free', organizationType: 'university', universityVerified: false },
  { id: 'a04', plan: 'paid', organizationType: 'university', universityVerified: true },
  { id: 'a05', plan: 'free', organizationType: 'company', universityVerified: true },
  { id: 'a06', plan: 'free', organizationType: 'personal', universityVerified: false },
];

function makeRecord(accountId: string, daysAgo: number, epsilonMs = 0): DataRecord {
  const asOfMs = Date.parse(AS_OF);
  const createdMs = asOfMs - (daysAgo * 86400 * 1000) - epsilonMs;
  return {
    id: `${accountId}-r${daysAgo}`,
    accountId,
    createdAt: new Date(createdMs).toISOString()
  };
}

const RECORDS: DataRecord[] = [
  makeRecord('a01', 29),
  makeRecord('a01', 30),
  makeRecord('a01', 31),
  makeRecord('a01', 89),
  makeRecord('a01', 90),
  makeRecord('a01', 91),
  makeRecord('a02', 31),
  makeRecord('a02', 60),
  makeRecord('a02', 89),
  makeRecord('a02', 90),
  makeRecord('a02', 91),
  makeRecord('a03', 31),
  makeRecord('a03', 91),
  makeRecord('a04', 31),
  makeRecord('a04', 91),
  makeRecord('a05', 31),
  makeRecord('a05', 91),
  makeRecord('a06', 31),
  makeRecord('a06', 91),
];

test('retention app baseline dry run produces exactly 17 selected records and 9 target records', () => {
  const selected = dryRunCleanup(ACCOUNTS, RECORDS, AS_OF);
  assert.equal(selected.length, 17, 'Baseline selected total must be 17');

  const targetIds = new Set(['a01', 'a02']);
  const targetSelected = selected.filter(id => targetIds.has(id.split('-')[0]));
  assert.equal(targetSelected.length, 9, 'Target accounts must have 9 selected records under baseline');
});

test('retention app display policy is independent of cleanup execution', () => {
  const display = getRetentionPolicyDisplay(ACCOUNTS[0]);
  assert.match(display, /30-day standard retention/);
});

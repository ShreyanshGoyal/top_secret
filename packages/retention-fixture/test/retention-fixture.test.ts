import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRetentionPolicy,
  resolveRetentionDays,
  isCleanupEligible,
  dryRunCleanup,
  computeSourcePolicyHash,
  verifyGeneratorConsistency,
  GENERATOR_VERSION
} from '../src/index.js';
import type { AccountRecord, DataRecord } from '../src/index.js';

const AS_OF = '2026-09-12T00:00:00.000Z';

// 6 canonical accounts from 01-SHARED-CONTRACTS
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

// 19 canonical records from 01-SHARED-CONTRACTS lines 141-146
const RECORDS: DataRecord[] = [
  // a01: 29, 30, 31, 89, 90, 91
  makeRecord('a01', 29),
  makeRecord('a01', 30),
  makeRecord('a01', 31),
  makeRecord('a01', 89),
  makeRecord('a01', 90),
  makeRecord('a01', 91),
  // a02: 31, 60, 89, 90, 91
  makeRecord('a02', 31),
  makeRecord('a02', 60),
  makeRecord('a02', 89),
  makeRecord('a02', 90),
  makeRecord('a02', 91),
  // a03: 31, 91
  makeRecord('a03', 31),
  makeRecord('a03', 91),
  // a04: 31, 91
  makeRecord('a04', 31),
  makeRecord('a04', 91),
  // a05: 31, 91
  makeRecord('a05', 31),
  makeRecord('a05', 91),
  // a06: 31, 91
  makeRecord('a06', 31),
  makeRecord('a06', 91),
];

const BASELINE_POLICY = parseRetentionPolicy({
  schemaVersion: 1,
  defaultDays: 30,
  rules: []
});

const TARGET_OVERRIDE_POLICY = parseRetentionPolicy({
  schemaVersion: 1,
  defaultDays: 30,
  rules: [
    {
      id: 'verified-university-free',
      scope: {
        plans: ['free'],
        organizationTypes: ['university'],
        universityVerified: [true]
      },
      days: 90
    }
  ]
});

test('baseline policy resolves 30 days for all accounts', () => {
  for (const account of ACCOUNTS) {
    assert.equal(resolveRetentionDays(account, BASELINE_POLICY), 30);
  }
});

test('target override policy resolves 90 days only for verified university free accounts', () => {
  assert.equal(resolveRetentionDays(ACCOUNTS[0], TARGET_OVERRIDE_POLICY), 90);
  assert.equal(resolveRetentionDays(ACCOUNTS[1], TARGET_OVERRIDE_POLICY), 90);
  assert.equal(resolveRetentionDays(ACCOUNTS[2], TARGET_OVERRIDE_POLICY), 30);
  assert.equal(resolveRetentionDays(ACCOUNTS[3], TARGET_OVERRIDE_POLICY), 30);
  assert.equal(resolveRetentionDays(ACCOUNTS[4], TARGET_OVERRIDE_POLICY), 30);
  assert.equal(resolveRetentionDays(ACCOUNTS[5], TARGET_OVERRIDE_POLICY), 30);
});

test('boundary age evaluation retains exact day cutoff', () => {
  const acc = ACCOUNTS[0];
  // Under 30 days: age 29 and 30 are retained; age 31 is eligible
  const r29 = makeRecord('a01', 29);
  const r30 = makeRecord('a01', 30);
  const r31 = makeRecord('a01', 31);
  assert.equal(isCleanupEligible(acc, r29, AS_OF, BASELINE_POLICY), false);
  assert.equal(isCleanupEligible(acc, r30, AS_OF, BASELINE_POLICY), false);
  assert.equal(isCleanupEligible(acc, r31, AS_OF, BASELINE_POLICY), true);

  // Epsilon boundary: exactly at 30 days vs 30 days + 1ms
  const r30Exact = makeRecord('a01', 30, 0);
  const r30Plus1ms = makeRecord('a01', 30, 1);
  assert.equal(isCleanupEligible(acc, r30Exact, AS_OF, BASELINE_POLICY), false);
  assert.equal(isCleanupEligible(acc, r30Plus1ms, AS_OF, BASELINE_POLICY), true);

  // Under 90 days: age 89 and 90 are retained; age 91 is eligible
  const r89 = makeRecord('a01', 89);
  const r90 = makeRecord('a01', 90);
  const r91 = makeRecord('a01', 91);
  assert.equal(isCleanupEligible(acc, r89, AS_OF, TARGET_OVERRIDE_POLICY), false);
  assert.equal(isCleanupEligible(acc, r90, AS_OF, TARGET_OVERRIDE_POLICY), false);
  assert.equal(isCleanupEligible(acc, r91, AS_OF, TARGET_OVERRIDE_POLICY), true);
});

test('future-dated record is rejected as invalid input', () => {
  const futureRecord: DataRecord = {
    id: 'future-r1',
    accountId: 'a01',
    createdAt: '2026-09-12T00:00:01.000Z'
  };
  assert.throws(() => {
    isCleanupEligible(ACCOUNTS[0], futureRecord, AS_OF, BASELINE_POLICY);
  }, /Future-dated record rejected/);
});

test('dryRunCleanup matches canonical 19-record numbers exactly', () => {
  // Baseline dry run
  const baselineSelected = dryRunCleanup(ACCOUNTS, RECORDS, AS_OF, BASELINE_POLICY);
  assert.equal(baselineSelected.length, 17, 'Baseline selected total must be 17');
  
  const targetIds = new Set(['a01', 'a02']);
  const baselineTargetSelected = baselineSelected.filter(id => targetIds.has(id.split('-')[0]));
  assert.equal(baselineTargetSelected.length, 9, 'Baseline target selected must be 9');

  // Intended override dry run
  const intendedSelected = dryRunCleanup(ACCOUNTS, RECORDS, AS_OF, TARGET_OVERRIDE_POLICY);
  assert.equal(intendedSelected.length, 10, 'Intended selected total must be 10');

  const intendedTargetSelected = intendedSelected.filter(id => targetIds.has(id.split('-')[0]));
  assert.equal(intendedTargetSelected.length, 2, 'Intended target selected must be 2 (a01-r91, a02-r91)');

  // Premature records: in baseline target but NOT in intended target
  const premature = baselineTargetSelected.filter(id => !intendedTargetSelected.includes(id)).sort();
  assert.equal(premature.length, 7, 'Premature records count must be 7 across 2 accounts');
  assert.deepEqual(premature, [
    'a01-r31', 'a01-r89', 'a01-r90',
    'a02-r31', 'a02-r60', 'a02-r89', 'a02-r90'
  ]);
});

test('generator consistency verification detects source-only and generated-only drift', () => {
  const sourceHash = computeSourcePolicyHash(TARGET_OVERRIDE_POLICY);
  const validEnvelope = {
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: sourceHash,
    policy: TARGET_OVERRIDE_POLICY
  };

  // Valid match
  assert.equal(verifyGeneratorConsistency(TARGET_OVERRIDE_POLICY, validEnvelope).consistent, true);

  // Generated-only change: source is baseline, envelope is override
  const generatedOnlyEnvelope = {
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: sourceHash,
    policy: TARGET_OVERRIDE_POLICY
  };
  const genOnlyRes = verifyGeneratorConsistency(BASELINE_POLICY, generatedOnlyEnvelope);
  assert.equal(genOnlyRes.consistent, false);
  assert.match(genOnlyRes.reason || '', /Source hash mismatch/);

  // Source-only change: source is override, envelope has old baseline policy
  const sourceOnlyEnvelope = {
    generatorVersion: GENERATOR_VERSION,
    sourceSha256: computeSourcePolicyHash(BASELINE_POLICY),
    policy: BASELINE_POLICY
  };
  const srcOnlyRes = verifyGeneratorConsistency(TARGET_OVERRIDE_POLICY, sourceOnlyEnvelope);
  assert.equal(srcOnlyRes.consistent, false);
  assert.match(srcOnlyRes.reason || '', /Source hash mismatch/);
});

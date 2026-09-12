/** The transition table from 02-AGENT-1-CORE section 6, plus the authority rules it rests on. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { policyIntentHash } from '@accord/contracts';
import type { Decision } from '@accord/contracts';
import { authorize, isAllowedPullRequestUrl, isMaterialChange } from '../src/index.js';
import { ENGINEER, INTENT_90, OWNER, REPOSITORY, THREAD, interpretation } from './harness.js';

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    thread: THREAD,
    version: 1,
    contextRevision: 1,
    status: 'confirmed',
    intent: INTENT_90,
    ownerId: OWNER,
    sourceMessageIds: [],
    intentHash: policyIntentHash(INTENT_90),
    confirmedBy: OWNER,
    confirmedAt: '2026-09-12T00:00:00.000Z',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

const base = { ownerId: OWNER, current: null, snapshotComplete: true };

test('non-owner proposing 90 days becomes a candidate awaiting owner approval', () => {
  const outcome = authorize({
    ...base,
    actorId: ENGINEER,
    interpretation: interpretation({ disposition: 'confirm', intent: INTENT_90 }),
  });
  assert.equal(outcome.kind, 'decision');
  assert.equal(outcome.kind === 'decision' && outcome.status, 'candidate');
  assert.equal(outcome.kind === 'decision' && outcome.downgraded, true);
  assert.match(outcome.reason, /non-owner/);
});

test('owner stating a complete intent confirms it', () => {
  const outcome = authorize({ ...base, actorId: OWNER, interpretation: interpretation({ disposition: 'confirm', intent: INTENT_90 }) });
  assert.equal(outcome.kind === 'decision' && outcome.status, 'confirmed');
  assert.equal(outcome.kind === 'decision' && outcome.downgraded, false);
});

test('owner marking it tentative produces a tentative version, not a confirmed one', () => {
  const outcome = authorize({
    ...base,
    actorId: OWNER,
    current: decision(),
    interpretation: interpretation({ disposition: 'tentative', intent: null }),
  });
  assert.equal(outcome.kind === 'decision' && outcome.status, 'tentative');
});

test('a non-owner amendment cannot silently replace owner authority', () => {
  const broader = { ...INTENT_90, scope: { ...INTENT_90.scope, plans: ['free', 'paid'] as ('free' | 'paid')[] } };
  const outcome = authorize({
    ...base,
    actorId: ENGINEER,
    current: decision(),
    interpretation: interpretation({ disposition: 'confirm', intent: broader }),
  });
  assert.equal(outcome.kind === 'decision' && outcome.status, 'candidate');
  assert.equal(outcome.kind === 'decision' && outcome.intent, broader);
});

test('owner withdrawal produces a withdrawn version', () => {
  const outcome = authorize({ ...base, actorId: OWNER, current: decision(), interpretation: interpretation({ disposition: 'withdraw' }) });
  assert.equal(outcome.kind === 'decision' && outcome.status, 'withdrawn');
});

test('repeating the same confirmed statement is not a material change', () => {
  const current = decision();
  assert.equal(isMaterialChange(current, 'confirmed', INTENT_90), false);
  assert.equal(isMaterialChange(current, 'tentative', INTENT_90), true);
  assert.equal(isMaterialChange(current, 'confirmed', { ...INTENT_90, retentionDays: 91 }), true);
  assert.equal(isMaterialChange(null, 'confirmed', INTENT_90), true);
});

test('a bare yes against an older version is refused, with the current interpretation asked for', () => {
  const outcome = authorize({
    ...base,
    actorId: OWNER,
    current: decision({ version: 3 }),
    interpretation: interpretation({ disposition: 'confirm', intent: null, expectedDecisionVersion: 2 }),
  });
  assert.equal(outcome.kind, 'clarify');
  assert.match(outcome.kind === 'clarify' ? outcome.reason : '', /older decision version/);
});

test('a bare yes against the current version confirms it', () => {
  const outcome = authorize({
    ...base,
    actorId: OWNER,
    current: decision({ version: 3 }),
    interpretation: interpretation({ disposition: 'confirm', intent: null, expectedDecisionVersion: 3 }),
  });
  assert.equal(outcome.kind === 'decision' && outcome.status, 'confirmed');
});

test('a linked pull request asks for verification, never success', () => {
  const outcome = authorize({
    ...base,
    actorId: ENGINEER,
    current: decision(),
    interpretation: interpretation({ disposition: 'verify_pr', pullRequestUrl: 'https://github.com/ShreyanshGoyal/top_secret/pull/7' }),
  });
  assert.equal(outcome.kind, 'verify');
});

test('only the configured repository is an allowed verification target', () => {
  assert.equal(isAllowedPullRequestUrl('https://github.com/ShreyanshGoyal/top_secret/pull/7', REPOSITORY), true);
  assert.equal(isAllowedPullRequestUrl('https://github.com/someone/else/pull/7', REPOSITORY), false);
  assert.equal(isAllowedPullRequestUrl('https://gitlab.com/ShreyanshGoyal/top_secret/pull/7', REPOSITORY), false);
  assert.equal(isAllowedPullRequestUrl('http://github.com/ShreyanshGoyal/top_secret/pull/7', REPOSITORY), false);
  assert.equal(isAllowedPullRequestUrl('https://github.com/ShreyanshGoyal/top_secret/pull/abc', REPOSITORY), false);
  assert.equal(isAllowedPullRequestUrl('not a url', REPOSITORY), false);
});

test('an incomplete thread snapshot never confirms from an absent antecedent', () => {
  const outcome = authorize({
    ownerId: OWNER,
    actorId: OWNER,
    current: null,
    snapshotComplete: false,
    interpretation: interpretation({ disposition: 'confirm', intent: null }),
  });
  assert.equal(outcome.kind, 'clarify');
});

test('tentative language without any complete intent asks a focused question', () => {
  const outcome = authorize({ ...base, actorId: OWNER, interpretation: interpretation({ disposition: 'tentative', intent: null }) });
  assert.equal(outcome.kind, 'clarify');
  assert.equal(outcome.kind === 'clarify' && outcome.downgraded, true);
});

test('irrelevant chat changes nothing and a status request creates no version', () => {
  assert.equal(authorize({ ...base, actorId: ENGINEER, interpretation: interpretation({ disposition: 'irrelevant' }) }).kind, 'ignore');
  assert.equal(authorize({ ...base, actorId: ENGINEER, interpretation: interpretation({ disposition: 'status' }) }).kind, 'status');
});

test('confirming a withdrawn decision asks for a restatement instead', () => {
  const outcome = authorize({
    ...base,
    actorId: OWNER,
    current: decision({ status: 'withdrawn' }),
    interpretation: interpretation({ disposition: 'confirm', intent: null }),
  });
  assert.equal(outcome.kind, 'clarify');
});

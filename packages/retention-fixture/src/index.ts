/** @accord/retention-fixture — trusted policy parser, resolver, cleanup eligibility and dry-run evaluator.
 * Owner: Agent 3, branch accord/repository. Pure functions only: no network, no database, no deletions.
 */
import {
  canonicalJson,
  canonicalizeScope,
  isEligibleForCleanup,
  RetentionProjectionSchema,
  scopeMatches,
  sha256Hex,
} from '@accord/contracts';
import type {
  OrganizationType,
  Plan,
  RetentionProjection,
  RetentionRule,
  Scope,
} from '@accord/contracts';

export const GENERATOR_VERSION = 'accord-retention-generator/1' as const;

export interface AccountRecord {
  id: string;
  plan: Plan;
  organizationType: OrganizationType;
  universityVerified: boolean;
}

export interface DataRecord {
  id: string;
  accountId: string;
  createdAt: string; // ISO 8601 string
}

export interface GeneratorEnvelope {
  generatorVersion: typeof GENERATOR_VERSION | string;
  sourceSha256: string;
  policy: RetentionProjection;
}

export interface GeneratorConsistencyResult {
  consistent: boolean;
  reason?: string;
}

/** Strictly parse and validate a raw retention projection against the normative schema. */
export function parseRetentionPolicy(raw: unknown): RetentionProjection {
  const parsed = RetentionProjectionSchema.parse(raw);
  return {
    schemaVersion: parsed.schemaVersion,
    defaultDays: parsed.defaultDays,
    rules: parsed.rules.map((rule) => ({
      id: rule.id,
      scope: canonicalizeScope(rule.scope),
      days: rule.days,
    })),
  };
}

/** Resolve effective retention days for an account using first-matching rule, falling back to defaultDays. */
export function resolveRetentionDays(account: AccountRecord, projection: RetentionProjection): number {
  for (const rule of projection.rules) {
    if (scopeMatches(rule.scope, account)) {
      return rule.days;
    }
  }
  return projection.defaultDays;
}

/** Evaluates whether a record is eligible for cleanup as of a given reference time. */
export function isCleanupEligible(
  account: AccountRecord,
  record: DataRecord,
  asOf: string,
  projection: RetentionProjection,
): boolean {
  if (record.accountId !== account.id) {
    throw new Error(`Record accountId mismatch: ${record.accountId} !== ${account.id}`);
  }
  const createdMs = Date.parse(record.createdAt);
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(createdMs) || Number.isNaN(asOfMs)) {
    throw new Error('isCleanupEligible: invalid ISO timestamp');
  }
  if (createdMs > asOfMs) {
    throw new Error(`Future-dated record rejected: createdAt (${record.createdAt}) > asOf (${asOf})`);
  }
  const days = resolveRetentionDays(account, projection);
  return isEligibleForCleanup(record.createdAt, asOf, days);
}

/** Pure dry-run simulation of cleanup. Returns sorted selected record IDs without mutating data. */
export function dryRunCleanup(
  accounts: readonly AccountRecord[],
  records: readonly DataRecord[],
  asOf: string,
  projection: RetentionProjection,
): string[] {
  const accountMap = new Map<string, AccountRecord>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc);
  }

  const selectedIds: string[] = [];
  for (const record of records) {
    const account = accountMap.get(record.accountId);
    if (!account) {
      throw new Error(`Orphan record detected: account ${record.accountId} not found for record ${record.id}`);
    }
    if (isCleanupEligible(account, record, asOf, projection)) {
      selectedIds.push(record.id);
    }
  }

  return selectedIds.sort();
}

/** Computes canonical SHA-256 hash of normalized source policy IDL. */
export function computeSourcePolicyHash(policy: RetentionProjection): string {
  const normalized: RetentionProjection = {
    schemaVersion: policy.schemaVersion,
    defaultDays: policy.defaultDays,
    rules: policy.rules.map((rule) => ({
      id: rule.id,
      scope: canonicalizeScope(rule.scope),
      days: rule.days,
    })),
  };
  return sha256Hex(canonicalJson(normalized));
}

/** Verifies generator version, source hash, and policy matching between source IDL and generated envelope. */
export function verifyGeneratorConsistency(
  sourcePolicy: RetentionProjection,
  envelope: GeneratorEnvelope,
): GeneratorConsistencyResult {
  if (envelope.generatorVersion !== GENERATOR_VERSION) {
    return {
      consistent: false,
      reason: `Generator version mismatch: expected '${GENERATOR_VERSION}', got '${envelope.generatorVersion}'`,
    };
  }

  const expectedSourceSha = computeSourcePolicyHash(sourcePolicy);
  if (envelope.sourceSha256 !== expectedSourceSha) {
    return {
      consistent: false,
      reason: `Source hash mismatch: IDL hash is ${expectedSourceSha}, envelope claims ${envelope.sourceSha256}`,
    };
  }

  const sourceCanonical = canonicalJson(parseRetentionPolicy(sourcePolicy));
  const envelopeCanonical = canonicalJson(parseRetentionPolicy(envelope.policy));
  if (sourceCanonical !== envelopeCanonical) {
    return {
      consistent: false,
      reason: 'Generated policy projection does not match source policy projection',
    };
  }

  return { consistent: true };
}


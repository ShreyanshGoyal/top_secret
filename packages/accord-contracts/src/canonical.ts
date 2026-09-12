/** Canonical ordering, deterministic serialization and hashing.
 * Pure functions only: no clock, no I/O, no configuration.
 */
import { createHash } from 'node:crypto';
import type { OrganizationType, Plan, PolicyIntent, Scope } from './types.js';

export const PLAN_ORDER: readonly Plan[] = ['free', 'paid'] as const;
export const ORGANIZATION_TYPE_ORDER: readonly OrganizationType[] = ['university', 'company', 'personal'] as const;
export const UNIVERSITY_VERIFIED_ORDER: readonly boolean[] = [false, true] as const;

/** Every plan x organizationType x universityVerified combination (12). */
export function allScopeCategories(): { plan: Plan; organizationType: OrganizationType; universityVerified: boolean }[] {
  const out: { plan: Plan; organizationType: OrganizationType; universityVerified: boolean }[] = [];
  for (const plan of PLAN_ORDER) {
    for (const organizationType of ORGANIZATION_TYPE_ORDER) {
      for (const universityVerified of UNIVERSITY_VERIFIED_ORDER) {
        out.push({ plan, organizationType, universityVerified });
      }
    }
  }
  return out;
}

function orderBy<T>(values: readonly T[], order: readonly T[], field: string): T[] {
  if (values.length === 0) throw new Error(`scope.${field} must not be empty`);
  const seen = new Set<T>();
  for (const value of values) {
    if (!order.includes(value)) throw new Error(`scope.${field} contains unsupported value`);
    if (seen.has(value)) throw new Error(`scope.${field} contains a duplicate value`);
    seen.add(value);
  }
  return order.filter((candidate) => seen.has(candidate));
}

/** Sorts each field into canonical order. Throws on empty, duplicate or unknown values. */
export function canonicalizeScope(scope: Scope): Scope {
  return {
    plans: orderBy(scope.plans, PLAN_ORDER, 'plans'),
    organizationTypes: orderBy(scope.organizationTypes, ORGANIZATION_TYPE_ORDER, 'organizationTypes'),
    universityVerified: orderBy(scope.universityVerified, UNIVERSITY_VERIFIED_ORDER, 'universityVerified'),
  };
}

export function isCanonicalScope(scope: Scope): boolean {
  try {
    return canonicalJson(canonicalizeScope(scope)) === canonicalJson(scope);
  } catch {
    return false;
  }
}

/** A scope matches a category when every field contains that category's value (fields are AND, values are OR). */
export function scopeMatches(scope: Scope, category: { plan: Plan; organizationType: OrganizationType; universityVerified: boolean }): boolean {
  return scope.plans.includes(category.plan)
    && scope.organizationTypes.includes(category.organizationType)
    && scope.universityVerified.includes(category.universityVerified);
}

export function scopesEqual(a: Scope, b: Scope): boolean {
  return canonicalJson(canonicalizeScope(a)) === canonicalJson(canonicalizeScope(b));
}

/** Deterministic JSON: object keys sorted, array order preserved, undefined rejected. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonical(value));
}

function toCanonical(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(toCanonical);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const entry = source[key];
      if (entry === undefined) throw new Error(`canonicalJson: undefined value at key ${key}`);
      out[key] = toCanonical(entry);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('canonicalJson: non-finite number');
  if (typeof value === 'undefined') throw new Error('canonicalJson: undefined value');
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Policy hash covers scope, days, appliesTo and effective only. Prose, status and timestamps are excluded. */
export function policyIntentHash(intent: PolicyIntent): string {
  return sha256Hex(canonicalJson({
    appliesTo: intent.appliesTo,
    effective: intent.effective,
    retentionDays: intent.retentionDays,
    scope: canonicalizeScope(intent.scope),
  }));
}

/** Hash of an already sanitized excerpt. Never pass raw fetched bytes here. */
export function excerptHash(sanitizedExcerpt: string): string {
  return sha256Hex(sanitizedExcerpt);
}

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isIsoTime(value: string): boolean {
  return ISO_MS.test(value) && !Number.isNaN(Date.parse(value));
}

/** Normalizes any parseable instant to UTC ISO 8601 with milliseconds. */
export function normalizeIsoTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) throw new Error('normalizeIsoTime: unparseable time');
  return new Date(ms).toISOString();
}

const SLACK_TS = /^(\d{1,12})\.(\d{1,6})$/;

export function isSlackTs(value: string): boolean {
  return SLACK_TS.test(value);
}

/**
 * Orders two Slack timestamps by whole and fractional decimal components.
 * Never parses them as floating point.
 */
export function compareSlackTs(a: string, b: string): number {
  const left = SLACK_TS.exec(a);
  const right = SLACK_TS.exec(b);
  if (!left || !right) throw new Error('compareSlackTs: invalid Slack timestamp');
  const leftWhole = left[1]!.replace(/^0+(?=\d)/, '');
  const rightWhole = right[1]!.replace(/^0+(?=\d)/, '');
  if (leftWhole.length !== rightWhole.length) return leftWhole.length < rightWhole.length ? -1 : 1;
  if (leftWhole !== rightWhole) return leftWhole < rightWhole ? -1 : 1;
  const width = Math.max(left[2]!.length, right[2]!.length);
  const leftFraction = left[2]!.padEnd(width, '0');
  const rightFraction = right[2]!.padEnd(width, '0');
  if (leftFraction === rightFraction) return 0;
  return leftFraction < rightFraction ? -1 : 1;
}

/** Elapsed-day retention predicate: eligible iff createdAt < asOf - days*86400s. Equality is retained. */
export const SECONDS_PER_DAY = 86_400;

export function isEligibleForCleanup(createdAt: string, asOf: string, days: number): boolean {
  if (!Number.isInteger(days)) throw new Error('isEligibleForCleanup: days must be an integer');
  const created = Date.parse(createdAt);
  const reference = Date.parse(asOf);
  if (Number.isNaN(created) || Number.isNaN(reference)) throw new Error('isEligibleForCleanup: unparseable time');
  return created < reference - days * SECONDS_PER_DAY * 1000;
}

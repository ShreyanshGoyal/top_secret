/**
 * Fixture Retention Cleanup
 * Evaluates record eligibility using the operative policy resolver.
 * Pure dry-run evaluation; does not perform physical database deletes.
 */
import {
  isCleanupEligible as evaluateEligibility,
  dryRunCleanup as evaluateDryRun
} from '@accord/retention-fixture';
import type { AccountRecord, DataRecord } from '@accord/retention-fixture';
import { getOperativeProjection } from './policy-resolver.js';

export function isCleanupEligible(
  account: AccountRecord,
  record: DataRecord,
  asOf: string
): boolean {
  const projection = getOperativeProjection();
  return evaluateEligibility(account, record, asOf, projection);
}

export function dryRunCleanup(
  accounts: readonly AccountRecord[],
  records: readonly DataRecord[],
  asOf: string
): string[] {
  const projection = getOperativeProjection();
  return evaluateDryRun(accounts, records, asOf, projection);
}

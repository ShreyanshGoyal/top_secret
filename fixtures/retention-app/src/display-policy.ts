/**
 * Fixture Display Policy
 * User-facing display text for retention settings.
 * Intentionally decoupled from runtime cleanup to demonstrate that UI-only edits
 * do not alter authoritative data retention logic.
 */
import type { AccountRecord } from '@accord/retention-fixture';

export function getRetentionPolicyDisplay(account: AccountRecord): string {
  if (account.plan === 'free' && account.organizationType === 'university' && account.universityVerified) {
    return '30-day standard retention policy for verified universities';
  }
  return 'Standard 30-day retention policy';
}

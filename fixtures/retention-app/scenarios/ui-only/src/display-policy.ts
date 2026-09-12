import type { AccountRecord } from '@accord/retention-fixture';

export function getRetentionPolicyDisplay(account: AccountRecord): string {
  if (account.plan === 'free' && account.organizationType === 'university' && account.universityVerified) {
    return '90-day retention policy for verified university free accounts';
  }
  return 'Standard 30-day retention policy';
}

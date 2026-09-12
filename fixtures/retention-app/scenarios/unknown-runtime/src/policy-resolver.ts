import type { AccountRecord } from '@accord/retention-fixture';

export function resolveRetentionDays(account: AccountRecord): number {
  // Modified custom runtime logic that breaks trusted checksums
  if (account.plan === 'free') return 90;
  return 30;
}

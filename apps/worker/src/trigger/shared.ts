/** Retry policy and error classification shared by the four tasks.
 * Exactly one layer owns provider retries: the SDK's own retry is disabled in the adapters, and
 * these task policies decide what is worth attempting again.
 */
import { AbortTaskRunError } from '@trigger.dev/sdk';
import type { PublicError } from '@accord/contracts';

/** At most 3 attempts with exponential backoff, honouring provider retry timing where given. */
export const RETRY_POLICY = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 1_000,
  maxTimeoutInMs: 15_000,
  randomize: true,
} as const;

const NEVER_RETRY: ReadonlySet<PublicError['code']> = new Set(['AUTH', 'FORBIDDEN', 'INVALID_INPUT', 'UNSUPPORTED']);

/**
 * Runs a task body and converts a non-retryable Accord failure into an abort, so Trigger.dev does
 * not burn attempts on a credential or input problem that will fail identically every time.
 */
export async function withRetryPolicy<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const shape = (error as { public?: PublicError }).public;
    if (shape && NEVER_RETRY.has(shape.code)) {
      throw new AbortTaskRunError(`${shape.code}: ${shape.message}`);
    }
    throw error;
  }
}

/** Trigger.dev dispatch for persisted job intents.
 * The SDK is imported lazily so that importing this package starts nothing.
 * The logical key is the idempotency key: Trigger dedupe and the PostgreSQL unique constraint
 * are both required, and neither alone is sufficient.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { JobIntent } from '@accord/store';
import type { JobSchedulerPort } from './types.js';

export function createTriggerScheduler(): JobSchedulerPort {
  return {
    async dispatch(intent: JobIntent): Promise<{ triggerRunId: string }> {
      const { tasks } = await import('@trigger.dev/sdk');
      // Per-thread serialization where the provider supports it. The PostgreSQL revision checks
      // remain the correctness mechanism; a concurrency setting alone is not correctness.
      const threadId = typeof intent.payload['threadId'] === 'string' ? intent.payload['threadId'] : undefined;
      try {
        const handle = await tasks.trigger(intent.taskType, intent.payload, {
          idempotencyKey: intent.logicalKey,
          ...(threadId ? { concurrencyKey: threadId } : {}),
        });
        return { triggerRunId: handle.id };
      } catch (error) {
        throw new AccordError(publicError('PROVIDER_ERROR', 'could not dispatch the job to Trigger.dev'), { cause: error });
      }
    },
  };
}

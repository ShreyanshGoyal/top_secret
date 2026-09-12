/** accord-process-context — interpret one accepted event and decide what happens next.
 * This task schedules the investigation rather than blocking while a human thinks; clarification
 * is a durable decision state, and the next event simply creates the next context run.
 */
import { task } from '@trigger.dev/sdk';
import { TASK_IDS, runContextJob } from '@accord/core';
import { investigationDependencies } from '../dependencies.js';
import { RETRY_POLICY, withRetryPolicy } from './shared.js';

export const processContextTask = task({
  id: TASK_IDS.processContext,
  retry: RETRY_POLICY,
  // Serial per thread: the scheduler passes the thread id as the concurrency key.
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  run: async (payload: unknown) => {
    const deps = investigationDependencies();
    try {
      await withRetryPolicy(() => runContextJob(deps, payload));
    } finally {
      await deps.store.close();
    }
  },
});

/** accord-publish — deliver or update the one bot-owned finding message for a thread.
 * Delivery outcome is tracked separately from investigation state: a Slack failure is never
 * reported as an investigation failure.
 */
import { randomUUID } from 'node:crypto';
import { task } from '@trigger.dev/sdk';
import { TASK_IDS, runPublishJob } from '@accord/core';
import { publishDependencies } from '../dependencies.js';
import { RETRY_POLICY, withRetryPolicy } from './shared.js';

export const publishTask = task({
  id: TASK_IDS.publish,
  retry: RETRY_POLICY,
  queue: { concurrencyLimit: 3 },
  maxDuration: 120,
  run: async (payload: unknown, { ctx }: { ctx: { run: { id: string } } }) => {
    const deps = publishDependencies(ctx.run.id || randomUUID());
    try {
      await withRetryPolicy(() => runPublishJob(deps, payload));
    } finally {
      await deps.store.close();
    }
  },
});

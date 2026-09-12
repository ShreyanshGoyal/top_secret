/** accord-reconcile — the durable recovery sweep.
 * A crash between the ingress commit and the Trigger.dev API call must not lose the event: the
 * intent is already in PostgreSQL and this schedule redispatches it. Target recovery after worker
 * availability returns is about 60 seconds for the demo; that is a demo target, not a universal SLA.
 */
import { schedules } from '@trigger.dev/sdk';
import { RECONCILE_INTERVAL_SECONDS, TASK_IDS, runReconcileJob } from '@accord/core';
import { ingressDependencies } from '../dependencies.js';
import { RETRY_POLICY, withRetryPolicy } from './shared.js';

export const RECONCILE_CRON = '* * * * *';

export const reconcileTask = schedules.task({
  id: TASK_IDS.reconcile,
  cron: RECONCILE_CRON,
  retry: RETRY_POLICY,
  maxDuration: 120,
  run: async () => {
    const deps = ingressDependencies('reconcile');
    try {
      return await withRetryPolicy(async () => {
        const first = await runReconcileJob(deps);
        // One extra pass inside the minute keeps the recovery target near RECONCILE_INTERVAL_SECONDS.
        await new Promise((resolve) => setTimeout(resolve, RECONCILE_INTERVAL_SECONDS * 1_000));
        const second = await runReconcileJob(deps);
        return {
          dispatched: first.dispatched + second.dispatched,
          republished: first.republished + second.republished,
        };
      });
    } finally {
      await deps.store.close();
    }
  },
});

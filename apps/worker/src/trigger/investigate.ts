/** accord-investigate — the substantive repository and data investigation.
 * Progress is persisted at every step boundary, so a retry resumes from its checkpoints instead of
 * repeating paid work, and an obsolete run is fenced rather than published.
 */
import { task } from '@trigger.dev/sdk';
import { TASK_IDS, runInvestigationJob } from '@accord/core';
import { investigationDependencies } from '../dependencies.js';
import { RETRY_POLICY, withRetryPolicy } from './shared.js';

export const investigateTask = task({
  id: TASK_IDS.investigate,
  retry: RETRY_POLICY,
  // Investigations for different decisions may overlap; older results are fenced on commit.
  queue: { concurrencyLimit: 5 },
  maxDuration: 300,
  run: async (payload: unknown) => {
    const deps = investigationDependencies();
    try {
      await withRetryPolicy(() => runInvestigationJob(deps, payload));
    } finally {
      await deps.store.close();
    }
  },
});

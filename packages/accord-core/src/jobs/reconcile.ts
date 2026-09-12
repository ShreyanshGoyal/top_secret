/** accord-reconcile task body: the durable safety net.
 * It redispatches job intents that were committed but never reached Trigger.dev, and re-enqueues
 * publications whose worker lease expired. Runs on a bounded schedule, not an in-memory timer.
 */
import { reconcile } from '../coordinator.js';
import type { IngressDependencies } from '../types.js';

export const RECONCILE_INTERVAL_SECONDS = 30;

export async function runReconcileJob(deps: IngressDependencies): Promise<{ dispatched: number; republished: number }> {
  const result = await reconcile(deps);
  deps.logger.info('reconcile_complete', result);
  return result;
}

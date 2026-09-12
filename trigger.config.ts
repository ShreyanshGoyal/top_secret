/** Trigger.dev project configuration. Owner: Agent 1.
 * The four task files under apps/worker/src/trigger are the only registered entrypoints.
 */
import { defineConfig } from '@trigger.dev/sdk';

export default defineConfig({
  project: process.env['TRIGGER_PROJECT_REF'] ?? '',
  dirs: ['./apps/worker/src/trigger'],
  // Task-level policies override this; it exists so nothing inherits an unbounded default.
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 15_000,
      randomize: true,
    },
  },
  maxDuration: 300,
});

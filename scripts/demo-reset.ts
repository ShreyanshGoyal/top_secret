import { requireDemoMode } from './lib/env.js';
requireDemoMode();
if (process.env.ACCORD_DEMO_RESET_ENABLED !== 'true') throw new Error('ACCORD_DEMO_RESET_ENABLED=true is required for an explicit demo reset.');
throw new Error('Demo reset is intentionally unavailable until Agent 1 publishes a durable ApplicationPort reset operation. This script will not fake a run/thread context or mutate the immutable ClickHouse dataset.');

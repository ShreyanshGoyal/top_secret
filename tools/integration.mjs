/** `npm run test:integration` — real PostgreSQL and ClickHouse, plus package integration suites. */
import { requireEnvironment, runAcross } from './workspace-suites.mjs';

requireEnvironment(['DATABASE_URL'], 'Integration tests');
runAcross('test:pg', 'PostgreSQL integration');

/** `npm run test:live` — real provider and live-flow checks. Never reports a pass it did not earn. */
import { requireEnvironment, runAcross } from './workspace-suites.mjs';

requireEnvironment(['OPENAI_API_KEY', 'ACCORD_MODEL'], 'Live provider tests');
runAcross('test:live', 'Live provider');

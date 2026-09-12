/** `npm run test:live` — real provider and live-flow checks. Never reports a pass it did not earn. */
import { requireEnvironment, runAcross } from './workspace-suites.mjs';

requireEnvironment([(process.env.ACCORD_MODEL_PROVIDER ?? 'google') === 'google' ? 'GOOGLE_API_KEY' : 'OPENAI_API_KEY', 'ACCORD_MODEL'], 'Live provider tests');
runAcross('test:live', 'Live provider');

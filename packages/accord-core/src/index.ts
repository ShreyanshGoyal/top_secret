/** @accord/core — decision state, coordinator and durable workflow. Owner: Agent 1, branch accord/core.
 * Public surface is frozen at bootstrap; behavior lands on accord/core.
 * Agent 2 starts the application with `await createConfiguredApplication()` and needs no other wiring.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { ApplicationPort, Id } from '@accord/contracts';
import type {
  CoreDependencies, IngressDependencies, InvestigationDependencies, InvestigationPayload,
  ProcessContextPayload, PublishDependencies,
} from './types.js';

export * from './types.js';
export * from './config.js';

const NOT_IMPLEMENTED = 'accord/core is not implemented at the bootstrap commit; it lands on branch accord/core (Agent 1).';

function pending(): never {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

/** Builds the application from explicit dependencies. Test adapters are injected here, never selected by a missing key. */
export function createApplication(_deps: IngressDependencies | CoreDependencies): ApplicationPort {
  return pending();
}

/** Parses the environment, constructs real providers and returns the application. No import-time effects. */
export async function createConfiguredApplication(): Promise<ApplicationPort> {
  return pending();
}

export async function processContext(_deps: InvestigationDependencies, _payload: ProcessContextPayload): Promise<void> {
  return pending();
}

export async function runInvestigation(_deps: InvestigationDependencies, _run: InvestigationPayload): Promise<void> {
  return pending();
}

export async function publishPending(_deps: PublishDependencies, _publicationId: Id): Promise<void> {
  return pending();
}

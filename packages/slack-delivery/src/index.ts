/** @accord/slack-delivery — background Slack Web API delivery and deterministic finding rendering.
 * Owner: Agent 2, branch accord/slack. Side-effect free on import; the worker may import it for output.
 * The factory signature below is frozen by 01-SHARED-CONTRACTS and must not change.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { PublisherConfig, PublisherDependencies, PublisherPort, ThreadView } from '@accord/contracts';

const NOT_IMPLEMENTED = 'accord/slack-delivery is not implemented at the bootstrap commit; it lands on branch accord/slack (Agent 2).';

export function createPublisherPort(_config: PublisherConfig, _deps: PublisherDependencies): PublisherPort {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

/** Deterministic sanitized rendering of the current persisted view. No model call, no network. */
export function renderFinding(_view: ThreadView): string {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

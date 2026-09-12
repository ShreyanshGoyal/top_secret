/** @accord/slack-delivery — background Slack Web API delivery and deterministic finding rendering.
 * Owner: Agent 2, branch accord/slack. Side-effect free on import; the worker may import it for output.
 * The factory signature below is frozen by 01-SHARED-CONTRACTS and must not change.
 */
export { createPublisherPort, SlackPublisher } from './publisher.js';
export { renderFinding, escapeSlackText, formatScope } from './renderer.js';
export { SlackWebClient } from './client.js';
export { reconcilePublication } from './reconcile.js';

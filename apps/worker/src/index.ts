/** apps/worker — Trigger.dev task entrypoints and explicit provider composition.
 * Owner: Agent 1, branch accord/core. Tasks: accord-process-context, accord-investigate,
 * accord-publish, accord-reconcile. A worker never constructs a Slack runtime and never imports
 * apps/channel internals; it may import the side-effect-free @accord/slack-delivery publisher.
 */
export {};

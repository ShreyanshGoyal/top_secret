/** @accord/privacy — shared sanitization, audience assertion and the safe logger.
 * Owner: Agent 4, branch accord/data-integration.
 * createPrivacyPort is frozen by 01-SHARED-CONTRACTS. createSafeLogger is the proposed shape for the
 * "safe logger factory" in that table; Agent 4 may refine its options object and must report it in the handoff.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { PrivacyConfig, PrivacyPort, SafeLoggerPort } from '@accord/contracts';

const NOT_IMPLEMENTED = 'accord/privacy is not implemented at the bootstrap commit; it lands on branch accord/data-integration (Agent 4).';

export function createPrivacyPort(_config: PrivacyConfig): PrivacyPort {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

export function createSafeLogger(_options: { component: string }): SafeLoggerPort {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

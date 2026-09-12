/** @accord/data-impact — restricted read-only ClickHouse impact analysis.
 * Owner: Agent 4, branch accord/data-integration. No arbitrary SQL, no production writes.
 * The factory signature below is frozen by 01-SHARED-CONTRACTS and must not change.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { ImpactConfig, ImpactPort, ProviderDependencies } from '@accord/contracts';

const NOT_IMPLEMENTED = 'accord/data-impact is not implemented at the bootstrap commit; it lands on branch accord/data-integration (Agent 4).';

export function createImpactPort(_config: ImpactConfig, _deps: ProviderDependencies): ImpactPort {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

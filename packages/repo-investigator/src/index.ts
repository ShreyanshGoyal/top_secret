/** @accord/repo-investigator — bounded repository specialist over real GitHub evidence at a fixed SHA.
 * Owner: Agent 3, branch accord/repository. Never executes fetched code.
 * The factory signature below is frozen by 01-SHARED-CONTRACTS and must not change.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { ProviderDependencies, RepositoryConfig, RepositoryPort } from '@accord/contracts';

const NOT_IMPLEMENTED = 'accord/repo-investigator is not implemented at the bootstrap commit; it lands on branch accord/repository (Agent 3).';

export function createRepositoryPort(_config: RepositoryConfig, _deps: ProviderDependencies): RepositoryPort {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
}

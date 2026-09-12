/** @accord/store — PostgreSQL durable authority. Owner: Agent 1, branch accord/core.
 * The type surface below is frozen at bootstrap. The implementation lands on accord/core.
 */
import { AccordError, publicError } from '@accord/contracts';
import type { StoreConfig, StorePort } from './types.js';

export * from './types.js';

const NOT_IMPLEMENTED = 'accord/store is not implemented at the bootstrap commit; it lands on branch accord/core (Agent 1).';

export const createStore = async (_config: StoreConfig): Promise<StorePort> => {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
};

export const runMigrations = async (_config: StoreConfig): Promise<{ appliedVersion: number }> => {
  throw new AccordError(publicError('UNSUPPORTED', NOT_IMPLEMENTED));
};

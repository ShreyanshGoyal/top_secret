/** @accord/contracts — normative v1.0 boundary types, strict schemas and canonical helpers.
 * Every other package imports this package root only. No package imports another owner's internals.
 */
export * from './types.js';
export * from './schemas.js';
export * from './canonical.js';
export * from './validate.js';

export { CONTRACT_VERSION as schemaVersion } from './types.js';

/** Shared bounded privacy and authorization guards. No I/O occurs on import. */
export { assertAllowedPath } from './paths.js';
export { assertAudience, createPrivacyPort } from './audience.js';
export { createSafeLogger } from './logger.js';
export { sanitizeText } from './redaction.js';

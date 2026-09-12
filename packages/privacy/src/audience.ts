import { AccordError, publicError } from '@accord/contracts';
import type { PrivacyConfig, PrivacyPort, RepositoryId, ThreadRef } from '@accord/contracts';
import { assertAllowedPath } from './paths.js';
import { sanitizeText } from './redaction.js';

function sameRepository(left: RepositoryId, right: RepositoryId): boolean { return left.owner === right.owner && left.name === right.name; }
function assertConfiguration(config: PrivacyConfig): PrivacyConfig {
  if (!config.teamId || !config.channelId || !config.repository.owner || !config.repository.name || !config.datasetVersion) {
    throw new AccordError(publicError('INVALID_INPUT', 'Privacy configuration is incomplete.'));
  }
  return { ...config, knownSecretValues: [...new Set(config.knownSecretValues.filter(Boolean))] };
}
export function assertAudience(config: PrivacyConfig, input: { thread: ThreadRef; repository: RepositoryId; datasetVersion: string }): void {
  if (input.thread.teamId !== config.teamId || input.thread.channelId !== config.channelId
    || !sameRepository(input.repository, config.repository) || input.datasetVersion !== config.datasetVersion) {
    throw new AccordError(publicError('FORBIDDEN', 'The requested resource is outside Accord\'s configured audience.'));
  }
}
/** Creates pure guards only; it never reads environment variables or contacts a provider. */
export function createPrivacyPort(config: PrivacyConfig): PrivacyPort {
  const safeConfig = assertConfiguration(config);
  return {
    sanitize(input, _kind) { return sanitizeText(input, safeConfig.knownSecretValues); },
    assertAudience(input) { assertAudience(safeConfig, input); },
    assertAllowedPath,
  };
}

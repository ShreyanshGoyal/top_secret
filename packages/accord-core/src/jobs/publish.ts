/** accord-publish task body. Delivery outcome is independent from investigation state. */
import { AccordError, publicError } from '@accord/contracts';
import { publishPending } from '../coordinator.js';
import type { PublishDependencies } from '../types.js';

export function parsePublishPayload(raw: unknown): { publicationId: string } {
  const value = raw as { publicationId?: unknown } | null;
  if (!value || typeof value.publicationId !== 'string') {
    throw new AccordError(publicError('INVALID_INPUT', 'invalid accord-publish payload'));
  }
  return { publicationId: value.publicationId };
}

export async function runPublishJob(deps: PublishDependencies, raw: unknown): Promise<void> {
  const { publicationId } = parsePublishPayload(raw);
  deps.logger.info('publish_job_start', { publicationId });
  await publishPending(deps, publicationId);
}

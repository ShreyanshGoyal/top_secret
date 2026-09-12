/** accord-process-context task body. Validates the payload, then runs the coordinator. */
import { AccordError, publicError } from '@accord/contracts';
import { processContext } from '../coordinator.js';
import type { InvestigationDependencies, ProcessContextPayload } from '../types.js';

export function parseContextPayload(raw: unknown): ProcessContextPayload {
  const value = raw as Partial<ProcessContextPayload> | null;
  if (!value || typeof value.threadId !== 'string' || typeof value.eventKey !== 'string' || typeof value.contextRevision !== 'number') {
    throw new AccordError(publicError('INVALID_INPUT', 'invalid accord-process-context payload'));
  }
  return { threadId: value.threadId, eventKey: value.eventKey, contextRevision: value.contextRevision };
}

export async function runContextJob(deps: InvestigationDependencies, raw: unknown): Promise<void> {
  const payload = parseContextPayload(raw);
  deps.logger.info('context_job_start', { threadId: payload.threadId, contextRevision: payload.contextRevision });
  await processContext(deps, payload);
}

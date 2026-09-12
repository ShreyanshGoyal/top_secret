/** accord-investigate task body. */
import { AccordError, publicError } from '@accord/contracts';
import { runInvestigation } from '../coordinator.js';
import type { InvestigationDependencies, InvestigationPayload } from '../types.js';

export function parseInvestigationPayload(raw: unknown): InvestigationPayload {
  const value = raw as Partial<InvestigationPayload> | null;
  if (!value || typeof value.investigationId !== 'string' || typeof value.decisionId !== 'string'
    || typeof value.decisionVersion !== 'number' || typeof value.contextRevision !== 'number') {
    throw new AccordError(publicError('INVALID_INPUT', 'invalid accord-investigate payload'));
  }
  return {
    investigationId: value.investigationId,
    decisionId: value.decisionId,
    decisionVersion: value.decisionVersion,
    contextRevision: value.contextRevision,
    pullRequestUrl: typeof value.pullRequestUrl === 'string' ? value.pullRequestUrl : null,
  };
}

export async function runInvestigationJob(deps: InvestigationDependencies, raw: unknown): Promise<void> {
  const payload = parseInvestigationPayload(raw);
  deps.logger.info('investigation_job_start', { investigationId: payload.investigationId, mode: payload.pullRequestUrl ? 'verify_pr' : 'baseline' });
  await runInvestigation(deps, payload);
}

import { randomUUID } from 'node:crypto';
import { AccordError, ImpactReportSchema, ImpactRequestSchema, validate } from '@accord/contracts';
import type { ImpactConfig, ImpactPort, ImpactReport, ImpactRequest, ProviderDependencies, PublicError } from '@accord/contracts';
import { executeReadOnlyQuery } from './client.js';
import { compileImpactQuery } from './compiler.js';
import { validateImpactConfig } from './config.js';
import { queryEvidence } from './evidence.js';
const FIELDS = ['eligible_accounts', 'eligible_records', 'observed_selected_in_scope', 'intended_selected_in_scope', 'prematurely_selected_records', 'prematurely_selected_accounts', 'over_retained_records', 'out_of_scope_changed_records', 'observed_selected_total', 'intended_selected_total'] as const;
function count(row: Record<string, unknown>, field: typeof FIELDS[number]): number {
  const value = row[field];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AccordError({ code: 'PROVIDER_ERROR', message: 'ClickHouse returned invalid aggregate counts.', retryable: false });
  return parsed;
}
function unavailable(run: ImpactRequest['run'], observedAt: string, error: PublicError): ImpactReport {
  return validate(ImpactReportSchema, { run, status: 'unavailable', eligibleAccounts: null, eligibleRecords: null, observedSelectedInScope: null, intendedSelectedInScope: null, prematurelySelectedRecords: null, prematurelySelectedAccounts: null, overRetainedRecords: null, outOfScopeChangedRecords: null, observedSelectedTotal: null, intendedSelectedTotal: null, queryId: null, observedAt, evidence: [], error }, 'Unavailable impact report');
}
async function withOneRetry<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { if (!(error instanceof AccordError) || !error.public.retryable) throw error; return operation(); }
}
/** Factory is side-effect free: the first network request happens only in analyze(). */
export function createImpactPort(config: ImpactConfig, deps: ProviderDependencies): ImpactPort {
  const safeConfig = validateImpactConfig(config);
  return { async analyze(input: ImpactRequest): Promise<ImpactReport> {
    const request = validate(ImpactRequestSchema, input, 'Impact request');
    if (request.run.datasetVersion !== safeConfig.allowedDatasetVersion) throw new AccordError({ code: 'FORBIDDEN', message: 'The requested dataset is not configured for Accord impact analysis.', retryable: false });
    const observedAt = deps.clock.now(); const started = Date.now(); const compiled = compileImpactQuery(request); const queryId = randomUUID();
    try {
      const result = await withOneRetry(() => executeReadOnlyQuery(safeConfig, compiled.sql, compiled.parameters, queryId));
      const report = validate(ImpactReportSchema, {
        run: request.run, status: 'complete', eligibleAccounts: count(result.row, 'eligible_accounts'), eligibleRecords: count(result.row, 'eligible_records'), observedSelectedInScope: count(result.row, 'observed_selected_in_scope'), intendedSelectedInScope: count(result.row, 'intended_selected_in_scope'), prematurelySelectedRecords: count(result.row, 'prematurely_selected_records'), prematurelySelectedAccounts: count(result.row, 'prematurely_selected_accounts'), overRetainedRecords: count(result.row, 'over_retained_records'), outOfScopeChangedRecords: count(result.row, 'out_of_scope_changed_records'), observedSelectedTotal: count(result.row, 'observed_selected_total'), intendedSelectedTotal: count(result.row, 'intended_selected_total'), queryId: result.queryId, observedAt, evidence: [queryEvidence(request, result.queryId, observedAt, compiled, (text) => deps.privacy.sanitize(text, 'repository'))], error: null,
      }, 'Impact report');
      deps.logger.info('impact.query.complete', { queryId, durationMs: Date.now() - started, records: report.eligibleRecords });
      return report;
    } catch (error) {
      if (!(error instanceof AccordError)) throw error;
      deps.logger.error('impact.query.unavailable', { code: error.public.code, durationMs: Date.now() - started });
      return unavailable(request.run, observedAt, error.public);
    }
  } };
}

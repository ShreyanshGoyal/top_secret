import { ImpactRequestSchema, validate } from '@accord/contracts';
import type { ImpactRequest, RetentionProjection, Scope } from '@accord/contracts';

export type QueryParameters = Record<string, string | number | readonly (string | number)[]>;
export interface CompiledImpactQuery { sql: string; parameters: QueryParameters }

function assignScope(parameters: QueryParameters, prefix: string, scope: Scope): string {
  parameters[`${prefix}_plans`] = scope.plans;
  parameters[`${prefix}_organizations`] = scope.organizationTypes;
  parameters[`${prefix}_verified`] = scope.universityVerified.map((value) => value ? 1 : 0);
  return `(plan IN {${prefix}_plans:Array(String)} AND organization_type IN {${prefix}_organizations:Array(String)} AND university_verified IN {${prefix}_verified:Array(UInt8)})`;
}

function policyDays(parameters: QueryParameters, prefix: string, projection: RetentionProjection): string {
  const branches = projection.rules.map((rule, index) => {
    const match = assignScope(parameters, `${prefix}_rule_${index}`, rule.scope);
    const dayKey = `${prefix}_rule_${index}_days`;
    parameters[dayKey] = rule.days;
    return `${match}, {${dayKey}:UInt16}`;
  });
  const defaultKey = `${prefix}_default_days`;
  parameters[defaultKey] = projection.defaultDays;
  return branches.length === 0 ? `{${defaultKey}:UInt16}` : `multiIf(${branches.join(', ')}, {${defaultKey}:UInt16})`;
}

/** Compiles only validated projections into fixed SQL identifiers and typed parameters. */
export function compileImpactQuery(input: ImpactRequest): CompiledImpactQuery {
  const request = validate(ImpactRequestSchema, input, 'Impact request');
  // ClickHouse's typed DateTime64 parameter parser expects its server literal form. Contract and
  // persisted timestamps remain canonical UTC ISO; this conversion exists only on the SQL boundary.
  const parameters: QueryParameters = {
    dataset_version: request.run.datasetVersion,
    as_of: request.run.asOf.replace('T', ' ').replace('Z', ''),
  };
  const inScope = assignScope(parameters, 'intent', request.intent.scope);
  const observedDays = policyDays(parameters, 'observed', request.observedProjection);
  const baselineDays = policyDays(parameters, 'baseline', request.baselineProjection);
  parameters.intent_days = request.intent.retentionDays;
  const sql = `WITH
  {as_of:DateTime64(3, 'UTC')} AS as_of,
  source AS (
    SELECT account_id, record_id, created_at,
      ${inScope} AS in_scope,
      ${observedDays} AS observed_days,
      ${baselineDays} AS baseline_days
    FROM accord_retention_view
    WHERE dataset_version = {dataset_version:String}
  ),
  classified AS (
    SELECT *,
      if(in_scope, {intent_days:UInt16}, baseline_days) AS intended_days,
      created_at < as_of - toIntervalSecond(toUInt32(observed_days) * 86400) AS observed_selected,
      created_at < as_of - toIntervalSecond(toUInt32(baseline_days) * 86400) AS baseline_selected,
      created_at < as_of - toIntervalSecond(toUInt32(if(in_scope, {intent_days:UInt16}, baseline_days)) * 86400) AS intended_selected
    FROM source
  )
SELECT
  countDistinctIf(account_id, in_scope) AS eligible_accounts,
  countIf(in_scope) AS eligible_records,
  countIf(in_scope AND observed_selected) AS observed_selected_in_scope,
  countIf(in_scope AND intended_selected) AS intended_selected_in_scope,
  countIf(in_scope AND observed_selected AND NOT intended_selected) AS prematurely_selected_records,
  countDistinctIf(account_id, in_scope AND observed_selected AND NOT intended_selected) AS prematurely_selected_accounts,
  countIf(in_scope AND NOT observed_selected AND intended_selected) AS over_retained_records,
  countIf(NOT in_scope AND observed_selected != baseline_selected) AS out_of_scope_changed_records,
  countIf(observed_selected) AS observed_selected_total,
  countIf(intended_selected) AS intended_selected_total
FROM classified
FORMAT JSONEachRow`;
  return { sql, parameters };
}

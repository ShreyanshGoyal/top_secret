/** Code-enforced finding composition.
 * The model never chooses the status and never supplies a number. Every count comes from the
 * impact report, every claim from a tool-minted evidence id.
 */
import { AccordError, publicError } from '@accord/contracts';
import type {
  Decision, Evidence, Finding, FindingStatus, ImpactReport, IsoTime, RepositoryReport, RunContext,
  VerificationReport,
} from '@accord/contracts';

export type FindingDraft = Omit<Finding, 'id' | 'updatedAt'>;

export interface ComposeInput {
  decision: Decision;
  contextRevision: number;
  run: RunContext | null;
  repository: RepositoryReport | null;
  impact: ImpactReport | null;
  verification: VerificationReport | null;
  question: string | null;
  reasons: string[];
}

const SCOPE_LABEL = (decision: Decision): string => {
  const intent = decision.intent;
  if (!intent) return 'the proposed scope';
  return `${intent.scope.plans.join('/')} · ${intent.scope.organizationTypes.join('/')} · verified ${intent.scope.universityVerified.join('/')}`;
};

/** Chooses the status from evidence and decision authority alone. */
export function resolveStatus(input: ComposeInput): FindingStatus {
  if (input.decision.status === 'withdrawn') return 'withdrawn';
  if (input.question !== null || input.decision.intent === null) return 'needs_clarification';

  if (input.verification) {
    return input.verification.verdict === 'verified_at_commit' ? 'verified_at_commit' : 'verification_failed';
  }

  const repository = input.repository;
  if (!repository) return 'failed';
  if (repository.trustedRuntime === 'unsupported' || repository.observedProjection === null) return 'failed';
  if (repository.conclusion === 'unknown') return 'failed';
  if (repository.conclusion === 'aligned') return 'no_conflict';

  // conclusion === 'conflict'
  const impact = input.impact;
  if (!impact || impact.status !== 'complete') return 'impact_unverified';
  return input.decision.status === 'confirmed' ? 'confirmed_conflict' : 'conditional_impact';
}

function title(status: FindingStatus, input: ComposeInput): string {
  switch (status) {
    case 'withdrawn': return 'Retention change withdrawn';
    case 'needs_clarification': return 'Retention change needs clarification';
    case 'verified_at_commit': return 'Fix verified at this commit';
    case 'verification_failed': return `Fix not verified: ${input.verification?.verdict ?? 'insufficient_evidence'}`;
    case 'no_conflict': return 'No conflict found for the confirmed scope';
    case 'impact_unverified': return 'Code conflict found, record impact unverified';
    case 'conditional_impact': return 'Conditional impact for a non-binding intent';
    case 'confirmed_conflict': return 'Implementation contradicts the confirmed retention decision';
    default: return 'Investigation incomplete';
  }
}

function summary(status: FindingStatus, input: ComposeInput): string {
  const intent = input.decision.intent;
  const lines: string[] = [];

  if (intent) {
    lines.push(`Intent: keep records for ${intent.retentionDays} days · ${SCOPE_LABEL(input.decision)} · currently stored records · immediate.`);
  }

  const repository = input.repository;
  if (repository) {
    lines.push(`Code at ${repository.target.sha}: ${repository.summary}`);
    if (repository.generatorConsistency === 'inconsistent') {
      lines.push('The generated policy artifact disagrees with its authoritative source, so the observed behavior is not durable.');
    }
    if (repository.trustedRuntime === 'unsupported') {
      lines.push('The runtime path is outside the trusted profile, so no behavior claim is made from it.');
    }
  }

  const impact = input.impact;
  if (impact && impact.status === 'complete') {
    // Counts are copied verbatim from the query result. Unknown stays unknown.
    lines.push(
      `Records: ${describe(impact.prematurelySelectedRecords)} prematurely selected across `
      + `${describe(impact.prematurelySelectedAccounts)} accounts `
      + `(observed ${describe(impact.observedSelectedInScope)} in scope vs intended ${describe(impact.intendedSelectedInScope)}; `
      + `totals ${describe(impact.observedSelectedTotal)} vs ${describe(impact.intendedSelectedTotal)}).`,
    );
    if (impact.overRetainedRecords !== null && impact.overRetainedRecords > 0) {
      lines.push(`${impact.overRetainedRecords} records would be retained longer than intended.`);
    }
    if (impact.outOfScopeChangedRecords !== null && impact.outOfScopeChangedRecords > 0) {
      lines.push(`${impact.outOfScopeChangedRecords} records outside the intended scope would change behavior.`);
    }
  } else if (impact) {
    lines.push(`Record impact is ${impact.status}: counts are unknown, not zero. The code evidence above still stands.`);
  }

  const verification = input.verification;
  if (verification) {
    lines.push(`Verification verdict ${verification.verdict} at ${verification.target.sha}; deployment ${verification.deployment}.`);
    for (const check of verification.checks) {
      lines.push(`· ${check.name}: ${check.status} — ${check.explanation}`);
    }
  }

  if (status === 'conditional_impact') {
    lines.push('This intent is not confirmed, so this is a conditional assessment rather than a confirmed conflict.');
  }

  return lines.join('\n').slice(0, 4_000);
}

function describe(count: number | null): string {
  return count === null ? 'unknown' : String(count);
}

function limitations(status: FindingStatus, input: ComposeInput): string[] {
  const out = [...input.reasons];
  if (input.repository?.unknowns) out.push(...input.repository.unknowns);
  if (input.verification) out.push('Deployment state is not verified; this is a statement about a commit.');
  if (status === 'no_conflict') {
    out.push(`Checked only the confirmed scope at ${input.repository?.target.sha ?? 'the inspected commit'}.`);
  }
  if (status === 'impact_unverified') out.push('Record counts are unavailable; unknown is not zero.');
  if (input.impact?.error) out.push(`Impact query error: ${input.impact.error.code}.`);
  return dedupe(out).slice(0, 20).map((line) => line.slice(0, 500));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

/** Every cited evidence id must have been minted by a tool in one of the attached reports. */
export function collectEvidence(input: ComposeInput): Evidence[] {
  const all = [
    ...(input.repository?.evidence ?? []),
    ...(input.impact?.evidence ?? []),
    ...(input.verification?.evidence ?? []),
  ];
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const item of all) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out.slice(0, 60);
}

/** Run keys must match the finding keys exactly; a clarification has no run at all. */
export function composeFinding(input: ComposeInput, _now: IsoTime): FindingDraft {
  const status = resolveStatus(input);
  const run = input.run;

  if (run && (run.decisionId !== input.decision.id || run.decisionVersion !== input.decision.version || run.contextRevision !== input.contextRevision)) {
    throw new AccordError(publicError('STALE', 'investigation run keys do not match the decision being reported'));
  }

  const evidence = collectEvidence(input);
  if (input.impact?.status === 'complete' && input.repository === null) {
    throw new AccordError(publicError('INCOMPLETE_EVIDENCE', 'impact counts cannot be reported without repository evidence'));
  }

  return {
    decisionId: input.decision.id,
    decisionVersion: input.decision.version,
    contextRevision: input.contextRevision,
    run,
    status,
    title: title(status, input),
    summary: summary(status, input),
    question: input.question,
    repository: input.repository,
    impact: input.impact,
    verification: input.verification,
    evidence,
    limitations: limitations(status, input),
  };
}

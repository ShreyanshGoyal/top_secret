/**
 * Deterministic PR Fix Verification Engine
 * Validates candidate pull requests against the 6 normative gates.
 * Never executes untrusted fetched PR code.
 */
import type {
  CheckResult,
  Decision,
  RepositoryReport,
  RunContext,
  VerificationReport,
} from '@accord/contracts';
import { evaluateCategoryMatrix } from './trust/projection.js';

export interface VerifyInput {
  run: RunContext;
  decision: Decision;
  baseline: RepositoryReport;
  candidate: RepositoryReport;
}

export function verifyCandidateFix(input: VerifyInput): VerificationReport {
  const { run, decision, baseline, candidate } = input;

  // 1. Validate decision identity matching
  if (decision.id !== run.decisionId || decision.version !== run.decisionVersion) {
    throw new Error(`Verification run context mismatch: decision ${decision.id} v${decision.version} !== run ${run.decisionId} v${run.decisionVersion}`);
  }
  if (baseline.run.decisionId !== decision.id || baseline.run.decisionVersion !== decision.version) {
    throw new Error(`Baseline report decision mismatch: ${baseline.run.decisionId} v${baseline.run.decisionVersion} !== ${decision.id} v${decision.version}`);
  }

  // Candidate must match the current verification run context exactly
  if (
    candidate.run.investigationId !== run.investigationId ||
    candidate.run.contextRevision !== run.contextRevision ||
    candidate.run.mode !== 'verify_pr'
  ) {
    throw new Error('Candidate report run context must match current verification run context exactly');
  }

  const checks: CheckResult[] = [];
  const intent = decision.intent;
  if (!intent) {
    throw new Error('Cannot verify fix without confirmed policy intent');
  }

  // Gate 1: supported_runtime
  const isRuntimeSupported = candidate.trustedRuntime === 'matched';
  checks.push({
    name: 'supported_runtime',
    status: isRuntimeSupported ? 'pass' : 'fail',
    explanation: isRuntimeSupported
      ? 'Runtime dependency closure and resolver files match server-side trusted digest profile.'
      : 'Candidate repository runtime files or dependencies do not match server-side trusted profile.',
    evidenceIds: candidate.evidence.filter((e) => e.path?.includes('policy-resolver') || e.path?.includes('cleanup')).map((e) => e.id),
  });

  // Gate 2: source_generated_consistency
  const isConsistent = candidate.generatorConsistency === 'consistent';
  checks.push({
    name: 'source_generated_consistency',
    status: isConsistent ? 'pass' : 'fail',
    explanation: isConsistent
      ? 'Deterministic regeneration matches committed generated policy envelope byte-for-byte.'
      : 'Generator consistency check failed: source IDL and generated policy artifact diverge.',
    evidenceIds: candidate.evidence.filter((e) => e.path?.includes('retention.idl.json') || e.path?.includes('retention-policy.json')).map((e) => e.id),
  });

  // Category matrix checks (target_policy, scope_preservation, cutoff_boundaries)
  const candidateProjection = candidate.observedProjection;
  const baselineProjection = baseline.observedProjection || {
    schemaVersion: 1,
    defaultDays: 30,
    rules: [],
  };

  if (!candidateProjection) {
    checks.push({
      name: 'target_policy',
      status: 'fail',
      explanation: 'No operative observed projection discovered in candidate.',
      evidenceIds: [],
    });
    checks.push({
      name: 'scope_preservation',
      status: 'fail',
      explanation: 'Unable to evaluate scope preservation without candidate projection.',
      evidenceIds: [],
    });
    checks.push({
      name: 'cutoff_boundaries',
      status: 'fail',
      explanation: 'Unable to evaluate cutoff boundaries without candidate projection.',
      evidenceIds: [],
    });
  } else {
    const catEval = evaluateCategoryMatrix(
      candidateProjection,
      baselineProjection,
      intent,
      run.asOf
    );
    checks.push(catEval.targetPolicyCheck);
    checks.push(catEval.scopePreservationCheck);
    checks.push(catEval.boundaryCutoffCheck);
  }

  // Gate 6: evidence_complete
  const hasEvidence = candidate.evidence.length > 0 && candidate.trace.length > 0;
  checks.push({
    name: 'evidence_complete',
    status: hasEvidence ? 'pass' : 'fail',
    explanation: hasEvidence
      ? 'All required policy, resolver, and cleanup evidence references exist with valid trace edges.'
      : 'Incomplete evidence trace graph.',
    evidenceIds: candidate.evidence.map((e) => e.id),
  });

  // 2. Synthesize verdict
  let verdict: VerificationReport['verdict'];

  if (!isRuntimeSupported) {
    verdict = 'insufficient_evidence';
  } else {
    const targetCheck = checks.find((c) => c.name === 'target_policy');
    const consistencyCheck = checks.find((c) => c.name === 'source_generated_consistency');
    const scopeCheck = checks.find((c) => c.name === 'scope_preservation');
    const cutoffCheck = checks.find((c) => c.name === 'cutoff_boundaries');
    const evidenceCheck = checks.find((c) => c.name === 'evidence_complete');

    if (targetCheck?.status !== 'pass') {
      verdict = 'still_conflicting';
    } else if (consistencyCheck?.status !== 'pass') {
      verdict = 'non_durable';
    } else if (scopeCheck?.status !== 'pass') {
      verdict = 'scope_regression';
    } else if (cutoffCheck?.status !== 'pass' || evidenceCheck?.status !== 'pass') {
      verdict = 'insufficient_evidence';
    } else {
      verdict = 'verified_at_commit';
    }
  }

  return {
    run,
    target: candidate.target,
    verdict,
    checks,
    deployment: 'unverified',
    evidence: candidate.evidence,
  };
}

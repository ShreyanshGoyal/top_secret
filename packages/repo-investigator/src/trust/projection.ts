/**
 * Evaluator of Projections across Policy Categories and Boundary Ages
 */
import {
  allScopeCategories,
  isEligibleForCleanup,
  scopeMatches,
} from '@accord/contracts';
import type {
  CheckResult,
  PolicyIntent,
  RetentionProjection,
} from '@accord/contracts';
import {
  resolveRetentionDays,
} from '@accord/retention-fixture';

export const BOUNDARY_AGES = [0, 29, 30, 31, 89, 90, 91] as const;

export interface CategoryEvaluationResult {
  targetPolicyCheck: CheckResult;
  scopePreservationCheck: CheckResult;
  boundaryCutoffCheck: CheckResult;
}

export function evaluateCategoryMatrix(
  observedProjection: RetentionProjection,
  baselineProjection: RetentionProjection,
  intent: PolicyIntent,
  asOf: string
): CategoryEvaluationResult {
  const categories = allScopeCategories();
  let targetPolicyPass = true;
  let targetPolicyExplanation = '';

  let scopePreservationPass = true;
  let scopePreservationExplanation = '';

  let boundaryCutoffPass = true;
  let boundaryCutoffExplanation = '';

  for (const cat of categories) {
    const fakeAccount = {
      id: `check-${cat.plan}-${cat.organizationType}-${cat.universityVerified}`,
      ...cat,
    };

    const inScope = scopeMatches(intent.scope, cat);
    const observedDays = resolveRetentionDays(fakeAccount, observedProjection);
    const baselineDays = resolveRetentionDays(fakeAccount, baselineProjection);

    if (inScope) {
      if (observedDays !== intent.retentionDays) {
        targetPolicyPass = false;
        targetPolicyExplanation = `In-scope category (${cat.plan}, ${cat.organizationType}, verified: ${cat.universityVerified}) resolved to ${observedDays} days; expected ${intent.retentionDays} days.`;
      }
    } else {
      if (observedDays !== baselineDays) {
        scopePreservationPass = false;
        scopePreservationExplanation = `Out-of-scope category (${cat.plan}, ${cat.organizationType}, verified: ${cat.universityVerified}) changed from baseline ${baselineDays} days to ${observedDays} days.`;
      }
    }

    // Evaluate cutoff boundaries
    const asOfMs = Date.parse(asOf);
    for (const age of BOUNDARY_AGES) {
      const createdMs = asOfMs - age * 86400 * 1000;
      const createdAt = new Date(createdMs).toISOString();
      const eligible = isEligibleForCleanup(createdAt, asOf, observedDays);

      const expectedEligible = age > observedDays;
      if (eligible !== expectedEligible) {
        boundaryCutoffPass = false;
        boundaryCutoffExplanation = `Boundary mismatch at age ${age} for retention ${observedDays} days: got eligible=${eligible}, expected=${expectedEligible}`;
      }
    }
  }

  return {
    targetPolicyCheck: {
      name: 'target_policy',
      status: targetPolicyPass ? 'pass' : 'fail',
      explanation: targetPolicyPass
        ? `All in-scope accounts resolve exactly to ${intent.retentionDays} days.`
        : targetPolicyExplanation,
      evidenceIds: [],
    },
    scopePreservationCheck: {
      name: 'scope_preservation',
      status: scopePreservationPass ? 'pass' : 'fail',
      explanation: scopePreservationPass
        ? 'All 12 attribute categories outside confirmed intent preserve baseline behavior.'
        : scopePreservationExplanation,
      evidenceIds: [],
    },
    boundaryCutoffCheck: {
      name: 'cutoff_boundaries',
      status: boundaryCutoffPass ? 'pass' : 'fail',
      explanation: boundaryCutoffPass
        ? 'Exact elapsed-day retention cutoffs evaluated cleanly across all boundary ages (0..91).'
        : boundaryCutoffExplanation,
      evidenceIds: [],
    },
  };
}

/** @accord/slack-delivery — deterministic finding renderer.
 * Formats a ThreadView into deterministic Slack-ready text under 3500 chars (aiming < 1800).
 * Escapes untrusted Slack markup, never converts null counts to 0, and avoids ungrounded claims.
 */
import type { Finding, FindingStatus, PolicyIntent, Scope, ThreadView } from '@accord/contracts';
import { LIMITS, ThreadViewSchema, validate } from '@accord/contracts';

/** Escapes special Slack mrkdwn control characters in untrusted text */
export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Formats a Scope into a human-readable English sentence */
export function formatScope(scope: Scope, days: number): string {
  const plans = scope.plans.join('/');
  const orgs = scope.organizationTypes.join('/');
  const verified = scope.universityVerified.includes(true) && !scope.universityVerified.includes(false)
    ? 'verified '
    : scope.universityVerified.includes(false) && !scope.universityVerified.includes(true)
      ? 'unverified '
      : '';

  return `${capitalize(plans)} ${verified}${orgs} accounts should retain existing records for ${days} days.`;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function statusHeadline(status: FindingStatus, version: number): string {
  switch (status) {
    case 'needs_clarification':
      return `Potential conflict; scope not confirmed · decision v${version}`;
    case 'conditional_impact':
      return `Conditional assessment; decision tentative · decision v${version}`;
    case 'confirmed_conflict':
      return `Confirmed implementation conflict · decision v${version}`;
    case 'no_conflict':
      return `No conflict found for this scope at this commit · decision v${version}`;
    case 'impact_unverified':
      return `Implementation conflict (data impact unverified) · decision v${version}`;
    case 'verification_failed':
      return `Verification failed · decision v${version}`;
    case 'verified_at_commit':
      return `Supported behavior verified at exact commit · decision v${version}`;
    case 'withdrawn':
      return `Triggering decision withdrawn; previous finding no longer active · decision v${version}`;
    case 'superseded':
      return `Earlier result superseded; updated interpretation being checked · decision v${version}`;
    case 'failed':
      return `Investigation incomplete · decision v${version}`;
    case 'investigating':
      return `Investigation in progress · decision v${version}`;
  }
}

/** Deterministic sanitized rendering of the current persisted view. No model call, no network. */
export function renderFinding(view: ThreadView, publicationId?: string): string {
  const validView = validate(ThreadViewSchema, view, 'renderFinding view');

  if (!validView.enrolled || !validView.finding) {
    return 'Accord is following this thread. I will compare confirmed retention decisions with the implementation and stored-record impact.';
  }

  const { finding, decision, contextRevision } = validView;
  const sections: string[] = [];

  // 1. Status and decision version
  sections.push(statusHeadline(finding.status, finding.decisionVersion));

  // 2. Confirmed or tentative scope in one sentence
  if (decision?.intent) {
    sections.push(formatScope(decision.intent.scope, decision.intent.retentionDays));
  } else if (finding.summary) {
    sections.push(escapeSlackText(finding.summary));
  }

  // 3. Observed implementation behavior with checked commit
  if (finding.repository) {
    const repo = finding.repository;
    const shortSha = repo.target.sha.slice(0, 7);
    let repoDesc = repo.summary ? escapeSlackText(repo.summary) : '';
    if (repo.conclusion === 'conflict' && repo.observedProjection) {
      repoDesc = `The checked cleanup path still uses ${repo.observedProjection.defaultDays} days.`;
    } else if (repo.conclusion === 'aligned') {
      repoDesc = `The checked code matches the intended retention policy at commit ${shortSha}.`;
    }
    if (repoDesc) {
      sections.push(repoDesc);
    }
  }

  // 4. Impact counts when complete; explicit unknown otherwise
  if (finding.impact) {
    const impact = finding.impact;
    if (impact.status === 'complete' && impact.prematurelySelectedRecords !== null && impact.prematurelySelectedAccounts !== null) {
      const records = impact.prematurelySelectedRecords;
      const accounts = impact.prematurelySelectedAccounts;
      sections.push(`${records} currently stored demo records across ${accounts} accounts would be selected too early at the demo clock. No records were deleted.`);
    } else if (impact.status === 'unavailable' || impact.status === 'unsupported' || impact.prematurelySelectedRecords === null) {
      sections.push('Data impact unverified; stored-record counts unavailable. No records were deleted.');
    }
  } else if (finding.status === 'confirmed_conflict' || finding.status === 'impact_unverified') {
    sections.push('Data impact unverified; stored-record counts unavailable. No records were deleted.');
  }

  // 5. The focused question or remaining failed check, if any
  if (finding.question) {
    sections.push(`Clarification needed: ${escapeSlackText(finding.question)}`);
  }
  if (finding.verification && finding.verification.verdict !== 'verified_at_commit') {
    const failedChecks = finding.verification.checks.filter((c) => c.status === 'fail');
    if (failedChecks.length > 0) {
      const checkNotes = failedChecks.map((c) => `${escapeSlackText(c.name)}: ${escapeSlackText(c.explanation)}`).join('; ');
      sections.push(`Failed checks: ${checkNotes}`);
    }
  }

  // 6. Up to 3 principal evidence links
  const evidenceItems = finding.evidence.slice(0, 3);
  if (evidenceItems.length > 0) {
    const links = evidenceItems.map((e) => {
      const safeSummary = escapeSlackText(e.summary || e.kind);
      if (e.locator.startsWith('https://') || e.locator.startsWith('http://')) {
        return `<${e.locator}|${safeSummary}>`;
      }
      return `${safeSummary} (${escapeSlackText(e.locator)})`;
    });
    sections.push(`Evidence: ${links.join(' · ')}`);
  }

  // 7. Limitations, especially deployment unverified and synthetic dataset
  const limits: string[] = [];
  if (finding.repository) {
    const shortSha = finding.repository.target.sha.slice(0, 7);
    limits.push(`Checked commit ${shortSha}; deployment unverified.`);
  } else if (finding.verification) {
    const shortSha = finding.verification.target.sha.slice(0, 7);
    limits.push(`Checked commit ${shortSha}; deployment unverified.`);
  }
  for (const lim of finding.limitations) {
    const escaped = escapeSlackText(lim);
    if (!limits.some((l) => l.includes(escaped))) {
      limits.push(escaped);
    }
  }
  if (limits.length > 0) {
    sections.push(limits.join(' '));
  }

  // 8. Nonsecret finding/update marker for reconciliation
  const deliveryMarker = publicationId ? ` · delivery ${publicationId}` : '';
  sections.push(`Accord finding ${finding.id} · update ${contextRevision}${deliveryMarker}`);

  const output = sections.join('\n');
  return output.slice(0, LIMITS.publicationText);
}

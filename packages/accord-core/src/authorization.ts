/** Deterministic authorization and state transitions.
 * The model proposes a disposition; this file decides what actually happens. A model returning
 * `confirm` for a non-owner is downgraded to a candidate — it cannot authorize itself.
 */
import { policyIntentHash } from '@accord/contracts';
import type { Decision, DecisionStatus, Interpretation, PolicyIntent } from '@accord/contracts';

export interface AuthorizationInput {
  interpretation: Interpretation;
  /** Trusted transport author of the triggering message, never a name quoted inside the text. */
  actorId: string;
  ownerId: string;
  current: Decision | null;
  snapshotComplete: boolean;
}

export type Outcome =
  | { kind: 'ignore'; reason: string }
  | { kind: 'status'; reason: string }
  | { kind: 'clarify'; question: string; intent: PolicyIntent | null; reason: string; downgraded: boolean }
  | { kind: 'decision'; status: DecisionStatus; intent: PolicyIntent | null; reason: string; downgraded: boolean }
  | { kind: 'verify'; pullRequestUrl: string; reason: string };

const OWNER_ONLY: ReadonlySet<Interpretation['disposition']> = new Set(['confirm', 'tentative', 'withdraw']);

const NEEDS_OWNER_APPROVAL =
  'This needs the decision owner to confirm the exact scope before it becomes binding. Current interpretation is shown above.';

/**
 * Resolves the model's proposal against actual authority and the current state.
 * Every downgrade carries a reason, so the published finding can say why.
 */
export function authorize(input: AuthorizationInput): Outcome {
  const { interpretation, actorId, ownerId, current } = input;
  const isOwner = actorId === ownerId;
  const proposedIntent = interpretation.intent;

  if (interpretation.disposition === 'irrelevant') {
    return { kind: 'ignore', reason: 'not a retention decision' };
  }
  if (interpretation.disposition === 'status') {
    return { kind: 'status', reason: 'status request' };
  }

  if (interpretation.disposition === 'verify_pr') {
    if (!interpretation.pullRequestUrl) {
      return {
        kind: 'clarify',
        question: 'Which pull request should I verify? Link it in this thread.',
        intent: null,
        reason: 'verification requested without a pull request link',
        downgraded: true,
      };
    }
    return { kind: 'verify', pullRequestUrl: interpretation.pullRequestUrl, reason: 'pull request linked for verification' };
  }

  // Authority check first. A non-owner may propose and clarify, never bind.
  if (OWNER_ONLY.has(interpretation.disposition) && !isOwner) {
    return {
      kind: 'decision',
      status: 'candidate',
      intent: proposedIntent,
      reason: `${interpretation.disposition} requested by a non-owner; recorded as a candidate amendment awaiting owner approval`,
      downgraded: true,
    };
  }

  if (interpretation.disposition === 'withdraw') {
    return { kind: 'decision', status: 'withdrawn', intent: current?.intent ?? null, reason: 'owner withdrew this change', downgraded: false };
  }

  if (interpretation.disposition === 'clarify') {
    return {
      kind: 'clarify',
      question: interpretation.question ?? 'Could you confirm the exact scope, retention period and whether this applies to records already stored?',
      intent: proposedIntent,
      reason: 'a required field or antecedent is ambiguous',
      downgraded: false,
    };
  }

  if (interpretation.disposition === 'tentative') {
    if (!proposedIntent && !current?.intent) {
      return { kind: 'clarify', question: askForCompleteIntent(), intent: null, reason: 'tentative statement without a complete intent', downgraded: true };
    }
    return { kind: 'decision', status: 'tentative', intent: proposedIntent ?? current?.intent ?? null, reason: 'owner marked this tentative', downgraded: false };
  }

  if (interpretation.disposition === 'propose') {
    if (!proposedIntent) {
      return { kind: 'clarify', question: askForCompleteIntent(), intent: null, reason: 'proposal is incomplete', downgraded: true };
    }
    return { kind: 'decision', status: 'candidate', intent: proposedIntent, reason: 'proposal recorded as a candidate', downgraded: false };
  }

  // disposition === 'confirm', by the owner.
  const intent = proposedIntent ?? current?.intent ?? null;
  if (!intent) {
    return { kind: 'clarify', question: askForCompleteIntent(), intent: null, reason: 'confirmation with no complete intent to confirm', downgraded: true };
  }

  // A bare 'yes' can only confirm the current unambiguous displayed interpretation.
  if (!proposedIntent && current) {
    if (interpretation.expectedDecisionVersion !== null && interpretation.expectedDecisionVersion !== current.version) {
      return {
        kind: 'clarify',
        question: 'The interpretation changed after that message. Please confirm the current one shown above.',
        intent: current.intent,
        reason: 'confirmation referenced an older decision version',
        downgraded: true,
      };
    }
    if (current.status === 'withdrawn') {
      return {
        kind: 'clarify',
        question: 'This change was withdrawn. Restate the intended retention policy if you want it back.',
        intent: null,
        reason: 'confirmation against a withdrawn decision',
        downgraded: true,
      };
    }
  }

  if (!input.snapshotComplete && !proposedIntent) {
    return {
      kind: 'clarify',
      question: 'I cannot see the whole thread, so I will not assume what is being confirmed. Please restate the scope and retention period.',
      intent: null,
      reason: 'incomplete thread snapshot; no antecedent may be fabricated',
      downgraded: true,
    };
  }

  return { kind: 'decision', status: 'confirmed', intent, reason: 'owner confirmed a complete intent', downgraded: false };
}

/**
 * Only the one configured repository is a supported verification target. A link to any other
 * repository is rejected rather than followed, and the prior finding is retained.
 */
export function isAllowedPullRequestUrl(url: string, repository: { owner: string; name: string }): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return false;
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 4 || segments[2] !== 'pull') return false;
  return segments[0]?.toLowerCase() === repository.owner.toLowerCase()
    && segments[1]?.toLowerCase() === repository.name.toLowerCase()
    && /^\d+$/.test(segments[3] ?? '');
}

function askForCompleteIntent(): string {
  return 'Which accounts does this cover (plan, organization type, university verification), how many days should records be kept, and does it apply to records already stored?';
}

/** Repeating the same status and intent is idempotent: no extra policy version is created. */
export function isMaterialChange(current: Decision | null, status: DecisionStatus, intent: PolicyIntent | null): boolean {
  if (!current) return true;
  if (current.status !== status) return true;
  const currentHash = current.intentHash;
  const nextHash = intent ? policyIntentHash(intent) : null;
  return currentHash !== nextHash;
}

export function confirmationFields(status: DecisionStatus, actorId: string, now: string): { confirmedBy: string | null; confirmedAt: string | null } {
  return status === 'confirmed' ? { confirmedBy: actorId, confirmedAt: now } : { confirmedBy: null, confirmedAt: null };
}

# Acceptance tests, integration gates and final repository review

This is a verification specification, not a claim that tests have been run. Review at the final submitted commit. Any advertised capability missing real evidence remains pending. A passing deterministic test suite is necessary but not sufficient for a live hackathon demo.

## 1. Required root commands

Agent 1 adds these root scripts; Agent 4 provides script implementations where owned. Use these exact names so reviewers do not guess commands. Document prerequisite credentials/services for each.

| Command | Purpose | Missing prerequisites |
|---|---|---|
| `npm ci` | Reproducible root install from committed lockfile | Fail normally |
| `npm run typecheck` | All retained workspaces | Nonzero on errors |
| `npm test` | Offline deterministic tests, no credentials | Must run without live secrets |
| `npm run verify` | Typecheck + offline tests | Nonzero on failure |
| `npm run test:integration` | Real PostgreSQL/ClickHouse + package integration | Fail with clear missing-service reason |
| `npm run test:live` | Explicit real-provider/live-flow checks | Report pending/missing configuration; never fake pass |
| `npm run dev:slack` | Actual CopilotKit direct Slack bridge | Fail clearly if required config absent |
| `npm run dev:worker` | Trigger.dev development worker | Fail clearly if unconfigured |
| `npm run db:migrate` | PostgreSQL migrations | Explicit database connection |
| `npm run demo:seed` | Seed isolated ClickHouse dataset | Admin credentials, demo mode |
| `npm run demo:reset` | Prepare new isolated demo run | Refuse non-demo targets |
| `npm run demo:preflight` | Safe dependency/state readiness | Nonzero if demo-critical check fails |
| `npm run demo:prepare-prs` | Prepare fixture patch branches; pushing explicit flag | No automatic remote writes by default |
| `npm run review:evidence` | Produce sanitized review manifest | Mark absent checks pending |

Do not implement a placeholder script that only prints success. Root scripts may delegate to workspaces/tsx. Pin CLI dependencies in package manifests rather than allowing an uncontrolled latest version on stage.

## 2. Gates

### Gate 0 — foundation and transport proof

- Target bootstrapped from recorded starter SHA, licenses preserved, four branches share bootstrap.
- Contracts compile and examples validate. Channels/runtime/AG-UI versions deduped.
- Real direct Slack mention and normal enrolled reply received with trustworthy IDs.
- Real delayed same-bot Slack post/update succeeds after original handler returns.
- Real model, Trigger, GitHub and ClickHouse credentials smoke-tested.
- No service claims readiness merely because its HTTP port opens.

Do this early. A missing Slack permission discovered at the end is a product blocker.

### Gate 1 — independent package completion

Each owner passes its own unit/contract tests. No test-only imports in production entrypoints. Factories match shared ports and have no side effects on import. No cross-owner root lockfile edits.

### Gate 2 — integrated deterministic workflow

Real PostgreSQL, real ClickHouse and actual trusted fixture code; controlled model/Slack adapters may isolate timing. Assert state, counts, evidence and recovery, not only snapshots of rendered text. Missing provider calls remain explicitly harnessed.

### Gate 3 — real end-to-end flow

Actual Slack conversation -> actual model investigation -> actual GitHub SHA evidence -> actual ClickHouse query -> actual Trigger task -> actual Slack finding. Follow-up changes state. PR verification is real. A screenshot or prerecorded JSON does not substitute for this flow.

### Gate 4 — stage rehearsal and submission

At least3 consecutive complete rehearsals from fresh demo runs with recorded outcomes. Target baseline investigation under60s in rehearsal; measure actual p50/p95 when enough samples exist, and never claim a percentile from three samples. If slower, shorten evidence budgets while preserving real work or revise demo pacing. Freeze code after successful rehearsal except necessary fixes followed by rerun.

## 3. Canonical scenarios

The decision for numerical assertions: free verified university accounts,90 days, existing records, immediately. Fixed clock/data from shared spec. Each scenario logs decision version, repo SHA, datasetVersion and asOf.

| ID | Scenario | Expected evidence/state |
|---|---|---|
| A01 | Ambiguous 'universities get90' | One focused scope question; no confirmed conflict |
| A02 | Owner confirms exact intent on baseline | confirmed_conflict; 7 premature records/2 accounts; 9 observed vs2 intended in cohort |
| A03 | Existing exact override90, default30 remains | no_conflict for target;0 premature; evidence identifies override |
| A04 | Owner says tentative | conditional_impact; former confirmed warning replaced/superseded |
| A05 | Owner withdraws | withdrawn; pending older results fenced |
| A06 | Non-owner attempts confirmation/withdrawal | no unauthorized state transition |
| A07 | Scope changed while old run delayed | old run not current; latest data recalculated; final Slack state current |
| A08 | Linked UI-only PR | verification_failed/still_conflicting; premature7 |
| A09 | Linked generated-only change | non_durable; explain temporary runtime improvement if present |
| A10 | Source-only change | generator mismatch, runtime still30; not verified |
| A11 | Correct source+generated change | verified_at_commit;0 premature; no out-of-scope changes; deployment unverified |
| A12 | Overbroad default90 change | scope_regression; never fully verified |
| A13 | Unsupported runtime change | insufficient_evidence; no arbitrary remote execution |
| A14 | DB unavailable | impact_unverified; counts null, never zero |
| A15 | One transient DB timeout | bounded recovery, real succeeding query, correct finding |
| A16 | Duplicate event/action | no extra policy version or uncontrolled duplicate publication |
| A17 | Restart after durable checkpoint | job resumes/reconciles, evidence retained |
| A18 | Slack acceptance response lost | uncertain/reconciled; no blind repost |
| A19 | Foreign channel/repo/dataset | blocked before credentialed access |
| A20 | Synthetic secret + malicious instruction in source | no secret in model/log/Slack sinks, no new tool target |
| A21 | Exact cutoff boundaries | age30 retained under 30; age90 retained under 90 |
| A22 | Empty/truncated history | incomplete context visible; no invented quotation |
| A23 | Stale native action if buttons shipped | stale rejected with current interpretation |
| A24 | Shipped native interaction after restart | safe handler/current state; no dead approval UI |
| A25 | Meaning-preserving paraphrases | same policy scope; conclusions evidence-derived |
| A26 | Intent asks prospective/future policy | clarification/unsupported; no silent immediate interpretation |

A09/A10/A12/A13 are mandatory deterministic tests; live A09 is recommended if time permits. Required live product evidence: A01,A02,A03,A04,A08,A11 and a real delayed background post. Live provider outage injection can be harness-controlled but must be accurately labeled. All advertised controls require their own live proof.

## 4. Exact numerical checks

Dataset contains19 records,6 accounts. Baseline selected total17. Intended correct target policy selected total10. Target selected baseline9/intended2. Premature7 across 2 accounts. Compare selected IDs as well as counts in diagnostic tests; identical counts can conceal wrong populations.

For overbroad default90, target difference may be0, but control age31 records stop being selected:4 out-of-scope records change in the19-row fixture. Whole selected total becomes6. Expected intended total remains10 against frozen baseline. The all 12-category policy matrix catches additional unseeded scope changes.

Generated-only with exact target override in artifact: observed target selection2 and premature0 may be correct at that commit, yet consistency fails. Do not assert premature7 merely because the source was not changed. Source-only remains observed9/premature7.

## 5. Two-minute demonstration script

Prepare real accounts/credentials/PRs first; record actual URLs. Seeded code/data are disclosed. Avoid manually typing structured data.

0:00–0:15 — Show the enrolled Slack thread and owner message: 'Free accounts with verified university status should retain their existing records for 90 days, starting now.' State the problem in one sentence.

0:15–0:50 — Accord investigates. Show actual tool/Trigger status briefly if useful, then the Slack finding:7 records/2 accounts, exact code link and query evidence. No record deletion occurs.

0:50–1:10 — Owner says 'Actually this is tentative until review.' Finding becomes conditional. Confirm again through a complete owner reply or shipped control. Do not hide new latency with prerecorded results; choose pacing from rehearsal.

1:10–1:35 — Link the real UI-only PR. Accord rejects it because cleanup behavior remains unchanged.

1:35–2:00 — Link the correct preprepared PR. Accord verifies source/generated consistency and scoped behavior at its head SHA. Deployment remains unverified.

If live timings cannot fit all steps reliably, use the two-minute video to show one uncut complete core flow and present the negative-control/verification evidence separately; do not claim a flawless two-minute sequence that has not been rehearsed. The existing-override negative control is excellent judge Q&A material.

## 6. Final code review checklist

- [ ] Correct target origin and recorded starter/implementation provenance.
- [ ] Clean committed lockfile; exact starter pair preserved; no duplicate incompatible AG-UI client.
- [ ] No accidental modified starter sample presented as original functionality.
- [ ] Shared types + runtime schemas match every package boundary.
- [ ] No module-import network side effects outside executable composition.
- [ ] Real provider adapters wired in live entrypoints; no silent mocks.
- [ ] Model interprets intent and repository agent actually selects evidence tools.
- [ ] Owner authorization is deterministic and transport-bound.
- [ ] Decision version/contextRevision fencing is transactional.
- [ ] Durable job-intent outbox prevents event/Trigger dispatch loss.
- [ ] Durable publication outbox handles uncertain sends and current revisions.
- [ ] Same Slack bot handles native surface and background finding.
- [ ] No invented SDK calls or persisted live Thread objects.
- [ ] Repository evidence pinned to one SHA; baseline/candidate kept separate.
- [ ] Source/generated/runtime distinctions truthful.
- [ ] Unknown runtime cannot run arbitrary code or get green verification.
- [ ] Real ClickHouse read-only identity and query constraints tested.
- [ ] No null-to-zero impact fallbacks.
- [ ] Exact boundary and control-category tests pass.
- [ ] Redaction tested before model/log/Slack sinks; no secret files committed.
- [ ] Native actions if shipped survive restart safely.
- [ ] Cloud Run persistent connection/resource settings validated; readiness accurate.
- [ ] Live evidence tied to the final commit or rerun after changes.
- [ ] README describes exact supported scope and pending checks honestly.

## 7. Review manifest shape

Agent 4 writes JSON with this logical schema (implement validation in tests/e2e or scripts, not by changing core public contracts):

```json
{
  "schemaVersion":1,
  "repository":"ShreyanshGoyal/top_secret",
  "commitSha":"<actual full SHA>",
  "dirty":false,
  "starterSha":"<actual full SHA>",
  "lockfileSha256":"<actual digest>",
  "generatedAt":"<actual UTC time>",
  "datasetVersion":"<actual immutable dataset>",
  "asOf":"2026-09-12T00:00:00.000Z",
  "commands":[{"command":"npm run verify","exitCode":0,"classification":"offline","resultPath":"<actual path>"}],
  "scenarios":[{"id":"A02","classification":"live","status":"pass","expected":{"prematureRecords":7,"accounts":2},"actual":{"prematureRecords":7,"accounts":2},"evidenceRefs":["<actual allowed references>"]}],
  "providers":{"slack":"tested","openai":"tested","github":"tested","clickhouse":"tested","trigger":"tested"},
  "deployment":{"revision":null,"tested":false},
  "pending":[],
  "limitations":["Verification applies to supported fixture commits; deployment unverified."]
}
```

The example is a schema illustration, not a result to copy as passed. Every actual status must come from a check. Use `pending`/`failed` for unavailable providers and null instead of invented links/IDs. Include outputs only after sanitization.

## 8. What to give the final reviewer

Provide repository URL, exact branch/full commit SHA, review manifest, how to run verification, required service setup names and a short list of known gaps. Do not paste secrets into the review request. Provide access through the team's normal mechanism if the repository is private. The reviewer should inspect implementation, run available tests and compare each advertised feature to its evidence; a README claim alone does not pass.

The four owners should each include one paragraph naming what they built and what remains unverified. A truthful missing live check is actionable. A fabricated pass prevents useful review.

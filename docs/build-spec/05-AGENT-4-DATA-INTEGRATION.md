# Agent 4 — ClickHouse impact, privacy, deployment and integration proof

## Assignment

Own `packages/data-impact/**`, `packages/privacy/**`, `infra/**`, `scripts/**`, `tests/e2e/**`, `tests/live/**`, root README.md and SUBMISSION.md. Implement ImpactPort and PrivacyPort; integrate all four real packages after their public interfaces land. Agent 1 owns root lockfile/env/scripts and PostgreSQL migrations; request changes instead of editing those concurrently.

This workstream can implement its database, privacy utilities and contract-level tests without Slack or the coordinator. End-to-end testing waits for the packages, but test design and infrastructure do not.

## 1. File layout

```
packages/data-impact/src/{index,client,compiler,analyze,evidence,config}.ts
packages/data-impact/test/{impact,limits,query-contract}.test.ts
packages/privacy/src/{index,redaction,audience,paths,logger}.ts
packages/privacy/test/{redaction,audience,injection}.test.ts
infra/clickhouse/{schema,roles}.sql
infra/clickhouse/seed/{accounts,records}.json
infra/{compose.yaml,Dockerfile.channel,cloud-run.md}
scripts/{dev-up,seed-demo,reset-demo,prepare-demo-prs,preflight,collect-evidence}.ts
scripts/scenarios/{messages,expected-results}.json
 tests/e2e/{workflow,recovery,privacy,verification}.test.ts
 tests/live/{slack-flow,provider-smoke}.test.ts
README.md
SUBMISSION.md
```

No user-facing dashboard or PDF is required. Focus on the Slack product and reproducible evidence. Package factories have no connection side effects on import.

## 2. ClickHouse schema

Use one isolated demo database, two source tables and one restricted joined view. Minimum logical columns:

`accounts`: dataset_version String, account_id String, plan String, organization_type String, university_verified Bool.
`records`: dataset_version String, record_id String, account_id String, created_at DateTime64(3,'UTC').
`accord_retention_view`: joined rows for matching dataset_version/account_id exposing only those fields.

Validate enumerated strings at ingestion and request boundaries. Use a deterministic seed procedure; repeated setup for the same version must not duplicate rows. It is acceptable to recreate only the isolated demo tables during explicit seed setup, but never from a runtime request. Confirm joins include dataset_version to avoid mixing resets.

Read-only runtime role: SELECT only on the approved view, no arbitrary table/function/network access or write permissions. Admin seed credentials are separate. Prove the actual runtime credential cannot INSERT/DELETE/DROP and cannot read an unrelated table. Do not claim privacy from UI hiding alone.

Ordinary demo reset creates a fresh run/thread context while reusing the configured immutable datasetVersion. Never mutate referenced rows in place. A changed fixture needs a new seeded version, verified counts, explicit environment update and bridge/worker restart before activation. Do not pretend a script can change another running process environment. Persist the selected version in every investigation.

## 3. Exact fixture

Clock `2026-09-12T00:00:00.000Z`. Generate created_at by subtracting exact ageDays*86,400,000 milliseconds. Stable record IDs `<account>-r<age>`. Use the account/age table in shared spec verbatim.

Required baseline assertions:

- accounts=6, records=19.
- Confirmed cohort free+university+verified: accounts 2, records11.
- Baseline policy30: selected total17, selected in scope9.
- Intended exact target90 with controls30: selected total10, selected in scope2.
- Premature records 7, affected accounts 2, over-retained0.
- Premature IDs exactly a01-r31,a01-r89,a01-r90,a02-r31,a02-r60,a02-r89,a02-r90.
- Age30 is retained under 30; age90 retained under 90; age91 selected under both.
- Controls select8 under both baseline and intended policy.

Do not place these counts in a production canned response. Derive them from actual ClickHouse queries. Keep expected-results JSON only in tests/demo verification. Read-only diagnostics may return synthetic record IDs to test harnesses, but normal ImpactReport/Slack uses aggregates.

## 4. Impact compiler and analysis

Input is ImpactRequest, not arbitrary SQL. Validate all fields using shared contracts and enforce permitted dataset/audience through the composition.

Build a small parameterized SQL compiler for RetentionProjection and Scope. Only three known account fields are available. Enum values/days/time/dataset are parameters; fixed identifiers come from code. No model-supplied table name, column name, function, SQL fragment, LIMIT or connection string.

For each approved joined row, calculate:

- `inScope`: conjunction of three scope memberships.
- `observedDays`: first matching observedProjection rule, otherwise defaultDays.
- `baselineDays`: first matching baselineProjection rule, otherwise defaultDays.
- `intendedDays`: intent.retentionDays in scope, baselineDays outside scope.
- `observedSelected`: strict timestamp < asOf - observedDays days.
- `baselineSelected`: same for baselineDays.
- `intendedSelected`: same for intendedDays.

Aggregations:

- eligibleAccounts=count distinct accounts where inScope; eligibleRecords=count rows where inScope.
- observedSelectedInScope=count(inScope AND observedSelected).
- intendedSelectedInScope=count(inScope AND intendedSelected).
- prematurelySelectedRecords=count(inScope AND observedSelected AND NOT intendedSelected).
- prematurelySelectedAccounts=distinct account IDs in that same difference.
- overRetainedRecords=count(inScope AND NOT observedSelected AND intendedSelected).
- outOfScopeChangedRecords=count(NOT inScope AND observedSelected != baselineSelected).
- total selections over all approved rows.

Use exact timestamp arithmetic and bound UInt/Bool conversions deliberately. Query one immutable dataset per analysis. Never infer impacted population from an LLM estimate. A data result is about currently stored rows and a predicate at the captured clock, not historical deletion or deployed job activity.

Initial limits: 10-second server query time, 15-second client request timeout, bounded read rows/bytes suitable for demo, aggregate result max1 row, diagnostic samples max20 rows. For fixed projection max 12 rules. Cancellation propagates to client where supported. If runtime permission denies settings changes, configure limits in the role/profile instead of weakening permissions.

Build query evidence: actual query ID, sanitized SQL template, bound nonsecret policy/dataset/time parameters, observedAt, repository evidence IDs and run identity. No database credentials or raw response body. Query locator is `accord-query:<id>`; do not invent a public ClickHouse console link. A Slack status/detail interaction may show safe query text.

Error handling: unavailable/unsupported result has null numerical fields and PublicError. No catch that returns all zeros. Retry transient faults in exactly one documented layer coordinated with Agent 1. A genuine empty result from a successfully queried ready dataset is zero; an unknown/missing dataset is an error.

## 5. PrivacyPort

Implement sanitize, assertAudience and assertAllowedPath exactly as the shared port. Sanitization is idempotent and preserves newline counts for code evidence. Return redacted placeholders; do not log original content while redacting it.

Required protections:

- Block secret-bearing paths before model retrieval: environment files, private key material, credential/config stores known to contain secrets. Allow the intentional generated policy JSON path.
- Redact known configured secret values if accidentally present in permitted text, plus selected recognizable credential patterns and the synthetic sentinel. Do not dump environment variables into prompts just to create a redaction list.
- Limit text lengths before provider submission and logs; retain source locator metadata.
- Escape or reject unsafe Slack mention/link syntax at the rendering boundary owned by Agent 2.
- Audience mapping: exact team/channel/repository/dataset allowlist; fail closed if missing or mismatched.
- Safe logger: IDs, phase, duration, counts and sanitized error codes only. No raw Slack messages, repository files, model prompts, token headers, connection URLs or customer rows.

Privacy scope is explicit. This is a bounded set of guards, not a universal secret detector or an enterprise DLP claim. OpenAI and connected services receive the allowed sanitized evidence needed for the investigation; do not claim all processing stays local.

Untrusted repository/Slack instructions cannot request new tools or network destinations. Test at the actual adapter boundary: malicious source asks to exfiltrate a key to an external URL; no such tool invocation or outbound target is allowed.

## 6. Privacy test fixtures

Use fake markers only, e.g. `ACCORD_TEST_SECRET_DO_NOT_DISCLOSE_` plus generated random suffix. Include a credential-shaped fake token in an otherwise allowed source file and a blocked .env path. Capture model adapter input, safe log sink, exception output and Slack publication payload. Assert the marker/full token/sensitive suffix never appears in any sink.

Test unauthorized channel before reads, unauthorized repo before GitHub call, wrong dataset before ClickHouse query, and a user message asking for raw account records. Ensure only approved aggregates are available through the production tool. Test small-cohort suppression only if adding it deliberately; for this fully synthetic demo show exact required counts and label the data.

## 7. Local infrastructure and process ownership

Compose may run PostgreSQL and ClickHouse locally for integration testing. Pin image versions/digests during implementation and document them. Use real services; do not replace ClickHouse with an in-memory array while calling the result integrated. PostgreSQL migrations come from Agent 1; your setup invokes them without rewriting them.

Processes in development:

1. PostgreSQL/ClickHouse dependencies.
2. Migration/seed command, explicit operator action.
3. One Channels bridge.
4. Trigger.dev development worker using actual project credentials.

Expose preflight output listing each dependency as available/unavailable without credentials. `dev-up` does not silently seed or reset an active dataset. `reset-demo` creates a fresh isolated run referencing the same immutable configured dataset and records metadata; it does not delete Slack channel history. Old findings can remain labeled by their run/version. Starting a new demo thread is acceptable and safer than editing history.

## 8. Demo scenario preparation

Agent 3 supplies patch assets. Your explicit operator script may create local fixture branches from a known baseline and push to the configured target when the team invokes the publish flag. Default dry-run/local behavior must not write to GitHub. Tests never push. Use actual created PR URLs and SHAs in a `demo-manifest.json`, not placeholders presented as live evidence.

Required branch scenarios: baseline, existing override negative control, UI-only fix, correct fix. Generated-only and overbroad should be easy to prepare and are required offline checks. Prevent path changes outside fixtures/retention-app in demo patches. Keep baseline reference fixed while showing a PR. Do not merge a demo PR just to fake verification; head-commit verification is sufficient.

The demo manifest includes repository, baseline SHA/ref, fixture prefix, datasetVersion, fixed asOf, actual PR numbers/head SHAs and supported trust profile version. No expected conclusion is given to the live model as an instruction. The operator controls which real scenario it presents; the agent must derive the result.

A one-command reset/preflight is the operator's one-click launch. Judges interact through Slack text/cards without uploading structured policy files. Do not build a second full UI solely for a reset button.

## 9. Cloud Run deployment

Deploy only after the team invokes the documented deployment procedure. Configuration must support a persistent Channels/Socket Mode connection. Use at least1 minimum instance and CPU outside HTTP requests/instance-based billing as appropriate; cap bridge scaling to1 for the demo. A rolling replacement can overlap, so implement/test the lease/dedupe behavior agreed with Agent 1/2. Single-instance configuration alone is not an exactly-once guarantee.

Use external PostgreSQL and ClickHouse endpoints reachable by bridge/workers. Local container filesystem is not durable application storage. Trigger.dev hosts the actual investigation tasks; do not deploy a Cloud Run HTTP handler that performs the entire job after returning without durability.

Separate runtime service identities/secrets by role:

- Bridge: Slack, Intelligence, PostgreSQL/Trigger ingress as required.
- Worker: OpenAI, GitHub read, ClickHouse read, PostgreSQL, Slack outbound as required.
- Seed operator: admin database credentials, absent from normal services.

Avoid exposing unauthenticated mutation/debug/reset endpoints. HTTP health endpoints return safe liveness/readiness only. The direct Slack socket is the ingress; no second public event webhook is needed. Set Node port to Cloud Run PORT and wire graceful shutdown. Pin deployed image/commit metadata. Document rollback to a prior known revision, and do not claim deployment success from a build alone.

## 10. End-to-end test layers

A. Offline contract/unit: fake network/model adapters explicitly injected. Proves deterministic business logic and schemas.
B. Local integration: actual PostgreSQL and ClickHouse plus real fixture code/evaluator; transport/model may be harnessed and must be labeled.
C. Provider smoke: real GitHub, OpenAI, Trigger and Slack separately with synthetic content.
D. Live product: one real Slack thread through all services and back, including clarification and PR verification.

Never promote A/B to D in report wording. If credentials are missing, live tests are reported skipped/pending, not passed. Root review command should surface pending advertised live checks prominently.

## 11. Failure injection and acceptance

Implement fault injection as test/development dependency configuration, never a model tool or production Slack command.

- First data request times out, second executes against real ClickHouse. Assert bounded recovery and correct counts.
- Permanent data outage -> impact_unverified, null counts, code evidence preserved.
- Hold a query, send new owner scope/tentative statement, release old query -> old report not authoritative; latest visible result converges.
- Duplicate event -> no repeated policy version or repeated finding.
- Kill worker after evidence checkpoint -> resume/reconcile, no lost job.
- Lose Slack post response after simulated acceptance -> uncertain/reconciled, no blind duplicate.
- Change runtime digest -> verification unsupported; no remote code execution.
- Unauthorized resource -> no credentialed read.

Use deterministic synchronization barriers in tests rather than sleeps for race ordering. Measure real live timing separately.

## 12. README and submission

One product README must contain: pitch; supported scope; short architecture; setup prerequisites; exact commands; env names without values; Slack installation; seed/reset; two-minute demo; tests and their classifications; read-only/privacy boundaries; failure meanings; known limitations; inherited starter SHA and original work attribution. Link the detailed spec rather than duplicating it. Include required event submission fields in SUBMISSION.md, using verified local organizer requirements; do not invent deadlines or scoring guarantees.

## 13. Evidence handoff

Generate sanitized `artifacts/review-manifest.json` (ignored if containing private Slack links), `artifacts/test-results/` and optional screenshots/video references. Include final commit SHA, dirty-state flag, lockfile hash, package versions, datasetVersion/asOf, commands and exit codes, test classifications, scenario expected/actual values, Trigger run IDs, actual Slack/GitHub links, deployed revision if applicable, limitations and pending checks.

Do not commit credentials or private message text. Screenshots supplement assertions; they cannot replace state/query proof. The review manifest format is in06.

Your workstream is done when real ClickHouse and privacy tests pass, scenario setup is repeatable, all merged packages pass integrated checks, and live evidence is recorded honestly. If another component is unfinished, report the exact failed contract/acceptance ID rather than building an incompatible substitute.

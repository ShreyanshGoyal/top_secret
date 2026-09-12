# Shared contract and product invariants — all four owners

This file and `contracts.ts` are normative v1.0 application contracts. The names here are names we are defining, not claims about third-party SDK exports. Agent 1 owns their implementation in `@accord/contracts`. All owners import that package. No runtime package imports another owner's internal files.

## 1. Package public surfaces

| Package | Owner | Required export |
|---|---|---|
| `@accord/contracts` | 1 | Types in contracts.ts; corresponding strict Zod schemas; schemaVersion; canonical hashing and scope validation helpers |
| `@accord/store` | 1 | PostgreSQL store factory, migration entry, transaction helpers used by core |
| `@accord/core` | 1 | `createApplication(deps): ApplicationPort`; `createConfiguredApplication(): Promise<ApplicationPort>`; `processContext(deps, payload)`; `runInvestigation(deps, run)`; `publishPending(deps, publicationId)` |
| `@accord/repo-investigator` | 3 | `createRepositoryPort(config, deps): RepositoryPort` |
| `@accord/data-impact` | 4 | `createImpactPort(config, deps): ImpactPort` |
| `@accord/privacy` | 4 | `createPrivacyPort(config): PrivacyPort`; safe logger factory |
| `@accord/slack-delivery` | 2 | `createPublisherPort(config, deps): PublisherPort`; `renderFinding(view): string` |
| `@accord/retention-fixture` | 3 | Trusted policy parser, resolver, cleanup eligibility and dry-run evaluator; no network/DB side effects |

Public factory signatures are fixed as follows: repository `(config: RepositoryConfig, deps: ProviderDependencies)`, impact `(config: ImpactConfig, deps: ProviderDependencies)`, privacy `(config: PrivacyConfig)`, publisher `(config: PublisherConfig, deps: PublisherDependencies)`. All types are in contracts.ts. Private test constructors may inject SDK fakes, but these production signatures must remain stable. Agent 2 starts core through `await createConfiguredApplication()`; Agent 1 owns this composition and environment parsing, so Agent 2 does not need to invent store/scheduler constructor wiring. It has no import-time effects. Agent 1 must finish and publish its internal store/scheduler/configuration types as part of bootstrap acceptance before parallel work begins.

Factories are dependency-injected. Agent 1 freezes exact configuration/dependency constructor types during bootstrap along with the named port types. Do not make runtime import start a server or connect to Slack. The channel executable and Trigger task entry files perform composition explicitly.

Core dependency roles: store, model, job scheduler, repository port, impact port, privacy port, clock and safe logger. Ingress composition needs only store/scheduler/privacy/clock; full investigation composition supplies model/repository/impact. Publishing composition needs store/publisher/privacy/clock. Split constructors internally if needed, but the public ApplicationPort remains unchanged.

## 2. Validation and serialization

- Validate every external event, model output, tool argument, persisted JSON payload and package-boundary result with the strict matching schema.
- Reject unknown object keys. Required nullable fields use `null`, not an omitted value; this simplifies model structured output. Arrays have size limits. No `any` or implicit unchecked casts at boundaries.
- Schema validation establishes shape, not authorization or truth. Perform those checks separately.
- IDs: server-generated UUIDs except provider IDs, event dedupe keys, dataset version and evidence keys. Git SHA is the full 40-hex supported GitHub SHA; never use an abbreviated SHA for fetching.
- Times: normalize UTC ISO milliseconds. Slack `ts` stays a string; do not convert through floating point. Parse/compare whole and fractional decimal components safely when ordering.
- Scope values: nonempty arrays with no duplicates, canonical order `free,paid`; `university,company,personal`; `false,true`. Values within each field are OR; the three fields are AND. Explicit arrays containing every allowed value mean any, but missing scope does not mean any.
- Retention days: integer 1..3650. Ordered projection rules: max 12, unique IDs, first match wins. Unsupported or ambiguous rule shapes fail closed.
- Policy hash: SHA-256 over deterministic JSON of normalized intent. Include scope, days, appliesTo and effective. Exclude evidence prose, status and timestamps.
- Contract version is `1.0`. Do not silently coerce a different version.

## 3. Identity, audience and authorization

Server configuration supplies permitted team/channel, repository owner/name, dataset and one owner Slack user ID. The agent never chooses its own authorized resources. Enrollment does not grant access to another channel or repository. A message claiming to be the owner is not identity evidence.

Only a transport-authenticated owner can confirm, mark tentative or withdraw. Other participants may propose/clarify; their statements cannot become binding until owner confirmation. An owner message can establish a clear complete decision directly, but a bare 'yes' can only confirm the current displayed interpretation when its scope/version is unambiguous. Otherwise ask for confirmation of the displayed interpretation. An old UI action must include expected version and expected context revision; reject stale actions visibly.

Normal owner text remains a fully functional control path even if a native button is unavailable. No production action is authorized by any of these controls; they establish intended policy only.

All evidence is for the one preauthorized channel audience and synthetic dataset. Do not assume bot access implies every channel member may see a source. Before storage/model use sanitize input; before publication recheck audience and sanitize output. No dynamic arbitrary fetch URL tool.

## 4. Thread enrollment and event semantics

- One mention enrolls that thread. Bot messages, background findings and this app's own updates must never re-trigger investigations.
- Unenrolled ordinary messages are ignored. This version does not advertise ambient monitoring of all channel conversations.
- EventKey: prefer provider event ID where exposed. Otherwise use a deterministic hash over team, channel, message ts, event kind and edited ts/content digest. Two edits to one message are distinct events. Never use only message ts for edited events.
- Persist dedupe and contextRevision transactionally. Each accepted human event increments contextRevision, including an edit/deletion. This immediately fences older reasoning before another LLM call completes.
- An irrelevant message may preserve the policy version and visible finding content, but a replacement orchestration pass must validate freshness before carrying forward evidence. No obsolete pass is permitted to overwrite state.
- `snapshot` has max 50 messages and 30,000 sanitized characters. Preserve the root, owner policy messages and newest messages. If context is incomplete, `snapshotComplete=false`; do not confirm from absent antecedents. Ask a focused question when omission matters.
- Message deletion of a source withdraws confidence in that source. Reconstruct from remaining evidence; do not silently keep deleted approval as active authority.
- Raw message edits/deletions support must be verified in the installed adapter during gate zero. If they are not exposed, reconcile snapshots on subsequent deliveries and document that silent edits are detected only at that next event; immediate silent-edit monitoring is not an MVP claim.

## 5. Separate policy, run and delivery state

Do not overload one status enum for everything.

### 5.1 Decision state

`candidate`: incomplete or awaiting owner confirmation.
`tentative`: useful conditional assessment; not a confirmed requirement.
`confirmed`: complete intent supported by an authorized owner.
`withdrawn`: owner has explicitly withdrawn this intent.

A material intent change, confirmation, tentative transition or withdrawal creates a new immutable Decision version. Latest version is referenced by the thread row. Repeating the same confirmed intent without a material change is idempotent. Context revision can advance without a decision version change.

Any new intent invalidates old confirmation. A non-owner saying 'actually, all universities' creates a candidate amendment; it cannot silently rewrite the owner-confirmed policy. Show 'scope clarification awaiting owner' and preserve the prior version in history.

### 5.2 Investigation state (internal)

`queued -> interpreting -> waiting_for_clarification | investigating -> analyzing_impact -> verifying -> completed`

Additional terminal states: `superseded`, `failed`, `cancelled`. `verifying` is entered only for linked-PR mode. Retry counters and evidence checkpoints are separate columns. A technical error does not change a confirmed decision into tentative.

### 5.3 Finding state

Use `FindingStatus` from contracts.ts. Mandatory distinctions:

- Candidate ambiguity -> `needs_clarification`.
- Tentative intent with evidence -> `conditional_impact`, never 'confirmed conflict'.
- Established contradictory behavior + complete population evidence -> `confirmed_conflict`.
- Established code contradiction, database unavailable -> `impact_unverified`; explain code evidence remains.
- Aligned relevant behavior and known path -> `no_conflict`, bounded to the checked scope/commit.
- No trustworthy path -> `failed` or `needs_clarification` with limitations, not `no_conflict`.
- Verified supported fix -> `verified_at_commit`, always `deployment=unverified`.
- Owner withdraws -> `withdrawn`; stop continuing investigation for that version.

### 5.4 Delivery state (internal)

`pending`, `sending`, `delivered`, `uncertain`, `retryable`, `permanent_failure`, `superseded`. Store the publication payload/revision, attempt, bot message ts and lease. A completed investigation can still have a pending publication. Do not misreport a Slack error as investigation failure.

## 6. Publication ordering and unavoidable race boundary

Before accepting any result into active state, compare decision version AND contextRevision in one database transaction. If either differs, store result only as historical/superseded and do not enqueue it as current.

Insert the active finding and its outbox publication atomically. A publication worker locks/leases one row, rechecks current versions and sends outside the transaction. On response, persist delivery. If context changed during the external call, enqueue a corrective latest update immediately.

A database transaction cannot make a Slack network call atomic. The guarantee is: obsolete results cannot become the authoritative current finding, queued obsolete sends are skipped, and an already-in-flight obsolete send is corrected promptly. Never claim mathematically exact once-only external delivery or zero stale milliseconds.

Publication receipts are persisted in PostgreSQL by `ApplicationPort.recordPublicationReceipt` after the bridge authenticates the event as its own bot in the allowed channel. `PublicationReceiptReader` gives the separately running publisher access to those same records. No process-local cache is the sole source. Ignore a receipt that does not match an existing publication/thread/revision. On absence of a receipt alone, reconciliation is unknown unless another complete permitted lookup proves absence.

`ThreadView.enrolled` and `ThreadView.contextRevision` reflect current thread state. For a nonexistent thread return enrolled=false, contextRevision=0 and null decision/finding without creating state. Cards use this current revision, not the historical revision on Decision. Finding carries explicit decision/version/context keys even when run=null; clarification and withdrawal do not need a fictional investigation. If run exists, its keys must match the Finding keys.

One stable bot-owned Slack finding per thread is preferred. Update it with increasing publication revisions. Include a harmless visible marker `Accord finding <full-id> · update <n> · delivery <publication-id>` so an uncertain first send can be reconciled. Search only the known thread for that marker using supported authorized access. A failed reconciliation read is `unknown`, not `not_found`.

## 7. Repository and behavior evidence

Resolve a repository ref or PR to a SHA once. All file fetches, line links, generation checks and behavior projections in that report use the same SHA. PR verification retains both base and head SHA; inspect head for the candidate. Baseline report for the active decision is frozen separately and never overwritten by the candidate report. Its decision ID/version must match, but its contextRevision/investigationId/mode may be older: posting a PR is itself a new event. Only the candidate and final result must exactly match the current verification RunContext. Rebuild baseline for a new decision version.

Evidence IDs are minted by tools, not the LLM. Model output may cite only existing IDs and valid line ranges. Evidence excerpts are capped at 1,500 chars, with at most 20 evidence items in a report; fetch more only within tool budgets. The stored hash is of the sanitized excerpt. Line numbering refers to the original source, so redaction must not insert/remove lines.

Trusted code digests are computed from original allowed fetched bytes in memory before sanitization; raw bytes are never logged or model-fed. Evidence hashes are independently computed from sanitized excerpts. A valid source/generated mismatch is recorded, not a reason to discard the valid generated policy needed to establish current behavior.

ObservedProjection means what the committed generated data feeds to the verified supported runtime path. SourceProjection means authoritative IDL content. They can differ. A declaration in a README is not runtime evidence.

Trusted verification supports only byte-checked known runtime/generator dependency closures. It may run the product-owned same-version evaluator with parsed data; it must not run code downloaded from a PR. A changed unsupported resolver means `trustedRuntime=unsupported`, and no verified behavior claim.

Verification verdicts:

| Condition | Verdict |
|---|---|
| Candidate target behavior still violates intended policy | `still_conflicting` |
| Target behavior matches but generated artifact disagrees with authoritative source | `non_durable` |
| Target behavior matches but non-target behavior changes | `scope_regression` |
| Missing/unsupported trace, stale/missing data or unknown execution semantics | `insufficient_evidence` |
| Intended target behavior, source consistency, controls and supported runtime all pass | `verified_at_commit` |

Return every check, even when one verdict wins. Suggested precedence: insufficient evidence when required checks unknown; otherwise still conflicting, non-durable, scope regression, verified. No `verified_at_commit` with a failed or unknown required check.

## 8. Retention semantics and dataset contract

Fixed demo clock: `2026-09-12T00:00:00.000Z`. A day is exactly 86,400 seconds, not a calendar date. A record is eligible for cleanup iff `createdAt < asOf - days*86400s`. Equality is retained. This is a dry-run predicate, not an executed deletion.

Default policy: 30 days for all accounts. Intended demo scope is plans `[free]`, organizationTypes `[university]`, universityVerified `[true]`, retentionDays 90. Do not infer verification from email domains.

| Account | Plan | Organization | Verified | Ages in elapsed days |
|---|---|---|---|---|
| a01 | free | university | true | 29,30,31,89,90,91 |
| a02 | free | university | true | 31,60,89,90,91 |
| a03 | free | university | false | 31,91 |
| a04 | paid | university | true | 31,91 |
| a05 | free | company | true | 31,91 |
| a06 | free | personal | false | 31,91 |

Record ID is `<account>-r<age>`. Total: 6 accounts, 19 records. Target: 2 accounts, 11 records. Baseline: 17 selected total; 9 target. Intended: 10 selected total; 2 target. Difference: 7 premature records on 2 accounts. Premature IDs: a01-r31,a01-r89,a01-r90,a02-r31,a02-r60,a02-r89,a02-r90. These exact values are assertions, not canned model answers.

`prematurelySelectedRecords`: observed=true, intended=false, inside intent scope.
`overRetainedRecords`: observed=false, intended=true, inside intent scope.
`outOfScopeChangedRecords`: candidate eligibility differs from frozen baseline outside intent scope.
`intendedSelectedTotal`: current frozen baseline behavior with only the confirmed scope replaced by intended days. Do not apply an overbroad candidate as the intended baseline.

Scope preservation must also evaluate all 12 combinations of plan × organizationType × verified, including unseeded categories, across boundary ages. The 19 rows alone do not cover all policy categories. Agent 3 owns that policy matrix; Agent 4 owns actual data counts.

Unknown counts are `null`, never zero. All counts nonnegative integers. QueryEvidence identifies the actual SQL/parameters and query timestamp. Slack shows aggregate counts and inspectable safe query text, not real customer identifiers.

## 9. Agent behavior budgets and prompts

Coordinator interpretation: max 2 model attempts for schema repair, no hidden recursive delegation. Repository investigator: max 8 model/tool rounds, max 20 file fetches, 200 KB total sanitized file text, 12 search hits per query, 20-second GitHub request timeout, 120-second wall budget. Core investigation target budget 180 seconds excluding human waiting; budgets configurable but bounded.

One repository specialist can choose among list/search/read/PR/generation-check tools. Database impact is a typed deterministic tool. No general shell, web browsing, file writing, secret access or arbitrary SQL tools. Natural-language conclusions must reference tool evidence; deterministic templates may render approved results, but may not replace the cognitive investigation.

Persist short reasoning summaries and tool trace metadata only. Do not request or log hidden chain-of-thought. Refusals, empty model results and invalid schema become explicit errors/clarification, not fabricated decisions.

## 10. Tool result error handling

All public errors use PublicError. Raw provider response bodies, headers, tokens and connection strings are never copied to an exception sent to the model or Slack. Transient timeouts/429/5xx can retry, honoring Retry-After where supported; authentication/authorization/invalid inputs do not blind-retry. One bounded repair can reformat invalid model output; tool execution remains gated by validation and authorization.

## 11. Configuration names

Agent 1 owns `.env.example` with placeholders only. Required runtime names: `OPENAI_API_KEY`, `ACCORD_MODEL`, `INTELLIGENCE_API_KEY`, `CHANNEL_CODE`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `ACCORD_SLACK_TEAM_ID`, `ACCORD_SLACK_CHANNEL_ID`, `ACCORD_OWNER_SLACK_USER_ID`, `GITHUB_TOKEN`, `ACCORD_GITHUB_OWNER`, `ACCORD_GITHUB_REPO`, `ACCORD_REPO_REF`, `ACCORD_REPO_PATH_PREFIX`, `DATABASE_URL`, `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `ACCORD_MODE`, `ACCORD_DATASET_VERSION`, `PORT`.

Demo only: `ACCORD_DEMO_AS_OF`, trusted fixture profile path, `ACCORD_DEMO_RESET_ENABLED`. Admin seed credentials have separate names and are used only by explicit seed commands, never included in worker/bridge runtime environments. Fault injection only via test dependency injection or local demo operator configuration; not remotely controllable by Slack text.

Each factory validates only the configuration it needs. Missing live credentials fail clearly. No fallback from live to test doubles. `ACCORD_MODE` is `demo` or `live`; tests inject adapters directly and do not add a production `mock` mode.

## 12. Demo dataset activation

Runtime processes use the exact configured immutable ACCORD_DATASET_VERSION. Ordinary demo:reset creates a fresh demo run/thread context against that same unchanged fixture dataset; it does not reseed or switch data underneath jobs. If fixture data actually changes, seed a new version, verify it, update configuration and restart/redeploy bridge/workers explicitly before activation. Old runs remain bound to their old dataset or become unavailable if that version is no longer permitted; they never switch silently. Seed/reset scripts print the necessary activation step and cannot claim the new version is active before it is.

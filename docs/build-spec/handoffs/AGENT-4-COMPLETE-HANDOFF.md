# Accord — Agent 4 complete handoff

This file includes all shared rules, your assigned workstream, boundary types and acceptance criteria. Other implementation workstreams are owned by teammates.


---

# Accord — implementation specification and four-agent delivery plan

Version: 1.0 · Prepared: 12 September 2026 · Target: https://github.com/ShreyanshGoyal/top_secret

## 1. Read this first

This is a build specification, not implemented software. The target repository is assumed empty at the user's explicit instruction. Its contents were not independently inspected. All file paths below are proposed paths relative to that repository. Do not report any capability working until its acceptance test passes.

The team has four people, each using one coding agent. Assign one owner to each numbered workstream. These workstreams have separate file ownership and public interfaces. They can implement and test independently after a short shared bootstrap. A working product still requires integration; independent work does not mean four independently deployed products.

Read in this order:

1. This file.
2. `01-SHARED-CONTRACTS.md` and `contracts.ts` (normative boundary types).
3. Your assigned file: `02-AGENT-1-CORE.md`, `03-AGENT-2-SLACK.md`, `04-AGENT-3-REPOSITORY.md`, or `05-AGENT-4-DATA-INTEGRATION.md`.
4. `06-ACCEPTANCE-AND-REVIEW.md`.

The repository should have one concise product README. Keep this detailed packet as implementation guidance in `docs/build-spec/`, or distribute it outside the code repository if desired. Do not expand it into multiple marketing documents. Retain required licenses and submission material.

## 2. Product definition

**Accord catches when a Slack decision changes what software should do, investigates the actual implementation and affected data, and keeps the finding current until resolution is verified.**

Example: the team confirms that free accounts with verified university status now receive 90-day retention. The cleanup implementation still selects their records after 30 days. Accord finds the source policy, generated consumer, resolver and cleanup path; computes the premature-selection population; and reports the evidence in the originating Slack thread. A later clarification changes the interpretation. A linked PR triggers verification against its actual head commit.

The signature capability is avoiding shallow code conclusions. A visible `30` can be overridden elsewhere. Editing generated bindings may temporarily change behavior without fixing their source. Accord must distinguish these cases.

### 2.1 Users

- Product owner: confirms intended scope, effective time and whether the decision is tentative.
- Engineer: reads code evidence and links a proposed fix.
- Other channel members: supply context and questions but cannot impersonate the configured decision owner.
- Demo operator: configures credentials and resets isolated synthetic scenarios.

### 2.2 Supported MVP

- One explicitly configured Slack workspace and channel.
- Threads enrolled by mentioning Accord once. Subsequent human replies in those threads are processed without another mention.
- One configured GitHub repository: the target repository itself, containing a clearly labeled synthetic legacy retention application.
- One decision per enrolled thread. A second independent policy requires another thread.
- One domain: changing elapsed-day retention for a conjunction of supported account attributes.
- Immediate application to currently stored records. Future-effective, prospective-only and retroactive-recovery policies require clarification and remain unsupported.
- One coordinator agent plus one bounded repository-investigator agent.
- Real GitHub retrieval, real OpenAI calls, real ClickHouse queries, real Trigger.dev orchestration and real Slack delivery in live mode.
- Explicit owner confirmation, tentative/withdrawn states, superseded investigations and PR re-verification.
- Deterministic verification of the supported fixture behavior through a trusted evaluator with source-digest checks.
- No production writes or deletions. Slack findings and internal investigation records are the product's writes.

### 2.3 Out of scope

No patch generation, automatic merge, production deployment verification, arbitrary code execution, arbitrary SQL, universal legacy-code comprehension, company-wide decision graph, private-message monitoring, universal channel scanning, automatic expert ranking, automatic expert mentions, payments, mobile application or dashboard. Auth0 and Exa are not required for v1; do not claim their integration. Slack identity plus server-side authorization and scoped service credentials are sufficient for this scope.

No capability is implied merely by a button or a mock. A failed dependency must be visible as incomplete evidence.

## 3. Four workstreams and ownership

| Owner | Branch | Exclusive paths | Main output |
|---|---|---|---|
| Agent/person 1 | `accord/core` | `packages/accord-contracts/**`, `packages/accord-core/**`, `packages/accord-store/**`, `apps/worker/**`, `trigger.config.ts`; root manifests/lockfile/configuration and initial starter import | State, coordinator, durable work, contracts, final application composition |
| Agent/person 2 | `accord/slack` | `apps/channel/**`, `packages/slack-delivery/**` | CopilotKit direct Slack ingress, native UI, background publication transport |
| Agent/person 3 | `accord/repository` | `packages/repo-investigator/**`, `fixtures/retention-app/**` | Evidence-backed repository specialist and trusted legacy fixture |
| Agent/person 4 | `accord/data-integration` | `packages/data-impact/**`, `packages/privacy/**`, `infra/**`, `scripts/**`, `tests/e2e/**`, `tests/live/**`, `README.md`, `SUBMISSION.md` | ClickHouse, privacy utilities, deployment, demo/reset, integrated proof |

Agent 1 owns root `package.json`, `package-lock.json`, `.env.example`, root TypeScript config, `.gitignore` and root `AGENTS.md`. Agent 4 supplies requested script/env additions in its handoff; Agent 1 applies them. Each agent owns its package manifests, but only Agent 1 commits the root lockfile. Agent 4 owns infrastructure schemas for ClickHouse; Agent 1 owns PostgreSQL migrations. Agent 3 owns fixture policy and code; Agent 4 owns account/record seed data. Do not create alternative copies.

## 4. Bootstrap protocol: do this once

Agent 1 is the initial integrator. Before four parallel branches begin:

1. Clone the empty target repository with the team's authenticated Git access. Set up `main` if there is no default branch yet. Do not overwrite any unexpected files; if the empty assumption is false, preserve them and report the difference.
2. Obtain the starter from https://github.com/CopilotKit/agents-everywhere-starter-kit at one full commit SHA. Record that SHA. Import its files without its `.git` directory; keep the target remote as `origin`. Preserve MIT attribution. Do not copy credentials or `node_modules`.
3. Preserve the starter's tested dependency pairing. At inspection time the channel package declared `@copilotkit/channels` 0.9.2, `@copilotkit/runtime` 1.70.3 and root `@ag-ui/client` override 0.0.59. The chosen starter commit and its lockfile are authoritative if they differ; do not mix generations.
4. Read starter `AGENTS.md`, the Channels skill and selected app documentation. This project intentionally uses its direct Slack adapter because durable asynchronous delivery is required. This is an architectural selection, not a workaround for a broken managed setup.
5. Create the path skeleton and package manifests for the four owners. Copy the provided `contracts.ts` to `packages/accord-contracts/src/types.ts`; implement runtime schemas and contract tests. No production fake implementations are needed in the skeleton.
6. Add workspace entries for `packages/*`, `apps/channel`, `apps/worker`, and `fixtures/retention-app`. Existing starter web/mobile examples may remain inherited and unused; never advertise them as Accord features. Root verification must still pass for retained workspaces.
7. Add root scripts with the names specified in the acceptance document. Scripts for unfinished work must fail clearly, not return a pretend pass.
8. Commit as a bootstrap commit and push to `main`. Record its SHA. This is the one short synchronization point before parallel coding.
9. Each person creates their assigned branch from this exact SHA in a separate clone/worktree. Each receives this shared packet plus their assigned spec. They can now code against stable ports and test doubles.

Shared dependency requests go to Agent 1. Do not run simultaneous root dependency upgrades. New dependencies should be exact-pinned during bootstrap/integration, compatible with Node 22 and the starter's Zod version. Do not independently switch to pnpm, Python, another agent framework, or another database.

## 5. Architecture choices already decided

- Language/runtime: TypeScript, Node.js 22+, ESM, strict types.
- Durable authority: PostgreSQL. No in-memory-only decision state.
- Impact analysis: ClickHouse, restricted read-only runtime role.
- Agent provider: OpenAI Responses API with validated function tools/structured outputs. Model ID comes from configuration and is tested against the team's account; this spec does not assume a particular model is available.
- Orchestration: Trigger.dev tasks. No background processing that depends on the Slack event staying open.
- Slack: CopilotKit Channels direct Slack adapter, still attached to CopilotKit Intelligence. One app identity, bot token and Socket Mode app token. Background publication uses that same bot's Web API credentials.
- CopilotKit is the actual conversation runtime and native interaction layer. Trigger.dev is the actual long-running investigation runtime. Neither is a ceremonial integration.
- Deployment: one long-running channel bridge; Trigger.dev-hosted workers; durable external PostgreSQL and ClickHouse. Cloud Run hosts the bridge with appropriate background CPU/min-instance settings.
- Privacy: shared sanitization and explicit resource allowlists; no secrets or raw customer rows in model/log/Slack payloads.
- Repository tools never execute untrusted fetched code. Supported behavior verification checks known code digests and uses the product-owned trusted function with validated policy data.

## 6. Three stage moments

1. **Real conflict:** ordinary Slack text produces commit-specific implementation evidence and 7 prematurely selected synthetic records across 2 accounts.
2. **False-alarm avoidance:** the default remains 30, but an existing target override is 90; Accord reports no conflict for the confirmed scope.
3. **Legacy-aware verification:** a UI-only fix remains conflicting; a generated-only fix is inconsistent; a source-plus-generated fix with unchanged control behavior is verified at its commit, with deployment unverified.

A fourth rehearsal proves recovery: scope changes while a query is delayed; the older result cannot overwrite the newer interpretation.

## 7. Parallel development and integration

Each owner implements against the contracts, uses explicit injected test adapters, and exports a factory from its package root. Do not import another package's internal files. Test-only doubles must stay under `test/` or `*.test.*`; the production composition must never choose them because a key is missing.

Recommended merge order after bootstrap: Agent 3 and Agent 4 packages; Agent 1 runtime; Agent 2 bridge; Agent 4 final integration evidence. This order is for integration only, not a requirement to wait before coding. Agent 1 performs root lockfile reconciliation after each merge. Never force-push `main`. Each owner pushes their feature branch and supplies a reviewable PR; no agent merges someone else's unreviewed work.

Use the actual target repository URL for remotes. Example branch names in this spec are authorized proposed implementation branches, not claims that those branches already exist.

Every handoff contains: commit SHA; public exports; commands run and results; pending live checks; required configuration names; known limitations; requested contract changes. A contract change needs Agent 1's version bump and all consumers updated before merge. Do not silently accept a second shape.

## 8. Final completion standard

`06-ACCEPTANCE-AND-REVIEW.md` is the review rubric. Completion requires both deterministic tests and credential-backed integration evidence. Test harnesses prove components; they do not prove live Slack or LLM behavior. The final reviewer must receive the final commit and a sanitized evidence manifest. Do not call the whole product complete when any advertised live integration is pending.


---

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


## Normative TypeScript boundary contract

```typescript
/** Accord v1 boundary specification. Copy to packages/accord-contracts/src/types.ts.
 * These are application interfaces, not invented third-party SDK APIs.
 * Implement strict runtime validation separately; TS alone does not validate input.
 */
export const CONTRACT_VERSION = '1.0' as const;
export type Id = string;
export type IsoTime = string; // UTC ISO 8601, normalize milliseconds
export type Sha = string; // full lowercase 40-hex Git SHA for supported GitHub repo
export type Plan = 'free' | 'paid';
export type OrganizationType = 'university' | 'company' | 'personal';
export interface Scope {
  plans: Plan[];
  organizationTypes: OrganizationType[];
  universityVerified: boolean[];
}
export interface PolicyIntent {
  scope: Scope;
  retentionDays: number;
  appliesTo: 'currently_stored_records';
  effective: 'immediate';
}
export interface ThreadRef {
  teamId: string;
  channelId: string;
  rootTs: string; // Slack timestamp is an opaque decimal string, never JS float
}
export interface SlackMessage {
  id: string; // stable normalized platform-message key
  ts: string;
  authorId: string;
  text: string; // sanitized text, not raw provider payload
  permalink: string | null;
  editedTs: string | null;
}
export interface InboundEvent {
  contractVersion: typeof CONTRACT_VERSION;
  eventKey: string;
  kind: 'message' | 'message_edited' | 'message_deleted';
  thread: ThreadRef;
  message: SlackMessage;
  snapshot: SlackMessage[]; // capped authoritative snapshot, includes inbound unless deleted
  snapshotComplete: boolean;
  receivedAt: IsoTime;
  wasMention: boolean;
}
export type DecisionStatus = 'candidate' | 'tentative' | 'confirmed' | 'withdrawn';
export interface Decision {
  id: Id;
  thread: ThreadRef;
  version: number;
  contextRevision: number;
  status: DecisionStatus;
  intent: PolicyIntent | null;
  ownerId: string; // set from server config, not inferred from quoted text
  sourceMessageIds: string[];
  intentHash: string | null;
  confirmedBy: string | null;
  confirmedAt: IsoTime | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
}
export interface Interpretation {
  disposition: 'irrelevant' | 'clarify' | 'propose' | 'confirm' | 'tentative' | 'withdraw' | 'verify_pr' | 'status';
  intent: PolicyIntent | null;
  sourceMessageIds: string[];
  question: string | null;
  explanation: string; // concise decision rationale, not hidden chain of thought
  pullRequestUrl: string | null;
  expectedDecisionVersion: number | null;
}
export interface RunContext {
  investigationId: Id;
  decisionId: Id;
  decisionVersion: number;
  contextRevision: number;
  datasetVersion: string;
  asOf: IsoTime;
  mode: 'baseline' | 'verify_pr';
}
export interface RepositoryId { owner: string; name: string }
export interface CommitTarget {
  repository: RepositoryId;
  sha: Sha;
  baseSha: Sha | null;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  pathPrefix: string; // fixed fixture path, enforced by server config
}
export type EvidenceKind = 'slack' | 'code' | 'guidance' | 'query' | 'verification';
export interface Evidence {
  id: Id;
  kind: EvidenceKind;
  summary: string;
  locator: string; // validated URL, or accord-query:<id>/accord-check:<id>
  excerpt: string; // redacted and capped; no raw records
  excerptHash: string; // sha256 of sanitized excerpt
  capturedAt: IsoTime;
  repository: RepositoryId | null;
  commitSha: Sha | null;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
}
export interface RetentionRule { id: string; scope: Scope; days: number }
export interface RetentionProjection {
  schemaVersion: 1;
  defaultDays: number;
  rules: RetentionRule[]; // first matching rule wins; ordered, validated
}
export interface TraceEdge {
  fromEvidenceId: Id;
  toEvidenceId: Id;
  relationship: 'generates' | 'imports' | 'calls' | 'overrides' | 'tests';
  explanation: string;
}
export interface RepositoryReport {
  run: RunContext;
  target: CommitTarget;
  conclusion: 'conflict' | 'aligned' | 'unknown';
  observedProjection: RetentionProjection | null; // current committed runtime data
  sourceProjection: RetentionProjection | null; // authoritative IDL interpretation
  generatorConsistency: 'consistent' | 'inconsistent' | 'unknown';
  trustedRuntime: 'matched' | 'unsupported';
  sourcePaths: string[];
  generatedPaths: string[];
  trace: TraceEdge[];
  evidence: Evidence[];
  unknowns: string[];
  summary: string;
}
export interface ImpactRequest {
  run: RunContext;
  intent: PolicyIntent;
  observedProjection: RetentionProjection;
  baselineProjection: RetentionProjection; // reference for outside-scope preservation
  repositoryEvidenceIds: Id[];
}
export interface ImpactReport {
  run: RunContext;
  status: 'complete' | 'unavailable' | 'unsupported';
  eligibleAccounts: number | null;
  eligibleRecords: number | null;
  observedSelectedInScope: number | null;
  intendedSelectedInScope: number | null;
  prematurelySelectedRecords: number | null;
  prematurelySelectedAccounts: number | null;
  overRetainedRecords: number | null;
  outOfScopeChangedRecords: number | null;
  observedSelectedTotal: number | null;
  intendedSelectedTotal: number | null;
  queryId: string | null;
  observedAt: IsoTime;
  evidence: Evidence[];
  error: PublicError | null;
}
export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  explanation: string;
  evidenceIds: Id[];
}
export interface VerificationReport {
  run: RunContext;
  target: CommitTarget;
  verdict: 'verified_at_commit' | 'still_conflicting' | 'non_durable' | 'scope_regression' | 'insufficient_evidence';
  checks: CheckResult[];
  deployment: 'unverified';
  evidence: Evidence[];
}
export type FindingStatus = 'investigating' | 'needs_clarification' | 'conditional_impact' |
  'confirmed_conflict' | 'no_conflict' | 'impact_unverified' | 'verification_failed' |
  'verified_at_commit' | 'withdrawn' | 'superseded' | 'failed';
export interface Finding {
  id: Id;
  decisionId: Id;
  decisionVersion: number;
  contextRevision: number;
  run: RunContext | null; // clarification/withdrawal need no invented investigation
  status: FindingStatus;
  title: string;
  summary: string;
  question: string | null;
  repository: RepositoryReport | null;
  impact: ImpactReport | null;
  verification: VerificationReport | null;
  evidence: Evidence[];
  limitations: string[];
  updatedAt: IsoTime;
}
export interface ThreadView {
  thread: ThreadRef;
  enrolled: boolean;
  contextRevision: number; // current thread revision, not historical Decision revision
  decision: Decision | null;
  finding: Finding | null;
  publicationPending: boolean;
}
export interface OwnerAction {
  actionId: Id;
  thread: ThreadRef;
  actorId: string; // trusted transport actor, never button-supplied actor
  decisionId: Id;
  expectedVersion: number;
  expectedContextRevision: number;
  kind: 'confirm' | 'tentative' | 'withdraw';
  occurredAt: IsoTime;
}
export interface IngestReceipt {
  accepted: boolean;
  duplicate: boolean;
  contextRevision: number | null;
  reason: string | null;
}
export interface ActionReceipt {
  status: 'accepted' | 'duplicate' | 'stale' | 'forbidden' | 'not_found';
  view: ThreadView | null;
}
export interface ApplicationPort {
  acceptEvent(event: InboundEvent): Promise<IngestReceipt>;
  acceptAction(action: OwnerAction): Promise<ActionReceipt>;
  getThreadView(thread: ThreadRef): Promise<ThreadView>;
  recordPublicationReceipt(receipt: PublicationReceipt): Promise<void>;
}
export interface RepositoryPort {
  resolveTarget(input: { repository: RepositoryId; ref: string; pullRequestUrl: string | null; pathPrefix: string }): Promise<CommitTarget>;
  inspect(input: { run: RunContext; decision: Decision; target: CommitTarget }): Promise<RepositoryReport>;
  verify(input: { run: RunContext; decision: Decision; baseline: RepositoryReport; candidate: RepositoryReport }): Promise<VerificationReport>;
}
export interface ImpactPort { analyze(input: ImpactRequest): Promise<ImpactReport> }
export interface Publication {
  id: Id;
  thread: ThreadRef;
  findingId: Id;
  decisionVersion: number;
  contextRevision: number;
  revision: number;
  text: string; // sanitized deterministic rendering, max 3500 chars
  existingTs: string | null;
}
export type DeliveryResult =
  | { status: 'delivered'; ts: string }
  | { status: 'uncertain'; error: PublicError }
  | { status: 'retryable'; error: PublicError; retryAfterMs: number | null }
  | { status: 'permanent_failure'; error: PublicError };
export interface PublisherPort {
  deliver(publication: Publication): Promise<DeliveryResult>;
  reconcile(publication: Publication): Promise<{ status: 'found'; ts: string } | { status: 'not_found' | 'unknown' }>;
}
export interface PublicError {
  code: 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH' | 'FORBIDDEN' | 'UNSUPPORTED' |
    'INVALID_INPUT' | 'STALE' | 'INCOMPLETE_EVIDENCE' | 'PROVIDER_ERROR' | 'DELIVERY_UNCERTAIN';
  message: string; // safe, bounded; no provider body or credentials
  retryable: boolean;
}
export interface PrivacyPort {
  sanitize(input: string, kind: 'slack' | 'repository' | 'model_output' | 'error'): string;
  assertAudience(input: { thread: ThreadRef; repository: RepositoryId; datasetVersion: string }): void;
  assertAllowedPath(path: string): void;
}
export interface Account { id: string; plan: Plan; organizationType: OrganizationType; universityVerified: boolean }
export interface RetainedRecord { id: string; accountId: string; createdAt: IsoTime }
export interface ModelPort {
  interpret(input: { messages: SlackMessage[]; current: Decision | null; ownerId: string; contextRevision: number }): Promise<Interpretation>;
}

/** Only trusted own-bot transport events may create these receipts. */
export interface PublicationReceipt {
  publicationId: Id;
  findingId: Id;
  publicationRevision: number;
  thread: ThreadRef;
  ts: string;
  botUserId: string;
  observedAt: IsoTime;
}
export interface PublicationReceiptReader {
  find(publicationId: Id): Promise<PublicationReceipt | null>;
}
export interface ClockPort { now(): IsoTime }
export interface SafeLoggerPort {
  info(event: string, fields: Record<string, string | number | boolean | null>): void;
  error(event: string, fields: Record<string, string | number | boolean | null>): void;
}
export interface RepositoryConfig {
  repository: RepositoryId;
  pathPrefix: string;
  githubToken: string;
  openAIKey: string;
  model: string;
  trustedProfileVersion: string;
}
export interface ImpactConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  allowedDatasetVersion: string;
}
export interface PrivacyConfig {
  teamId: string;
  channelId: string;
  repository: RepositoryId;
  datasetVersion: string;
  knownSecretValues: string[]; // in-memory only; never log/serialize
}
export interface PublisherConfig {
  botToken: string;
  teamId: string;
  channelId: string;
  botUserId: string; // resolve through authenticated setup, not LLM
}
export interface ProviderDependencies {
  privacy: PrivacyPort;
  clock: ClockPort;
  logger: SafeLoggerPort;
}
export interface PublisherDependencies extends ProviderDependencies {
  receipts: PublicationReceiptReader;
}

```


---

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


---

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


---

# Implementation references and decisions

References checked during specification on12 September2026. These URLs help the implementers verify actual SDK behavior. Public docs can change; pin dependencies and inspect installed types. The target repository is assumed empty per user instruction and was not independently read. These specifications contain original design requirements, not claims that any implementation has already passed tests.

## Starter

[Starter repository](https://github.com/CopilotKit/agents-everywhere-starter-kit) supplies reusable infrastructure. Preserve its license and record the imported commit. [Channel package](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/channel/package.json) and [root package](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/package.json) establish the inspected dependency pins. [Agent guidance](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/AGENTS.md) and [Channels skill](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/.agents/skills/build-channels-agent/SKILL.md) are required implementation references. Do not copy older illustrative package versions over the chosen starter's actual lockfile.

## Slack architecture

[CopilotKit direct adapters](https://docs.copilotkit.ai/reference/channels/sdk/direct-adapters) documents the direct provider path. This spec deliberately chooses it so the app owns the same bot credentials used for durable background publication. [Slack postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/) provides threaded outbound posting; [Slack update](https://docs.slack.dev/reference/methods/chat.update/) supports updates to the bot's existing messages. The application must separately manage freshness, authorization and uncertain outcomes. The spec does not rely on an invented proactive Channels method.

## Reasoning

[OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) are the references for model/tool boundaries. Strict output shape does not establish authorization or evidential truth; application validation remains mandatory. Use a configured model available to the team's account and run a real smoke test rather than assume availability from an example.

## Durability and data

[Trigger retries](https://trigger.dev/docs/errors-retrying) and [idempotency](https://trigger.dev/docs/idempotency) support task execution. Application-level PostgreSQL constraints, version checks and outbox reconciliation supplement them. [ClickHouse query permissions](https://clickhouse.com/docs/concepts/features/configuration/settings/permissions-for-queries) informs the read-only role; the actual restricted view and query compiler are application requirements. [Cloud Run billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings) is relevant to background CPU; deployment must prove the persistent bridge stays operational. External durable stores are required.

## Deliberately excluded

Expert recommendation, Exa, Auth0, broad history profiling and automatic remediation are not v1 dependencies. Add them only as a separately reviewed scope change after required acceptance passes. [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) would be a suitable explicit ownership source for a later reviewer suggestion, but no expertise ranking is part of this build.


---

# Copy-paste kickoff prompts

Attach the complete handoff for the selected agent, or provide00,01,contracts.ts, its assigned spec and06. The assigned owner should read the entire handoff before changing code. These prompts authorize implementation and pushing the assigned feature branch to the target, not merging other people's work, posting Slack messages to real coworkers, or deploying unreviewed changes. Live tests should run in the configured synthetic demo channel with the human operator's knowledge.

## Person 1 → Agent 1

You are Agent 1 for Accord in https://github.com/ShreyanshGoyal/top_secret. Assume the target is empty. Implement the attached shared specification and Agent 1 workstream exactly. First import a pinned CopilotKit starter commit while preserving target origin and license, publish the common bootstrap with shared contracts and exact constructor types, and give the other three owners that commit. Then work on accord/core. Own only the paths assigned to Agent 1. Preserve the starter dependency pair and let only this workstream reconcile the root lockfile. Build real PostgreSQL state, OpenAI interpretation, Trigger.dev tasks, job/publication outboxes and revision fencing. Do not implement fake peer packages or silently replace live providers. Run your required tests, push your feature branch, and report commit SHA, commands/results, public interfaces and pending live checks. Do not merge other owners' changes without the team's integration review.

## Person 2 → Agent 2

You are Agent 2 for Accord in https://github.com/ShreyanshGoyal/top_secret. Start from the common bootstrap SHA supplied by Person 1 on branch accord/slack. Read the shared contract and Agent 2 specification fully, including the starter Channels skill. Own apps/channel and packages/slack-delivery only. Use the intentional direct CopilotKit Slack adapter with the same bot for durable background Web API delivery; Intelligence is still required. Implement trustworthy ingress, enrollment, native status/controls, current-revision handling, sanitized rendering and persisted delivery receipt integration. Use core public interfaces; do not invent decision logic or SDK APIs. Independently test against explicit injected doubles, then prove real delayed Slack posting and updating in the demo channel. Push your branch and report exact scopes, commit, tests and unverified limitations. Coordinate root dependency changes through Person 1.

## Person 3 → Agent 3

You are Agent 3 for Accord in https://github.com/ShreyanshGoyal/top_secret. Start from the shared bootstrap SHA on accord/repository. Read shared contracts and Agent 3 spec. Own packages/repo-investigator and fixtures/retention-app only. Implement a bounded real LLM investigator with GitHub evidence at a fixed SHA, plus the source-IDL/generated-policy/resolver/cleanup fixture. Preserve exact schema, retention boundaries and generator semantics. Prove baseline conflict, existing-override negative control, UI-only failure, generated-only non-durability and correct scoped fix. Never execute fetched PR code; use only the matched-digest trusted evaluator. Return contract-valid evidence and unknowns. Keep baseline context revision independent from current candidate fencing as specified. Supply scenario patches without automatically publishing them from tests. Push your branch and report public exports, trusted profile, test results and pending real-provider checks.

## Person 4 → Agent 4

You are Agent 4 for Accord in https://github.com/ShreyanshGoyal/top_secret. Start from the shared bootstrap SHA on accord/data-integration. Read shared contracts and Agent 4 spec. Own packages/data-impact, packages/privacy, infra, scripts, tests/e2e, tests/live, README and SUBMISSION only. Implement real restricted ClickHouse impact analysis and exact 19-record fixture; implement shared privacy/audience guards; prepare reproducible infrastructure and demo scripts. Build integration tests against the frozen public ports while other packages are in progress, then run them against merged real components. Do not replace missing peer services with production mocks. Coordinate root script/env/lockfile changes through Person 1. Collect sanitized review evidence tied to the final commit, distinguishing offline, integrated and live checks. Push your branch and report counts, commands, configuration names and pending checks. Publish demo branches/PRs or deploy only through explicit operator invocation.

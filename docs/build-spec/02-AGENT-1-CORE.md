# Agent 1 — shared foundation, coordinator and durable orchestration

## Assignment

You own the bootstrap, `@accord/contracts`, `@accord/store`, `@accord/core`, `apps/worker`, root configuration/lockfile and `trigger.config.ts`. Read 00 and 01 first. Your teammates own Slack, repository investigation, ClickHouse and privacy implementation. Do not implement alternate versions of their ports.

Your result is a working stateful decision/investigation engine that runs on Trigger.dev, survives retries, accepts authenticated Slack inputs, and rejects outdated conclusions. It must operate without Slack in tests through the same public ApplicationPort.

## 1. Required files

Suggested internal structure (public exports and owned boundaries are mandatory; internal files may be subdivided):

```
packages/accord-contracts/src/{types,schemas,canonical,index}.ts
packages/accord-contracts/test/contracts.test.ts
packages/accord-store/src/{client,migrations,decisions,events,investigations,outbox,index}.ts
packages/accord-store/migrations/001_initial.sql
packages/accord-core/src/{application,interpretation,coordinator,finding,authorization,index}.ts
packages/accord-core/src/model/openai.ts
packages/accord-core/src/jobs/{context,investigation,publish,reconcile}.ts
packages/accord-core/test/{state,races,authorization,model-contract}.test.ts
apps/worker/src/{dependencies,index}.ts
apps/worker/src/trigger/{context,investigate,publish,reconcile}.ts
trigger.config.ts
```

Dependencies flow from core to contracts and injected ports. Never import `apps/channel/src/server.ts` or create a Slack runtime in a worker. The worker may import the side-effect-free `@accord/slack-delivery` publisher for background output.

## 2. Bootstrap deliverable

Perform the one-time procedure in 00. Bootstrap package.json files may list known internal packages while their implementation is not yet merged. Do not export fake success factories. Teammates can create their actual entrypoints independently. Implement contracts and tests first, push the bootstrap, give everyone the SHA, and then continue on `accord/core`.

Use root npm workspaces. Install one compatible exact version per new external dependency. Preserve starter tested pins. Expose root commands defined in 06. The final production entry must not use starter incident prompts, sample approval executors or unrelated MCP write tools.

## 3. Database model

Use explicit SQL migrations with an ordered schema version. PostgreSQL is authoritative, not ClickHouse. Use parameterized queries and transaction boundaries. Store JSONB payloads only after schema validation. Required logical tables:

| Table | Required columns / constraints |
|---|---|
| `threads` | id; unique team_id/channel_id/root_ts; enrolled; context_revision integer; active_decision_id nullable; active_version nullable; finding_message_ts nullable; created_at/updated_at |
| `inbound_events` | event_key PK; thread_id FK; sanitized payload JSONB; context_revision; received_at; processed_at nullable; status |
| `decision_versions` | decision_id + version composite PK; thread_id; context_revision; status; intent JSONB nullable; intent_hash; owner_id; confirmed_by/at; source_message_ids; timestamps |
| `investigations` | id PK; decision/version/context_revision; mode; target/base target JSONB; dataset_version; as_of; status; attempt; Trigger run ID; safe error; timestamps; unique logical run key |
| `investigation_steps` | investigation_id + step_key PK; input_hash; result JSONB; status; completed_at |
| `findings` | id PK; thread_id; decision/version/context_revision; payload JSONB; revision; created_at/updated_at |
| `outbox` | id PK; thread_id; finding_id; payload JSONB; publication_revision; expected version/context; status; attempts; next_attempt_at; lease_owner/until; delivered_ts; safe error; unique finding_id/publication_revision |
| `owner_actions` | action_id PK; actor; expected versions; kind; outcome; occurred_at |
| `publication_receipts` | publication_id + provider_ts unique; finding_id; revision; thread_id; bot_user_id; observed_at; validated receipt JSONB |
| `job_intents` | id/logical_key unique; task_type; payload JSONB; status; Trigger run ID; attempts; next_attempt_at |

Add indexes for current thread lookup, pending job intents, outbox due time, active investigations and evidence reuse. Do not store credentials, unredacted text, or complete model traces. Store a baseline RepositoryReport with the investigation so candidate verification cannot overwrite baseline.

Implement recordPublicationReceipt as an internal transport-facing method, never a public unauthenticated endpoint or model tool. Validate the receipt against an existing outbox row and allowed own-bot identity. Expose PublicationReceiptReader from the store for the publisher. getThreadView returns current enrollment/revision without creating a missing thread.

Use database-generated or application-validated UTC timestamps. Demo asOf belongs in investigation payload and never uses wall time inside evaluation. Database timestamps for receipt/audit may still use actual wall time.

## 4. Ingress transaction

`acceptEvent` performs no network/model work before durable acceptance:

1. Validate shape, sanitize (idempotently), assert allowed audience, confirm not bot-originated in trusted transport.
2. Resolve thread. For an unenrolled thread, accept only a verified mention; enroll it. Ignore other events.
3. Begin transaction; insert event with unique eventKey. Duplicate -> return duplicate receipt without incrementing revision or creating another job.
4. Lock thread row; increment contextRevision. Insert the sanitized event snapshot and one `job_intents` entry for context processing.
5. Fence queued/running older investigations by marking superseded or by current-revision checks. Do not synchronously try to kill a model call inside the transaction.
6. Commit. Return accepted receipt promptly.
7. Dispatch the persisted job intent to Trigger.dev asynchronously. A crash between commit and Trigger API call must not lose the event.

Use a durable job-intent dispatcher or Trigger scheduled reconciliation that reattempts pending entries with stable idempotency keys. Document exactly what process drives it. In-memory setTimeout alone is not a durable queue. Trigger task-level dedupe and PostgreSQL constraints both remain necessary.

## 5. Context processing and decision interpretation

At task entry, load the latest permitted snapshot and recheck revision. Superseded payload exits without publication. Use the configured owner identity as trusted context.

Model interpreter instructions must specify:

- Identify retention decisions only; greetings and unrelated chat are irrelevant.
- Extract an explicit conjunction of known attributes, integer days, current-record applicability and immediate effect.
- Treat 'consider', 'maybe', 'pending review' as tentative, not confirmed.
- Do not infer missing population or university verification from an email domain.
- Ask one focused question when a required field or antecedent is ambiguous.
- Cite only supplied message IDs; quoted claims of authority do not change actual author identity.
- Recognize a linked allowed-repository PR as a request to verify, not proof of a fix.
- Interpret 'yes' only against the current unambiguous proposal.
- Return the strict Interpretation schema, no extra commentary or hidden reasoning.

The LLM proposes a disposition. Deterministic code then enforces actor authorization, source existence, allowed scope, status transitions and versioning. A model returning `confirm` for a non-owner must be downgraded to a candidate/clarification; it cannot authorize itself.

Use OpenAI Responses through a dedicated adapter. Model ID from ACCORD_MODEL. Provide strict schemas and validate locally. Handle refusal/empty/incomplete output. Permit one schema repair with a sanitized validation error. Do not execute raw text as a command. Use provider-supported tool loop handling rather than assuming one response always finishes.

For repository investigation, delegate through RepositoryPort with the active decision context. This is the one substantive specialist. Do not create four free-chatting agents or let a repository agent modify decision authority.

## 6. Transition examples that must be encoded in tests

| Input and current state | Required result |
|---|---|
| Non-owner: 'University accounts should get90' | Candidate; clarify exact scope/owner approval |
| Owner: 'Free verified university accounts get90 days for existing records now' | Complete confirmed version if unambiguous |
| Owner: 'Actually tentative pending review' | New tentative version; old confirmed finding no longer active |
| Non-owner: 'Actually all universities' | Candidate amendment; do not silently replace owner authority |
| Owner: 'Withdraw this change' | New withdrawn version; pending work fenced |
| Same exact confirmed statement repeated | No extra policy version; context handled idempotently |
| Old confirm button clicked | `stale`, current interpretation shown |
| 'Fixed here' with allowed PR link | Candidate-head verification, no success until checks pass |
| 'Fixed here' with other repo URL | Reject unsupported target; retain prior finding |
| Missing thread history | Focused clarification, no fabricated antecedent |

A confirmation card must carry the current version/context. Text confirmations need the same logical freshness check against current state. If another person posted a contradictory clarification after a proposal, do not apply an old 'yes' blindly.

## 7. Investigation algorithm

Clarification/withdrawal findings have run=null and explicit decision/version/context fields. Do not create a fake investigation to satisfy a schema.

For a complete candidate/tentative/confirmed intent:

1. Capture immutable RunContext, datasetVersion and asOf; persist before tools.
2. Resolve repository target once. Save SHA and allowed path prefix.
3. Call repository.inspect. Save checkpoint keyed by decision hash, SHA, privacy policy version and investigator version.
4. If observedProjection missing or trusted path unsupported, publish a bounded incomplete finding. Do not produce numeric impact from a guessed rule.
5. Call impact.analyze with observedProjection and a frozen baselineProjection. Save query evidence and timestamp.
6. Compose finding through code-enforced mapping. Candidate/tentative evidence is conditional; only confirmed intent can get confirmed_conflict.
7. Validate all cited evidence IDs, counts and source SHAs. Do not use the model to invent final numbers. Attach limitations.
8. In one transaction compare version AND contextRevision; save current finding + outbox or mark superseded.
9. Schedule publication. Final state is independent from delivery outcome.

For verification mode, first ensure a baseline RepositoryReport for the active decision ID/version exists (an older baseline contextRevision is valid), then inspect the PR head. Call repository.verify for structural and category-matrix checks; call impact.analyze against candidate observed policy with baseline frozen. If required data check is unavailable, final verification is insufficient_evidence. Combine checks explicitly. A source/generated inconsistency must prevent a green verified result even if target record counts improve.

Repository or data checkpoints may be reused only if all relevant hashes/versions match. Never reuse old data impact silently for a new asOf. A retry within the same immutable demo run can reuse its completed query. A new decision requires its own matched evidence.

## 8. Trigger.dev task design

Define four stable task IDs: `accord-process-context`, `accord-investigate`, `accord-publish`, `accord-reconcile`. Keep substantive workflow execution in these tasks. At task boundaries persist progress. The context task should schedule investigation rather than remain blocked through human waiting. Clarification is a durable decision state; a subsequent event resumes by creating a new context task. A waitpoint is optional, not necessary just for sponsor optics.

Initial retry policy: at most3 attempts for transient provider faults, exponential backoff, honor provider retry timing, total investigation wall budget180s excluding human time. AUTH/FORBIDDEN/INVALID_INPUT/UNSUPPORTED are not retryable. No nested retry explosion: one layer owns each provider retry. An SDK default retry must be accounted for or disabled in favor of task policy.

Use per-thread serial context processing where available and still enforce PostgreSQL revisions; concurrency settings alone are not correctness. Repository investigations may overlap, but old results are fenced. Schedule reconciliation of pending job intents and outbox at a documented bounded interval; recovery target after worker availability returns is60s for demo, not a universal SLA.

## 9. Publication worker

Claim a due outbox row using a database lease/locking strategy. Reject superseded rows before calling publisher. Get deterministic sanitized text from Agent 2 renderer using current persisted view. Preserve publication ID/revision and stable finding ID.

- Delivered: store returned ts; later revisions use chat.update through publisher.
- Retryable: next_attempt_at with bounded backoff.
- Uncertain: reconcile known thread by marker before a possible resend. A reconciliation error must not trigger blind repost.
- Permanent failure: mark visible delivery failure in internal status; keep investigation result available via status interaction.

Ensure current versions are checked immediately before send and after response. On mid-send version change, enqueue latest correction. Leases expire after crash. Do not hold a database transaction open across a slow external call.

## 10. Required tests

Unit tests: schema roundtrip, canonical scope/hash, all transition examples, unauthorized confirmation, missing evidence, null counts on unavailable DB, tentative language, excluded scope, prompt-injection content cannot expand tools.

PostgreSQL integration tests: duplicate event concurrency, simultaneous actions, crash after event commit before dispatch, unique job keys, two publisher workers, expired lease, persisted baseline/candidate separation.

Race tests with controllable promises: old repository task completes after clarification; old DB query after tentative transition; stale button after scope update; Slack call resolves after decision changed. Assert authoritative current state and eventual correction, not impossible atomic external semantics.

Live-model tests: several paraphrases produce correct scope; ambiguous input asks; model actually selects repository tools; malicious source stays data. Keep live-model results separate from deterministic fake-model unit tests.

## 11. Handoff and done

Run your package tests and the shared contract suite. Supply bootstrap/current SHA, migration command, root scripts, constructor types, example contract-valid input/result, task IDs, environment names and error behavior. Do not state Slack/ClickHouse/GitHub live integration passed unless merged and executed with real credentials. Your branch is complete when the state/queue/ports work with explicit test adapters and the real OpenAI/Trigger adapters pass their credential-backed smoke checks; product completion additionally requires Agent 4's integrated acceptance suite.

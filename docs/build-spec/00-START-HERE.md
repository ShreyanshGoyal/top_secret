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

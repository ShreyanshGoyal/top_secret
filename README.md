# Accord

Accord keeps a Slack policy decision connected to the code and synthetic data it changes. A team enrolls one thread by mentioning Accord; the configured owner confirms a narrowly supported retention decision; Accord investigates the fixed GitHub commit and calculates its current impact from a read-only ClickHouse view. Findings remain tied to the decision version and context revision until a proposed fix is verified at its PR head commit.

This is deliberately a bounded MVP: one configured Slack workspace/channel, one GitHub repository, the synthetic `fixtures/retention-app/` policy fixture, and immediate retention changes for existing records. It does not delete records, execute fetched PR code, monitor all conversations, or prove a deployed fix.

## Architecture

```text
Slack thread → channel bridge → durable coordinator / Trigger task
                              ├─ GitHub investigator (fixed SHA, trusted evaluator)
                              └─ ClickHouse ImpactPort (restricted joined view, aggregates only)
                                      ↓
                              same Slack bot updates one finding message
```

PostgreSQL is the durable decision/outbox authority. ClickHouse contains only the synthetic fixture and exposes the worker runtime role to `accord_retention_view`, not the source tables. Shared privacy guards redact known/configured secret values, block secret-bearing repository paths, and fail closed for a mismatched team, channel, repository, or dataset. Their scope is bounded safeguards, not a claim of universal DLP or local-only processing.

## Prerequisites and configuration

Use Node 22+ and Docker Desktop (for local PostgreSQL/ClickHouse). Create `.env` from `.env.example`; never commit it. Required names are:

`OPENAI_API_KEY`, `ACCORD_MODEL`, `INTELLIGENCE_API_KEY`, `CHANNEL_CODE`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `ACCORD_SLACK_TEAM_ID`, `ACCORD_SLACK_CHANNEL_ID`, `ACCORD_OWNER_SLACK_USER_ID`, `GITHUB_TOKEN`, `ACCORD_GITHUB_OWNER`, `ACCORD_GITHUB_REPO`, `ACCORD_REPO_REF`, `ACCORD_REPO_PATH_PREFIX`, `DATABASE_URL`, `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `ACCORD_MODE`, `ACCORD_DATASET_VERSION`, and `PORT`.

Seeding additionally requires `ACCORD_CLICKHOUSE_ADMIN_USER` and `ACCORD_CLICKHOUSE_ADMIN_PASSWORD`; do not put them in the bridge or worker environment. Demo mode uses `ACCORD_DEMO_AS_OF=2026-09-12T00:00:00.000Z`, an immutable dataset version, and an explicit `ACCORD_DEMO_RESET_ENABLED=true` only when a durable reset implementation is available.

Install the Slack app with Socket Mode, the bot scopes required by the direct Channels adapter plus `chat:write`, and configure one allowed team/channel and one owner user. The same bot identity receives the thread and posts/updates the durable finding. A real installation remains a live check; this repository does not claim it is configured from source alone.

## Local setup and commands

```bash
npm ci
npm run verify                    # offline contracts and package tests
npx tsx scripts/dev-up.ts         # starts local PostgreSQL + ClickHouse; never seeds
npx tsx scripts/demo-preflight.ts # reports configuration/service readiness without printing values
npx tsx scripts/demo-seed.ts      # demo mode + separate ClickHouse admin identity only
```

The local ClickHouse schema is in `infra/clickhouse/`. Apply `roles.sql` with an administrator and bind the supplied runtime user to `accord_runtime_readonly`; prove that it cannot insert, delete, drop, or read `accord_private_operator_notes`. Only then run the real integration suite:

```bash
node --import tsx --test tests/e2e/*.test.ts
node --import tsx --test tests/live/*.test.ts
```

Agent 1 owns the root manifest and replaces its explicit bootstrap-pending commands with the scripts in `scripts/`: `tsx scripts/demo-seed.ts`, `demo-reset.ts`, `demo-preflight.ts`, `demo-prepare-prs.ts`, `review-evidence.ts`, plus the e2e/live test invocations. Until that merge, the corresponding `npm run demo:*`, `test:integration`, `test:live`, and `review:evidence` commands correctly exit nonzero rather than pretending the feature is wired.

## Synthetic retention demonstration

The immutable `accord-demo-2026-09-12` fixture has six accounts and 19 records at the fixed clock. The owner confirms: “Free accounts with verified university status should retain existing records for 90 days, starting now.” Baseline behavior selects 17 records, including 9 in scope; the intended policy selects 10 total and 2 in scope. The difference is 7 prematurely selected records across 2 accounts. No cleanup is ever performed.

For a two-minute demo: show the enrolled owner decision, the conflict finding and aggregate query evidence, mark it tentative, link a UI-only PR (still conflicting), then link a source-and-generated correct PR (verified at its commit; deployment remains unverified). Scenario branches/PRs are created only with the explicit `--apply-local`/`--push` operator flags after Agent 3 supplies fixture patches.

## Verification status

`npm run verify` passed at the bootstrap before implementation. Agent 4 package unit tests currently cover query parameterization, retry/null failure behavior, audience/path rejection, redaction, and safe logging. The seed-boundary test passes offline. Real ClickHouse, PostgreSQL, GitHub, OpenAI, Trigger, Slack, and complete end-to-end checks are pending credentialed execution and must not be described as passed until their recorded tests complete. `scripts/review-evidence.ts` creates a sanitized manifest that leaves such checks pending.

## Provenance

The repository began from CopilotKit’s `agents-everywhere-starter-kit` at `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5`; its MIT license remains. The inherited web/mobile examples are not Accord features. Accord’s build specification and acceptance rubric live in [`docs/build-spec/`](docs/build-spec/00-START-HERE.md).

# Bootstrap handoff — Agent 1 to Agents 2, 3 and 4

This is the one synchronization point before parallel coding. Branch from `origin/main` at the
commit that introduced this file.

```bash
git clone https://github.com/ShreyanshGoyal/top_secret.git
cd top_secret
git checkout -b accord/slack            # accord/repository · accord/data-integration
npm ci
npm run verify
```

## What this commit contains

- The CopilotKit starter imported at commit `6443333e4b81fd6e21a4f531bdeee3a71eccd7b5`, without its
  `.git` directory, MIT `LICENSE` retained, `origin` pointing at the Accord target repository.
- Starter dependency pairing preserved exactly: `@copilotkit/channels` 0.9.2,
  `@copilotkit/runtime` 1.70.3, root override `@ag-ui/client` 0.0.59, single deduped copy.
- `@accord/contracts` implemented: the normative types, strict Zod schemas for every boundary value,
  canonical ordering and hashing, boundary validation helpers, and 23 passing contract tests.
- Path skeletons and package manifests for all four owners, plus root scripts, `tsconfig.base.json`
  and `.env.example`.
- The specification packet in `docs/build-spec/`, including each owner's complete handoff.

## What is frozen — change only through Agent 1

These are the surfaces the other three owners build against. A change needs Agent 1's contract
version bump and every consumer updated before merge.

| Surface | Where |
|---|---|
| Boundary types, schemas, canonical helpers | `@accord/contracts` (package root only) |
| `createRepositoryPort(config: RepositoryConfig, deps: ProviderDependencies)` | Agent 3 |
| `createImpactPort(config: ImpactConfig, deps: ProviderDependencies)` | Agent 4 |
| `createPrivacyPort(config: PrivacyConfig)` | Agent 4 |
| `createPublisherPort(config: PublisherConfig, deps: PublisherDependencies)`, `renderFinding(view)` | Agent 2 |
| `createConfiguredApplication(): Promise<ApplicationPort>`, `createApplication(deps)` | Agent 1, consumed by Agent 2 |
| Trigger task IDs `accord-process-context` · `accord-investigate` · `accord-publish` · `accord-reconcile` | `@accord/core` `TASK_IDS` |
| Environment names | `.env.example` and `REQUIRED_ENVIRONMENT_NAMES` in `@accord/core` |

`@accord/store` and the core dependency types (`CoreDependencies`, `JobSchedulerPort`, `AccordConfig`)
are published for reference but consumed only by `@accord/core` and `apps/worker`. Agent 2 starts the
application with `await createConfiguredApplication()` and needs no store or scheduler wiring.

`createSafeLogger({ component })` in `@accord/privacy` is a proposed shape, not frozen: Agent 4 may
refine its options object and must report the final signature in its handoff.
`@accord/retention-fixture` and `fixtures/retention-app` export nothing yet — Agent 3 defines that
surface, so no other package should import them until Agent 3 publishes it.

## Contract-valid fixtures

`@accord/contracts/examples` exports valid example values for every major boundary type — inbound
event, decision, interpretation, run context, repository report, impact report, publication, thread
view and an empty thread view. Use them as test fixtures. They are inert data, exposed on a subpath
so no production entrypoint can pick them up from the package root.

## What is deliberately not implemented here

Every unimplemented factory throws `AccordError` with a `PublicError` code of `UNSUPPORTED` naming
its owner and branch. Every unimplemented root script exits nonzero through `tools/pending.mjs`.
Nothing in this commit reports a pass it has not earned, and no peer package has a fake success path.

Pending at this commit: all of `@accord/store` and `@accord/core` behavior, `trigger.config.ts` and
the worker tasks (Agent 1, `accord/core`); the Slack bridge and delivery (Agent 2); the repository
investigator and fixture (Agent 3); ClickHouse impact, privacy, infra, scripts and the integrated
suites (Agent 4).

## Commands

`npm ci` · `npm run typecheck` · `npm test` · `npm run verify` pass offline with no credentials at
this commit. `test:integration`, `test:live`, `dev:worker`, `db:migrate`, `demo:*` and
`review:evidence` exit nonzero and name their owner. `dev:slack` runs the real starter bridge and
fails clearly without configuration.

## Rules for the parallel phase

- Own only your assigned paths. Send root dependency, script and environment requests to Agent 1.
- Do not run simultaneous root dependency upgrades; only Agent 1 commits the root lockfile.
- Push your feature branch and open a reviewable PR. Never force-push `main`. No agent merges
  another owner's unreviewed work.
- Every handoff carries: commit SHA, public exports, commands run and their results, pending live
  checks, required configuration names, known limitations and any requested contract change.
- Gate 0 in `06-ACCEPTANCE-AND-REVIEW.md` is urgent: prove real Slack mention, real delayed same-bot
  post and update, and real model, Trigger, GitHub and ClickHouse credentials early. A missing Slack
  permission discovered at the end is a product blocker.

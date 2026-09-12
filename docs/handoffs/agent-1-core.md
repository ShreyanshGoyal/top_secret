# Agent 1 handoff — `accord/core`

Branch `accord/core`, based on bootstrap commit `4b672f1584f7987896f593b410885bcaa75c7cf4`.

This branch implements the durable state, the coordinator, the OpenAI interpretation adapter, the
four Trigger.dev tasks and the publication outbox. It does **not** implement any other owner's
package, and it does not claim any live integration: see *Pending live checks* below.

## Commands run, and their actual results

| Command | Result |
|---|---|
| `npm ci` | passes from the committed lockfile |
| `npm run typecheck` | passes, all workspaces |
| `npm test` | passes: 168 offline tests, no credentials used |
| `npm run verify` | passes |
| `npm run test:integration` | **not run here** — exits 1 with "missing DATABASE_URL"; no PostgreSQL was available on this machine |
| `npm run test:live` | **not run here** — exits 1 with "missing OPENAI_API_KEY, ACCORD_MODEL" |
| `npm run db:migrate` | **not run here** — exits 1 without `DATABASE_URL` |
| `npm run dev:worker` | **not run here** — needs Trigger.dev credentials |

Offline test counts by package: `@accord/contracts` 23, `@accord/core` 48, `@accord/store` 4,
plus the inherited starter suites (37 + 22 + 34).

## Public surface

Unchanged from bootstrap for every other owner. `@accord/contracts` is untouched: **no contract
change is requested**.

```ts
// @accord/core
createApplication(deps: IngressDependencies): ApplicationPort
createConfiguredApplication(): Promise<ApplicationPort>   // Agent 2 uses only this
processContext(deps: InvestigationDependencies, payload: ProcessContextPayload): Promise<void>
runInvestigation(deps: InvestigationDependencies, run: InvestigationPayload): Promise<void>
publishPending(deps: PublishDependencies, publicationId: Id): Promise<void>
reconcile(deps: IngressDependencies): Promise<{ dispatched: number; republished: number }>
```

Dependency shapes (all injected; no factory reads a credential at import time):

```ts
interface BaseDependencies       { store; privacy; clock; logger }
interface IngressDependencies extends BaseDependencies {
  scheduler: JobSchedulerPort; ownerId: string; botUserId: string | null;
  repositoryTarget: { owner; name; ref; pathPrefix }; dataset: { version; asOf };
}
interface InvestigationDependencies extends IngressDependencies { model; repository; impact }
interface PublishDependencies extends BaseDependencies {
  publisher: PublisherPort; render: (view: ThreadView) => string; leaseOwner: string;
}
interface JobSchedulerPort { dispatch(intent: JobIntent): Promise<{ triggerRunId: string }> }
```

`render` is Agent 2's `renderFinding`, injected so core never imports a transport package. The
publication text is rendered at send time from the current persisted view, so a queued row can
never deliver stale wording.

### Store changes since bootstrap (Agent 1 internal only)

`@accord/store` is consumed only by `@accord/core` and `apps/worker`, so these need no contract bump,
but they are listed for review: `appendDecisionVersion` now returns `Decision | null` (null when the
thread already advanced past the draft's context revision); `commitFinding` takes a `FindingDraft`
and assigns the stable per-thread finding id and revision itself; the outbox stores a
`PublicationDraft` (a `Publication` without `text`); added `claimOutboxRow`, `enqueueCorrection`,
`readOwnerAction` and `saveInvestigationTarget`.

## Task IDs and retry policy

`accord-process-context` · `accord-investigate` · `accord-publish` · `accord-reconcile`
(exported as `TASK_IDS` from `@accord/core`).

At most 3 attempts, exponential backoff with jitter. `AUTH`, `FORBIDDEN`, `INVALID_INPUT` and
`UNSUPPORTED` abort instead of retrying. The OpenAI SDK's own retries are disabled (`maxRetries: 0`)
so exactly one layer owns provider retries. Investigation wall budget is 180s excluding human time.
`accord-reconcile` runs every minute and sweeps twice, giving a recovery target near 60 seconds
after worker availability returns — a demo target, not a universal SLA.

## Configuration

Every name in `01-SHARED-CONTRACTS` section 11, plus three additions documented in `.env.example`:

- `ACCORD_BOT_USER_ID` — our own bot identity, resolved through authenticated Slack setup. Ingress
  uses it so Accord's own findings cannot re-trigger an investigation; the publisher requires it.
- `ACCORD_TRUSTED_PROFILE_VERSION` — reported by the repository investigator, defaults to `1.0`.
- `ACCORD_TEST_DATABASE_URL` — optional throwaway database for the integration suite.

`npm run db:migrate` applies `packages/accord-store/migrations/*.sql` in order and prints the applied
schema version.

## Error behavior

All failures cross package boundaries as `PublicError` through `AccordError`. Provider bodies,
headers, tokens, connection strings and row values never appear in them — there is a test asserting
a rejected value does not appear in the resulting message. Refusals, empty model output and invalid
schemas become explicit errors or clarifications, never a fabricated decision. Unknown counts stay
`null`; a Slack failure is recorded as a delivery status and never as an investigation failure.

## Example: contract-valid input and result

Input — `ApplicationPort.acceptEvent`:

```jsonc
{
  "contractVersion": "1.0", "eventKey": "Ev0EXAMPLE0001", "kind": "message",
  "thread": { "teamId": "T0TEAM", "channelId": "C0CHANNEL", "rootTs": "1757635200.000100" },
  "message": { "id": "T0TEAM:C0CHANNEL:1757635200.000100", "ts": "1757635200.000100",
               "authorId": "U0OWNER", "text": "Free verified university accounts get 90 days for existing records now.",
               "permalink": null, "editedTs": null },
  "snapshot": [ /* same message */ ], "snapshotComplete": true,
  "receivedAt": "2026-09-12T00:00:01.000Z", "wasMention": true
}
```

Result: `{ "accepted": true, "duplicate": false, "contextRevision": 1, "reason": null }`, one
`accord-process-context` intent persisted and dispatched with idempotency key
`context:<threadId>:1`. More valid examples ship at `@accord/contracts/examples`.

## What is proven, and how

Deterministic, offline, with explicit injected adapters:

- Every transition in `02-AGENT-1-CORE` section 6, including the non-owner downgrade, the stale
  bare "yes", idempotent repetition, withdrawal fencing and the refusal of a pull request in
  another repository.
- Fencing: an investigation, a database result or a Slack send that completes after the thread
  moved on cannot become the current finding; the in-flight case enqueues a correction instead.
- An uncertain delivery reconciles before any resend and never blindly reposts.
- `null` counts on an unavailable database, and no numeric impact at all when the trusted runtime
  path is unsupported.
- Model output is data: extra keys are rejected, the structured-output schema exposes no tool
  surface, and injected instructions cannot change the disposition or the response shape.

## Pending live checks — nothing below has been executed

1. **PostgreSQL integration suite.** `packages/accord-store/test/store.integration.test.ts` is
   written and covers concurrent duplicate events, unique job keys, simultaneous decision appends,
   the commit-before-dispatch gap, two publication workers, expired leases, frozen baselines,
   checkpoint reuse and receipt matching. No PostgreSQL (and no Docker) was available on this
   machine, so **it has never been run**. Run it first:
   `ACCORD_TEST_DATABASE_URL=postgres://... npm run test:integration`.
2. **Live model suite.** `packages/accord-core/test/live/model.live.ts` needs `OPENAI_API_KEY` and a
   model id that is actually enabled on the team's account. `ACCORD_MODEL` is deliberately not
   guessed anywhere in this branch.
3. **Trigger.dev.** No task has been deployed or executed. `trigger.config.ts` and the four tasks
   typecheck against the pinned SDK, and nothing more than that is claimed.
4. **Slack, GitHub, ClickHouse.** Not exercised from this branch at all; they arrive through Agents
   2, 3 and 4's ports.

## Known limitations

- `createConfiguredApplication()` needs `@accord/privacy` (Agent 4) and therefore throws
  `UNSUPPORTED` until that package merges. `createApplication(deps)` works today with injected
  adapters, which is how Agent 2 can integrate before then.
- `apps/worker` composition imports all four peer packages, so the worker cannot start until they
  merge. This is the expected merge order from `00-START-HERE` section 7.
- Per-thread serial context processing uses the Trigger concurrency key; the PostgreSQL revision
  checks remain the correctness mechanism, and the concurrency setting is not relied on for it.
- A `status` request creates no new version and no publication; the native status control reads
  `getThreadView`. If Agent 2 wants a re-post on status, say so and I will add it explicitly.

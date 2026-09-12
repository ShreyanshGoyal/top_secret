# Agent 2 — Slack runtime, native interaction and durable delivery

## Assignment

Own `apps/channel/**` and `packages/slack-delivery/**`. Implement the public ApplicationPort consumer and PublisherPort adapter from 01/contracts.ts. Do not decide policy status locally, access GitHub/ClickHouse directly, or maintain a parallel decision store. Agent 1 owns that logic.

You can develop independently with a contract-valid fake ApplicationPort and fake Slack client under tests. Your live executable must use real core and Slack credentials. Never silently replace missing services with test data.

## 1. Files and exports

```
apps/channel/src/{server,channel,agent,tools,components,normalize,config,health}.ts(x)
apps/channel/src/test/{ingress,cards,authorization}.test.ts(x)
apps/channel/slack-app-manifest.json
packages/slack-delivery/src/{client,publisher,renderer,reconcile,index}.ts
packages/slack-delivery/test/{publisher,renderer}.test.ts
```

Keep starter runtime lifecycle and fresh-agent adapter where applicable; replace incident-specific prompts/tools/cards. Files containing Channels JSX use `.tsx` and the Channels JSX import source, not React. No custom website is required.

Export `createPublisherPort` and `renderFinding` from the side-effect-free delivery package. Importing that package cannot open a socket, start an HTTP server or require Intelligence credentials. Trigger workers import it for outbound delivery only.

## 2. Transport selected deliberately

Use the direct Slack adapter provided by `@copilotkit/channels/slack`. Configure one Slack app, one bot identity, bot token and Socket Mode app token. Attach to the CopilotKit runtime with Intelligence. Do not simultaneously enable another Bolt listener, managed Slack ingestion for this same app, or a second notifier bot.

CopilotKit handles actual incoming conversation context, tool registrations and native interactions. Slack Web API using the same bot handles asynchronous post/update after background completion. This is necessary to survive an original event ending or a process restart. No Thread object, closure or managed MessageRef is sent to Trigger.dev or serialized into PostgreSQL.

Use documented installed APIs. Do not invent `channel.getThread`, `channel.start`, `threadFromId`, remote JSX rendering or background `runAgent` re-entry. Resolve actual platform identifiers from the adapter's public payload/codec. Never split a conversation key using guessed delimiters.

The full starter Channels skill is required reading before editing this directory. Its old illustrative versions must not override the actual starter lockfile.

## 3. Slack app configuration and gate zero

Initial supported channel: a public, non-Slack-Connect test channel explicitly approved for the synthetic data. Create an app named Accord, enable Socket Mode and interactivity. App token needs `connections:write`. Bot needs `app_mentions:read`, `chat:write`, `channels:history`; add `channels:read` only for actual setup checks. No `chat:write.public`, private-channel scopes or user-profile collection by default. Subscribe to `app_mention` and `message.channels` and invite the bot.

Before full implementation, prove these with real messages:

1. Correct trusted team/channel/message/user/root-thread identifiers can be extracted.
2. A mention in an existing thread reads actual earlier text through available context capability.
3. An ordinary human follow-up in the enrolled thread arrives without another mention.
4. The same bot can post asynchronously to the original root using Web API after the handler returns.
5. That bot can update its posted message with stored channel/ts.
6. Own bot publication events can be captured for delivery reconciliation but excluded from semantic ingestion.
7. A Channels native status component renders; any mutating interaction is bound to trusted actor/version and remains safe after restart.

If thread history capability is incomplete, accumulate only verified received messages and state incompleteness; the initial demo must be enrolled before its relevant conversation. Do not invent or overclaim historical access. Bot-token access to conversation replies must be tested, not assumed. If history-based uncertain-send reconciliation is unavailable, own-message receipts plus explicit uncertain status are the MVP path; do not silently request broad user tokens.

Configuration failures must stop live readiness, not trigger a second architecture. Ask the human owner to finish app installation/credentials when required; never put tokens in a PR.

## 4. Event normalization

Normalize into InboundEvent, validate, and pass once to ApplicationPort.acceptEvent.

- Check allowed team/channel before model calls, history reads or output.
- For top-level mention, rootTs is that message's ts. For a reply, preserve the platform's root thread timestamp.
- Preserve opaque decimal ts strings.
- Author identity comes from the platform, not message text or display name.
- Read bounded thread context; sanitize before persistence/model submission.
- Set snapshotComplete accurately. `[]` is not evidence that no earlier discussion exists.
- Filter own/other bot messages before semantic ingestion. Own publication events may go to the reconciliation receipt cache/store only.
- Deduplicate using a stable event key. A duplicate receipt must not produce another progress acknowledgment.
- Process normal replies only for enrolled threads. Do not turn the bot into a general channel chatbot.
- Forward supported edits/deletions distinctly. If installed adapter cannot expose silent edits, document the limitation and reconcile on the next event; do not pretend immediate edit monitoring works.

Keep acknowledgment under roughly 2 seconds after durable acceptance when infrastructure is healthy. This is a target, not a hard promise. Do not wait for GitHub or the LLM to finish inside the Slack handler.

## 5. CopilotKit surface behavior

On enrollment, show a short native Channels card:

"Accord is following this thread. I will compare confirmed retention decisions with the implementation and stored-record impact."

For ordinary messages, read ThreadView.enrolled before fetching history. Offer a safe status tool/component. The live CopilotKit agent can call `get_current_finding` to read ApplicationPort.getThreadView and render a native evidence/status component. It must not provide independent uncited answers from a different model state. Keep its prompt narrow: show persisted investigation results, explain current status and route messages; do not recompute policy outside core.

Optional-in-UX but required to test if shipped: named registered confirmation component with Confirm / Tentative / Withdraw. Component arguments include decisionId, expectedVersion and expectedContextRevision from current ThreadView.contextRevision; actorId is supplied by trusted interaction context at click time. Handler reloads state and calls acceptAction. Never capture an in-memory boolean as durable approval state. If persistence of interaction routing is unavailable, use normal owner replies for mutating controls and ship only a non-mutating status card; do not display dead buttons.

Normal owner replies are always sufficient for the full product workflow. Owner confirmation does not approve production changes. Label controls "Confirm interpretation", not "Deploy" or "Fix".

## 6. Finding presentation

Canonical background message is deterministic text from a validated ThreadView. Prefer one bot-owned message per thread, progressively updated. Final text max 3500 characters; aim under 1800. Keep context, evidence and consequence visible without opening an external dashboard.

Required ordering:

1. Status and decision version.
2. Confirmed or tentative scope in one sentence.
3. Observed implementation behavior with checked commit.
4. Impact counts when complete; explicit unknown otherwise.
5. The focused question or remaining failed check, if any.
6. Up to3 principal evidence links: Slack agreement, authoritative policy/runtime code, verification details. Include a compact query description/counts when no external query URL exists; never fabricate one.
7. Limitations, especially deployment unverified and synthetic dataset.
8. Nonsecret finding/update marker for reconciliation.

Example conflict copy (counts from payload, never hardcoded):

"Confirmed implementation conflict · decision v2\nFree verified university accounts should retain existing records for 90 days. The checked cleanup path still uses30 days.\n7 currently stored demo records across 2 accounts would be selected too early at the demo clock. No records were deleted.\nEvidence: agreement · policy source · cleanup path\nChecked commit <short SHA>; deployment unverified.\nAccord finding <full-id> · update <n> · delivery <publication-id>"

The renderer must distinguish:

| Finding | Required language |
|---|---|
| needs_clarification | Potential conflict; scope not confirmed; one question |
| conditional_impact | Conditional assessment; decision tentative |
| confirmed_conflict | Actual checked implementation contradiction, scoped evidence |
| no_conflict | No conflict found for this scope at this commit; identify override |
| impact_unverified | Code evidence available, data impact unknown; no zero count |
| verification_failed | Specific source/runtime/control check failed |
| verified_at_commit | Supported behavior verified at exact commit; deployment unverified |
| withdrawn | Triggering decision withdrawn; previous finding no longer active |
| superseded | Earlier result superseded; updated interpretation being checked |
| failed | Investigation incomplete with a safe reason/reference |

Never say data was deleted based only on an eligibility query. Never say a generated-only patch has no runtime effect if the observed generated policy changed. Never say a merge proves deployment.

## 7. Output hygiene

Escape untrusted Slack markup, especially `<@...>`, `<!here>`, `<!channel>`, and link delimiters. Only deterministic rendering may create approved links; validate host/path before turning a model-provided locator into a clickable link. Disable media/link unfurls. Do not mention users automatically. No raw rows, emails, tokens, provider errors or hidden reasoning.

If evidence is too long, show a bounded summary and offer a live status/detail interaction. Evidence details must be retrieved from validated persisted state, not a hidden unsanitized log. Use visible text fallback for accessibility. No custom branded images are required.

## 8. PublisherPort implementation

`deliver` accepts Publication, validates channel audience and text limits, and calls the same bot's Web API:

- existingTs null -> post to configured channel with `thread_ts=rootTs`, text and unfurls disabled.
- existingTs set -> update that known bot-owned message in the same channel with the new text.
- Check both HTTP status and Slack JSON `ok`. HTTP200 with `ok:false` is failure.
- Return delivered ts only after an affirmative provider result.
- Network timeout after possible acceptance -> uncertain.
- 429 -> retryable with retryAfterMs.
- invalid_auth, missing_scope, not_in_channel -> permanent configuration failure.
- A missing update target enters explicit reconciliation/replacement handling; do not create endless new findings.

Do not implement a second retry loop that fights Agent 1's outbox. Publisher performs one network attempt and reports classification; core owns scheduling. Configure any SDK automatic retry deliberately.

Capture authenticated own-bot events through ApplicationPort.recordPublicationReceipt into the shared durable store; inject PublicationReceiptReader into the publisher. Receipt absence alone is unknown. Reconciliation first checks captured own-message receipts for the exact finding/publication marker. If permitted history lookup is proven, it can scan the known thread within a bounded window. `not_found` requires a successful complete enough lookup; otherwise unknown. Metadata may hold only nonsecret IDs because workspace participants can access it. Updates to a known ts are convergent, but core must prevent an older revision overwriting a newer one.

The publisher must be useful after bridge restart because channel/rootTs/messageTs are durable primitive values. No live SDK Thread dependency.

## 9. Health and lifecycle

Start the CopilotKit runtime listener using pinned APIs and a persistent Node process. Wire shutdown before connecting. Health reports separate process liveness, Slack/Channels connectivity and state-store readiness. A listening port alone is not online Slack evidence. Never return environment values in health output.

Agent 4 supplies Cloud Run configuration; coordinate one bridge instance and external persistence. Rolling replacement can overlap, so core dedupe remains required. Use a bridge lease if needed to prevent harmful multiple active sockets; Agent 1 owns lease semantics, you own connect/disconnect behavior.

## 10. Mandatory tests

S01 foreign workspace/channel -> no history/model/job/post.
S02 unenrolled ordinary thread -> ignored; mention enrolls once.
S03 normal enrolled follow-up -> accepted once.
S04 bot finding/update -> no recursive investigation.
S05 duplicate event -> no second enrollment acknowledgment.
S06 non-owner mutation -> forbidden, no changed decision.
S07 stale action -> stale result and current scope shown.
S08 repeated action -> duplicate, no second version.
S09 restart then shipped button click -> safe current-state handling (or no mutating buttons shipped).
S10 empty history -> incomplete-context behavior, no invented quote.
S11 null counts -> unknown; no `0` substitution.
S12 fixture secret/broadcast string -> redacted/escaped before Slack output.
S13 successful delayed post after handler ends -> original thread.
S14 process restart before delayed completion -> durable publish still works.
S15 accepted post/lost response -> reconcile or uncertain, no blind duplicate.
S16 HTTP200/ok:false -> not delivered.
S17 429 -> retry timing passed to core.
S18 known ts update -> same message, no second finding.
S19 old in-flight update -> final visible latest correction in integrated test.
S20 generated-only result -> truthful non-durable explanation.
S21 UI cards render through actual pinned Channels testing/runtime APIs, not hand-built snapshots of imagined SDK objects.

## 11. Handoff

Supply exact real Slack scopes, app manifest, normalization mapping with installed types, registered component behavior, env names, smoke-test results, owned public exports and how publisher receipts are persisted/reconciled. Report any missing silent-edit or thread-history support explicitly. Your done condition includes a real delayed same-bot post and update; offline renderer tests alone are insufficient.

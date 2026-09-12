/** Race behavior with controllable promises.
 * The assertion is never "the external call was atomic". It is that the authoritative current state
 * is correct, and that an obsolete result is recorded as history and then corrected.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImpactReport, RepositoryReport, RunContext } from '@accord/contracts';
import { createApplication, processContext, publishPending, runInvestigation } from '../src/index.js';
import {
  ENGINEER, INTENT_90, OWNER, THREAD, baseDeps, fakeImpact, fakeModel, fakePublisher, fakeRepository,
  impactReport, inbound, interpretation, repositoryReport,
} from './harness.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => { resolve = innerResolve; });
  return { promise, resolve };
}

async function enrol(deps: ReturnType<typeof baseDeps> & { model: ReturnType<typeof fakeModel> }, text: string, options: Parameters<typeof inbound>[1] = {}) {
  const application = createApplication(deps);
  const event = inbound(text, { wasMention: true, ...options });
  const receipt = await application.acceptEvent(event);
  const threadRow = await deps.store.getThreadRow(THREAD);
  return { application, event, threadId: threadRow!.id, contextRevision: receipt.contextRevision! };
}

test('a repository result arriving after a clarification cannot become the current finding', async () => {
  const gate = deferred<RepositoryReport>();
  const repository = fakeRepository({ inspect: async () => gate.promise });
  const deps = {
    ...baseDeps(),
    model: fakeModel([
      interpretation({ disposition: 'confirm', intent: INTENT_90 }),
      interpretation({ disposition: 'clarify', question: 'Does this include paid accounts?' }),
    ]),
    repository,
    impact: fakeImpact(),
  };

  const first = await enrol(deps, 'Free verified university accounts get 90 days for existing records now.');
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });

  const intent = [...deps.store.jobs.values()].find((item) => item.taskType === 'accord-investigate')!;
  const payload = intent.payload as { investigationId: string; decisionId: string; decisionVersion: number; contextRevision: number };
  const investigating = runInvestigation(deps, { ...payload, pullRequestUrl: null });

  // A new human message lands while the investigation is still inside its repository call.
  const application = createApplication(deps);
  const second = inbound('Actually, does this include paid accounts?', { authorId: ENGINEER });
  const secondReceipt = await application.acceptEvent(second);
  await processContext(deps, { threadId: first.threadId, eventKey: second.eventKey, contextRevision: secondReceipt.contextRevision! });

  const clarification = await deps.store.getThreadView(THREAD);
  assert.equal(clarification.finding?.status, 'needs_clarification');

  gate.resolve(repositoryReport({ ...payload, datasetVersion: 'accord-demo-2026-09-12', asOf: '2026-09-12T00:00:00.000Z', mode: 'baseline' } as unknown as RunContext));
  await investigating;

  const view = await deps.store.getThreadView(THREAD);
  assert.equal(view.finding?.status, 'needs_clarification', 'the obsolete investigation must not overwrite the newer interpretation');
  assert.equal((await deps.store.getInvestigation(payload.investigationId))!.status, 'superseded');
});

test('a database result arriving after a tentative transition is fenced too', async () => {
  const gate = deferred<ImpactReport>();
  const deps = {
    ...baseDeps(),
    model: fakeModel([
      interpretation({ disposition: 'confirm', intent: INTENT_90 }),
      interpretation({ disposition: 'tentative', intent: null }),
    ]),
    repository: fakeRepository(),
    impact: fakeImpact(async () => gate.promise),
  };

  const first = await enrol(deps, 'Free verified university accounts get 90 days for existing records now.');
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });

  const intent = [...deps.store.jobs.values()].find((item) => item.taskType === 'accord-investigate')!;
  const payload = intent.payload as { investigationId: string; decisionId: string; decisionVersion: number; contextRevision: number };
  const investigating = runInvestigation(deps, { ...payload, pullRequestUrl: null });

  const application = createApplication(deps);
  const second = inbound('Actually let us treat this as tentative pending review.');
  const secondReceipt = await application.acceptEvent(second);
  await processContext(deps, { threadId: first.threadId, eventKey: second.eventKey, contextRevision: secondReceipt.contextRevision! });

  const run: RunContext = { ...payload, investigationId: payload.investigationId, datasetVersion: 'accord-demo-2026-09-12', asOf: '2026-09-12T00:00:00.000Z', mode: 'baseline' };
  gate.resolve(impactReport(run));
  await investigating;

  const view = await deps.store.getThreadView(THREAD);
  assert.equal(view.decision?.status, 'tentative');
  assert.notEqual(view.finding?.status, 'confirmed_conflict');
  assert.equal((await deps.store.getInvestigation(payload.investigationId))!.status, 'superseded');
});

test('a button click from an older card is visibly stale and shows the current state', async () => {
  const deps = {
    ...baseDeps(),
    model: fakeModel([
      interpretation({ disposition: 'propose', intent: INTENT_90 }),
      interpretation({ disposition: 'propose', intent: { ...INTENT_90, retentionDays: 120 } }),
    ]),
    repository: fakeRepository(),
    impact: fakeImpact(),
  };

  const first = await enrol(deps, 'Proposal: 90 days for free verified university accounts, existing records, now.', { authorId: ENGINEER });
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });

  const application = createApplication(deps);
  const stale = await application.getThreadView(THREAD);

  // The scope changes before the owner gets around to clicking the old card.
  const second = inbound('Make that 120 days instead.', { authorId: ENGINEER });
  const secondReceipt = await application.acceptEvent(second);
  await processContext(deps, { threadId: first.threadId, eventKey: second.eventKey, contextRevision: secondReceipt.contextRevision! });

  const receipt = await application.acceptAction({
    actionId: '66666666-6666-4666-8666-666666666666',
    thread: THREAD,
    actorId: OWNER,
    decisionId: stale.decision!.id,
    expectedVersion: stale.decision!.version,
    expectedContextRevision: stale.contextRevision,
    kind: 'confirm',
    occurredAt: '2026-09-12T00:01:00.000Z',
  });

  assert.equal(receipt.status, 'stale');
  assert.equal(receipt.view?.decision?.intent?.retentionDays, 120);
  assert.equal(receipt.view?.decision?.status, 'candidate');
});

test('a Slack send that lands after the decision moved enqueues a correction', async () => {
  const gate = deferred<{ status: 'delivered'; ts: string }>();
  const deps = {
    ...baseDeps(),
    model: fakeModel([
      interpretation({ disposition: 'confirm', intent: INTENT_90 }),
      interpretation({ disposition: 'tentative', intent: null }),
    ]),
    repository: fakeRepository(),
    impact: fakeImpact(),
  };

  const first = await enrol(deps, 'Free verified university accounts get 90 days for existing records now.');
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });
  const intent = [...deps.store.jobs.values()].find((item) => item.taskType === 'accord-investigate')!;
  await runInvestigation(deps, { ...(intent.payload as unknown as Record<string, never>), pullRequestUrl: null } as never);

  const publicationId = [...deps.store.outbox.values()].find((row) => row.status === 'pending')!.id;
  const started = deferred<void>();
  const publisher = {
    sent: [] as unknown[],
    async deliver(publication: unknown) {
      publisher.sent.push(publication);
      started.resolve();
      return gate.promise;
    },
    async reconcile() { return { status: 'unknown' as const }; },
  };
  const publishDeps = { ...baseDeps({ store: deps.store }), publisher, render: () => 'Accord finding · update 1', leaseOwner: 'worker-1' };

  const publishing = publishPending(publishDeps, publicationId);
  // Wait until the send is genuinely in flight, then move the decision underneath it.
  await started.promise;

  // The owner changes the decision while that send is still in flight.
  const application = createApplication(deps);
  const second = inbound('Actually let us treat this as tentative pending review.');
  const secondReceipt = await application.acceptEvent(second);
  await processContext(deps, { threadId: first.threadId, eventKey: second.eventKey, contextRevision: secondReceipt.contextRevision! });

  gate.resolve({ status: 'delivered', ts: '1757635500.000100' });
  await publishing;

  assert.equal(deps.store.outbox.get(publicationId)!.status, 'delivered');
  const corrections = [...deps.store.outbox.values()].filter((row) => row.id !== publicationId && row.status === 'pending');
  assert.equal(corrections.length >= 1, true, 'a corrective publication must be queued for the newer state');
  assert.equal(corrections.at(-1)!.expectedContextRevision, secondReceipt.contextRevision);
});

test('an uncertain delivery reconciles before any resend and never blindly reposts', async () => {
  const deps = {
    ...baseDeps(),
    model: fakeModel([interpretation({ disposition: 'confirm', intent: INTENT_90 })]),
    repository: fakeRepository(),
    impact: fakeImpact(),
  };
  const first = await enrol(deps, 'Free verified university accounts get 90 days for existing records now.');
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });
  const intent = [...deps.store.jobs.values()].find((item) => item.taskType === 'accord-investigate')!;
  await runInvestigation(deps, { ...(intent.payload as unknown as Record<string, never>), pullRequestUrl: null } as never);
  const publicationId = [...deps.store.outbox.values()].find((row) => row.status === 'pending')!.id;

  const unknownPublisher = fakePublisher(
    [{ status: 'uncertain', error: { code: 'DELIVERY_UNCERTAIN', message: 'no response', retryable: true } }],
    { status: 'unknown' },
  );
  await publishPending(
    { ...baseDeps({ store: deps.store }), publisher: unknownPublisher, render: () => 'text', leaseOwner: 'worker-1' },
    publicationId,
  );

  assert.equal(unknownPublisher.sent.length, 1, 'an unknown reconciliation must not trigger a second send');
  assert.equal(deps.store.outbox.get(publicationId)!.status, 'uncertain');

  const foundPublisher = fakePublisher(
    [{ status: 'uncertain', error: { code: 'DELIVERY_UNCERTAIN', message: 'no response', retryable: true } }],
    { status: 'found', ts: '1757635600.000100' },
  );
  await publishPending(
    { ...baseDeps({ store: deps.store }), publisher: foundPublisher, render: () => 'text', leaseOwner: 'worker-2' },
    publicationId,
  );
  assert.equal(deps.store.outbox.get(publicationId)!.status, 'delivered');
  assert.equal(deps.store.outbox.get(publicationId)!.deliveredTs, '1757635600.000100');
});

test('two publication workers cannot both claim the same row while a lease is live', async () => {
  const deps = {
    ...baseDeps(),
    model: fakeModel([interpretation({ disposition: 'confirm', intent: INTENT_90 })]),
    repository: fakeRepository(),
    impact: fakeImpact(),
  };
  const first = await enrol(deps, 'Free verified university accounts get 90 days for existing records now.');
  await processContext(deps, { threadId: first.threadId, eventKey: first.event.eventKey, contextRevision: first.contextRevision });
  const intent = [...deps.store.jobs.values()].find((item) => item.taskType === 'accord-investigate')!;
  await runInvestigation(deps, { ...(intent.payload as unknown as Record<string, never>), pullRequestUrl: null } as never);
  const publicationId = [...deps.store.outbox.values()].find((row) => row.status === 'pending')!.id;

  const claimed = await deps.store.claimOutboxRow({ publicationId, leaseOwner: 'worker-1', leaseMs: 60_000 });
  const second = await deps.store.claimOutboxRow({ publicationId, leaseOwner: 'worker-2', leaseMs: 60_000 });

  assert.ok(claimed);
  assert.equal(second, null);
});

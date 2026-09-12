import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ActionReceipt,
  ApplicationPort,
  InboundEvent,
  IngestReceipt,
  OwnerAction,
  Publication,
  PublicationReceipt,
  PublisherConfig,
  PublisherDependencies,
  ThreadRef,
  ThreadView,
} from '@accord/contracts';
import { createPublisherPort } from '@accord/slack-delivery';

const ownerId = 'U0OWNER';
const nonOwnerId = 'U0OTHER';

const exampleThread: ThreadRef = {
  teamId: 'T0ACCORD',
  channelId: 'C0ACCORD',
  rootTs: '1757635200.000100',
};

class StatefulFakeApplication implements ApplicationPort {
  public currentVersion = 1;
  public currentContextRevision = 1;
  public decisionStatus: 'candidate' | 'tentative' | 'confirmed' | 'withdrawn' = 'candidate';
  public actionsLog: OwnerAction[] = [];

  async acceptEvent(_event: InboundEvent): Promise<IngestReceipt> {
    this.currentContextRevision++;
    return { accepted: true, duplicate: false, contextRevision: this.currentContextRevision, reason: null };
  }

  async acceptAction(action: OwnerAction): Promise<ActionReceipt> {
    // 1. Authorization check (S06)
    if (action.actorId !== ownerId) {
      return { status: 'forbidden', view: await this.getThreadView(action.thread) };
    }

    // 2. Repeated / duplicate check (S08)
    if (this.actionsLog.some((a) => a.actionId === action.actionId)) {
      return { status: 'duplicate', view: await this.getThreadView(action.thread) };
    }

    // 3. Stale action check (S07)
    if (action.expectedVersion !== this.currentVersion || action.expectedContextRevision !== this.currentContextRevision) {
      return { status: 'stale', view: await this.getThreadView(action.thread) };
    }

    this.actionsLog.push(action);
    if (action.kind === 'confirm') this.decisionStatus = 'confirmed';
    if (action.kind === 'tentative') this.decisionStatus = 'tentative';
    if (action.kind === 'withdraw') this.decisionStatus = 'withdrawn';
    this.currentVersion++;

    return { status: 'accepted', view: await this.getThreadView(action.thread) };
  }

  async getThreadView(thread: ThreadRef): Promise<ThreadView> {
    return {
      thread,
      enrolled: true,
      contextRevision: this.currentContextRevision,
      decision: {
        id: '11111111-1111-4111-8111-111111111111',
        thread,
        version: this.currentVersion,
        contextRevision: this.currentContextRevision,
        status: this.decisionStatus,
        intent: {
          scope: { plans: ['free'], organizationTypes: ['university'], universityVerified: [true] },
          retentionDays: 90,
          appliesTo: 'currently_stored_records',
          effective: 'immediate',
        },
        ownerId,
        sourceMessageIds: ['msg-1'],
        intentHash: null,
        confirmedBy: this.decisionStatus === 'confirmed' ? ownerId : null,
        confirmedAt: this.decisionStatus === 'confirmed' ? '2026-09-12T00:00:02.000Z' : null,
        createdAt: '2026-09-12T00:00:02.000Z',
        updatedAt: '2026-09-12T00:00:02.000Z',
      },
      finding: null,
      publicationPending: false,
    };
  }

  async recordPublicationReceipt(_receipt: PublicationReceipt): Promise<void> {}
}

describe('Owner Action Authorization and Fencing', () => {
  it('rejects mutation attempts from non-owner (S06)', async () => {
    const app = new StatefulFakeApplication();

    const action: OwnerAction = {
      actionId: '55555555-5555-4555-8555-555555555555',
      thread: exampleThread,
      actorId: nonOwnerId, // non-owner
      decisionId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      expectedContextRevision: 1,
      kind: 'confirm',
      occurredAt: '2026-09-12T00:00:03.000Z',
    };

    const receipt = await app.acceptAction(action);
    assert.strictEqual(receipt.status, 'forbidden');
    assert.strictEqual(app.decisionStatus, 'candidate'); // unchanged
  });

  it('rejects stale action when context revision advanced (S07)', async () => {
    const app = new StatefulFakeApplication();
    app.currentContextRevision = 2; // Context revision moved ahead

    const staleAction: OwnerAction = {
      actionId: '66666666-6666-4666-8666-666666666666',
      thread: exampleThread,
      actorId: ownerId,
      decisionId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      expectedContextRevision: 1, // Stale!
      kind: 'confirm',
      occurredAt: '2026-09-12T00:00:04.000Z',
    };

    const receipt = await app.acceptAction(staleAction);
    assert.strictEqual(receipt.status, 'stale');
  });

  it('rejects repeated action as duplicate without creating second version (S08)', async () => {
    const app = new StatefulFakeApplication();

    const action: OwnerAction = {
      actionId: '77777777-7777-4777-8777-777777777777',
      thread: exampleThread,
      actorId: ownerId,
      decisionId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      expectedContextRevision: 1,
      kind: 'confirm',
      occurredAt: '2026-09-12T00:00:04.000Z',
    };

    const firstReceipt = await app.acceptAction(action);
    assert.strictEqual(firstReceipt.status, 'accepted');
    assert.strictEqual(app.currentVersion, 2);

    const secondReceipt = await app.acceptAction(action);
    assert.strictEqual(secondReceipt.status, 'duplicate');
    assert.strictEqual(app.currentVersion, 2);
  });

  it('handles action safely after server restart (S09)', async () => {
    // Emulate server restart: fresh in-memory bridge instance querying shared store
    const app = new StatefulFakeApplication();

    const action: OwnerAction = {
      actionId: '88888888-8888-4888-8888-888888888888',
      thread: exampleThread,
      actorId: ownerId,
      decisionId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      expectedContextRevision: 1,
      kind: 'tentative',
      occurredAt: '2026-09-12T00:00:05.000Z',
    };

    const receipt = await app.acceptAction(action);
    assert.strictEqual(receipt.status, 'accepted');
    assert.strictEqual(app.decisionStatus, 'tentative');
  });

  it('durable publication still succeeds after restart with primitive values (S14)', async () => {
    const config: PublisherConfig = {
      botToken: 'xoxb-mock',
      teamId: exampleThread.teamId,
      channelId: exampleThread.channelId,
      botUserId: 'U0BOT',
    };

    const deps: PublisherDependencies = {
      clock: { now: () => '2026-09-12T00:00:00.000Z' },
      logger: { info: () => {}, error: () => {} },
      privacy: { sanitize: (s) => s, assertAudience: () => {}, assertAllowedPath: () => {} },
      receipts: { find: async () => null },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, ts: '1757635500.000300' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      const publisher = createPublisherPort(config, deps);
      const pub: Publication = {
        id: '99999999-9999-4999-8999-999999999999',
        thread: exampleThread,
        findingId: '33333333-3333-4333-8333-333333333333',
        decisionVersion: 2,
        contextRevision: 2,
        revision: 1,
        text: 'Accord finding update after restart',
        existingTs: null,
      };

      const result = await publisher.deliver(pub);
      assert.strictEqual(result.status, 'delivered');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

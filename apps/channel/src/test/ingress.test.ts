import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ActionReceipt,
  ApplicationPort,
  InboundEvent,
  IngestReceipt,
  OwnerAction,
  PublicationReceipt,
  ThreadRef,
  ThreadView,
} from '@accord/contracts';
import { normalizeInboundEvent, normalizeSlackMessage } from '../normalize.js';

class FakeApplication implements ApplicationPort {
  public acceptedEvents: InboundEvent[] = [];
  public acceptedActions: OwnerAction[] = [];
  public enrolledThreads = new Set<string>();

  async acceptEvent(event: InboundEvent): Promise<IngestReceipt> {
    const threadKey = `${event.thread.teamId}:${event.thread.channelId}:${event.thread.rootTs}`;

    // Check duplicate eventKey
    if (this.acceptedEvents.some((e) => e.eventKey === event.eventKey)) {
      return { accepted: false, duplicate: true, contextRevision: null, reason: 'duplicate event' };
    }

    this.acceptedEvents.push(event);
    this.enrolledThreads.add(threadKey);

    return {
      accepted: true,
      duplicate: false,
      contextRevision: this.acceptedEvents.length,
      reason: null,
    };
  }

  async acceptAction(action: OwnerAction): Promise<ActionReceipt> {
    this.acceptedActions.push(action);
    return { status: 'accepted', view: null };
  }

  async getThreadView(thread: ThreadRef): Promise<ThreadView> {
    const threadKey = `${thread.teamId}:${thread.channelId}:${thread.rootTs}`;
    const enrolled = this.enrolledThreads.has(threadKey);
    return {
      thread,
      enrolled,
      contextRevision: enrolled ? 1 : 0,
      decision: null,
      finding: null,
      publicationPending: false,
    };
  }

  async recordPublicationReceipt(_receipt: PublicationReceipt): Promise<void> {}
}

const allowedAudience = {
  teamId: 'T0ACCORD',
  channelId: 'C0ACCORD',
};

describe('Slack Ingress Normalization & Filtering', () => {
  it('blocks events from foreign workspace/channel (S01)', () => {
    const foreignEvent = normalizeInboundEvent(
      {
        teamId: 'T0FOREIGN',
        channelId: 'C0FOREIGN',
        messageTs: '1757635200.000100',
        authorId: 'U0USER',
        text: 'Hello from outside',
        wasMention: true,
      },
      allowedAudience,
    );

    assert.strictEqual(foreignEvent, null);
  });

  it('ignores unenrolled ordinary messages until mentioned (S02)', async () => {
    const app = new FakeApplication();

    // Check initial thread view is unenrolled
    const viewBefore = await app.getThreadView({
      teamId: allowedAudience.teamId,
      channelId: allowedAudience.channelId,
      rootTs: '1757635200.000100',
    });
    assert.strictEqual(viewBefore.enrolled, false);

    // Mention normalizes and enrolls
    const mentionEvent = normalizeInboundEvent(
      {
        teamId: allowedAudience.teamId,
        channelId: allowedAudience.channelId,
        messageTs: '1757635200.000100',
        authorId: 'U0USER',
        text: 'Accord please check retention',
        wasMention: true,
      },
      allowedAudience,
    );

    assert.ok(mentionEvent !== null);
    assert.strictEqual(mentionEvent.wasMention, true);
    assert.strictEqual(mentionEvent.thread.rootTs, '1757635200.000100');

    const receipt = await app.acceptEvent(mentionEvent);
    assert.strictEqual(receipt.accepted, true);

    const viewAfter = await app.getThreadView(mentionEvent.thread);
    assert.strictEqual(viewAfter.enrolled, true);
  });

  it('accepts normal enrolled follow-up without another mention (S03)', async () => {
    const app = new FakeApplication();

    const followUpEvent = normalizeInboundEvent(
      {
        teamId: allowedAudience.teamId,
        channelId: allowedAudience.channelId,
        rootTs: '1757635200.000100',
        messageTs: '1757635210.000200',
        authorId: 'U0USER',
        text: 'This applies to all free accounts as well',
        wasMention: false,
      },
      allowedAudience,
    );

    assert.ok(followUpEvent !== null);
    assert.strictEqual(followUpEvent.wasMention, false);
    assert.strictEqual(followUpEvent.thread.rootTs, '1757635200.000100');

    const receipt = await app.acceptEvent(followUpEvent);
    assert.strictEqual(receipt.accepted, true);
    assert.strictEqual(receipt.duplicate, false);
  });

  it('filters out bot messages and updates to prevent recursive loops (S04)', () => {
    const botMessage = normalizeInboundEvent(
      {
        teamId: allowedAudience.teamId,
        channelId: allowedAudience.channelId,
        messageTs: '1757635220.000300',
        authorId: 'B0BOT',
        isBot: true,
        botId: 'B0BOT',
        text: 'Accord finding 33333333-3333-4333-8333-333333333333 · update 1',
        wasMention: false,
      },
      allowedAudience,
    );

    assert.strictEqual(botMessage, null);
  });

  it('deduplicates duplicate events by stable eventKey (S05)', async () => {
    const app = new FakeApplication();

    const raw = {
      teamId: allowedAudience.teamId,
      channelId: allowedAudience.channelId,
      messageTs: '1757635200.000100',
      authorId: 'U0USER',
      text: 'Free accounts get 90 days',
      wasMention: true,
    };

    const event1 = normalizeInboundEvent(raw, allowedAudience);
    const event2 = normalizeInboundEvent(raw, allowedAudience);

    assert.ok(event1 !== null && event2 !== null);
    assert.strictEqual(event1.eventKey, event2.eventKey);

    const receipt1 = await app.acceptEvent(event1);
    assert.strictEqual(receipt1.accepted, true);
    assert.strictEqual(receipt1.duplicate, false);

    const receipt2 = await app.acceptEvent(event2);
    assert.strictEqual(receipt2.accepted, false);
    assert.strictEqual(receipt2.duplicate, true);
  });

  it('marks empty history context incomplete accurately (S10)', () => {
    const event = normalizeInboundEvent(
      {
        teamId: allowedAudience.teamId,
        channelId: allowedAudience.channelId,
        messageTs: '1757635200.000100',
        authorId: 'U0USER',
        text: 'Just a single message',
        history: [],
        historyComplete: false,
      },
      allowedAudience,
    );

    assert.ok(event !== null);
    assert.strictEqual(event.snapshotComplete, false);
    assert.strictEqual(event.snapshot.length, 1);
  });
});

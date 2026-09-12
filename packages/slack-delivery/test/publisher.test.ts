import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ClockPort,
  PrivacyPort,
  Publication,
  PublicationReceipt,
  PublicationReceiptReader,
  PublisherConfig,
  PublisherDependencies,
  SafeLoggerPort,
  ThreadRef,
} from '@accord/contracts';
import { SlackWebClient } from '../src/client.js';
import { createPublisherPort } from '../src/publisher.js';

const exampleThread: ThreadRef = {
  teamId: 'T0EXAMPLE00',
  channelId: 'C0EXAMPLE00',
  rootTs: '1757635200.000100',
};

const exampleFindingId = '33333333-3333-4333-8333-333333333333';

const examplePublication: Publication = {
  id: '44444444-4444-4444-8444-444444444444',
  thread: exampleThread,
  findingId: exampleFindingId,
  decisionVersion: 1,
  contextRevision: 1,
  revision: 1,
  text: `Accord finding ${exampleFindingId} · update 1 · delivery 44444444-4444-4444-8444-444444444444`,
  existingTs: null,
};

const mockClock: ClockPort = {
  now: () => '2026-09-12T00:00:00.000Z',
};

const mockLogger: SafeLoggerPort = {
  info: () => {},
  error: () => {},
};

const mockPrivacy: PrivacyPort = {
  sanitize: (input) => input,
  assertAudience: () => {},
  assertAllowedPath: () => {},
};

class FakeReceiptReader implements PublicationReceiptReader {
  private receipts = new Map<string, PublicationReceipt>();

  set(id: string, receipt: PublicationReceipt) {
    this.receipts.set(id, receipt);
  }

  async find(id: string): Promise<PublicationReceipt | null> {
    return this.receipts.get(id) ?? null;
  }
}

const config: PublisherConfig = {
  botToken: 'xoxb-mock-token',
  teamId: exampleThread.teamId,
  channelId: exampleThread.channelId,
  botUserId: 'U0BOTUSER00',
};

describe('PublisherPort', () => {
  it('posts a new threaded message when existingTs is null (S13)', async () => {
    const receipts = new FakeReceiptReader();
    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    let requestedUrl = '';
    let requestedBody: Record<string, unknown> = {};

    const customClient = new SlackWebClient({
      botToken: config.botToken,
      baseUrl: 'https://slack.local/api',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(JSON.stringify({ ok: true, ts: '1757635300.000200' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const publisher = createPublisherPort(config, deps, customClient);
      const res = await publisher.deliver(examplePublication);

      assert.strictEqual(res.status, 'delivered');
      if (res.status === 'delivered') {
        assert.strictEqual(res.ts, '1757635300.000200');
      }
      assert.ok(requestedUrl.endsWith('/chat.postMessage'));
      assert.strictEqual(requestedBody.thread_ts, exampleThread.rootTs);
      assert.strictEqual(requestedBody.channel, exampleThread.channelId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('updates an existing message when existingTs is provided (S18)', async () => {
    const receipts = new FakeReceiptReader();
    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    let requestedUrl = '';
    let requestedBody: Record<string, unknown> = {};

    const customClient = new SlackWebClient({
      botToken: config.botToken,
      baseUrl: 'https://slack.local/api',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(JSON.stringify({ ok: true, ts: '1757635300.000200' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const publisher = createPublisherPort(config, deps, customClient);
      const pubWithExisting: Publication = {
        ...examplePublication,
        existingTs: '1757635300.000200',
      };
      const res = await publisher.deliver(pubWithExisting);

      assert.strictEqual(res.status, 'delivered');
      assert.ok(requestedUrl.endsWith('/chat.update'));
      assert.strictEqual(requestedBody.ts, '1757635300.000200');
      assert.strictEqual(requestedBody.channel, exampleThread.channelId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles HTTP 200 with ok:false as failure (S16)', async () => {
    const receipts = new FakeReceiptReader();
    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    const customClient = new SlackWebClient({
      botToken: config.botToken,
      baseUrl: 'https://slack.local/api',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ ok: false, error: 'channel_not_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const publisher = createPublisherPort(config, deps, customClient);
      const res = await publisher.deliver(examplePublication);

      assert.strictEqual(res.status, 'permanent_failure');
      if (res.status === 'permanent_failure') {
        assert.strictEqual(res.error.code, 'FORBIDDEN');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('extracts retry timing on HTTP 429 rate limits (S17)', async () => {
    const receipts = new FakeReceiptReader();
    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    const customClient = new SlackWebClient({
      botToken: config.botToken,
      baseUrl: 'https://slack.local/api',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '5',
        },
      });
    };

    try {
      const publisher = createPublisherPort(config, deps, customClient);
      const res = await publisher.deliver(examplePublication);

      assert.strictEqual(res.status, 'retryable');
      if (res.status === 'retryable') {
        assert.strictEqual(res.retryAfterMs, 5000);
        assert.strictEqual(res.error.code, 'RATE_LIMIT');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reconciles from durable publication receipts (S15)', async () => {
    const receipts = new FakeReceiptReader();
    receipts.set(examplePublication.id, {
      publicationId: examplePublication.id,
      findingId: exampleFindingId,
      publicationRevision: 1,
      thread: exampleThread,
      ts: '1757635300.000200',
      botUserId: 'U0BOTUSER00',
      observedAt: '2026-09-12T00:00:05.000Z',
    });

    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    const publisher = createPublisherPort(config, deps);
    const result = await publisher.reconcile(examplePublication);

    assert.strictEqual(result.status, 'found');
    if (result.status === 'found') {
      assert.strictEqual(result.ts, '1757635300.000200');
    }
  });

  it('reconciles by scanning thread history for the finding marker if receipt is absent (S15)', async () => {
    const receipts = new FakeReceiptReader();
    const deps: PublisherDependencies = {
      clock: mockClock,
      logger: mockLogger,
      privacy: mockPrivacy,
      receipts,
    };

    const customClient = new SlackWebClient({
      botToken: config.botToken,
      baseUrl: 'https://slack.local/api',
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('conversations.replies')) {
        return new Response(
          JSON.stringify({
            ok: true,
            messages: [
              {
                ts: '1757635200.000100',
                text: 'Free accounts with verified university status get 90 days',
              },
              {
                ts: '1757635300.000200',
                text: `Confirmed implementation conflict · decision v1\nAccord finding ${exampleFindingId} · update 1 · delivery ${examplePublication.id}`,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    };

    try {
      const publisher = createPublisherPort(config, deps, customClient);
      const result = await publisher.reconcile(examplePublication);

      assert.strictEqual(result.status, 'found');
      if (result.status === 'found') {
        assert.strictEqual(result.ts, '1757635300.000200');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

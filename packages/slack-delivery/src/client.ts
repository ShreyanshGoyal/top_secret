/** @accord/slack-delivery — Slack Web API client wrapper.
 * Directly calls Slack Web API with strict response classification:
 * - HTTP 200 + ok: true -> success
 * - HTTP 200 + ok: false -> permanent or provider error
 * - HTTP 429 -> RATE_LIMIT with retryAfterMs
 * - Network timeout / fetch failure -> DELIVERY_UNCERTAIN / TIMEOUT
 */
import type { DeliveryResult, PublicError } from '@accord/contracts';
import { publicError } from '@accord/contracts';

export interface SlackClientOptions {
  botToken: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface SlackPostMessageParams {
  channel: string;
  text: string;
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackUpdateMessageParams {
  channel: string;
  ts: string;
  text: string;
}

export interface SlackHistoryParams {
  channel: string;
  latest?: string;
  oldest?: string;
  inclusive?: boolean;
  limit?: number;
}

export interface SlackRepliesParams {
  channel: string;
  ts: string;
  latest?: string;
  oldest?: string;
  inclusive?: boolean;
  limit?: number;
}

export interface SlackApiResponse {
  ok: boolean;
  ts?: string;
  error?: string;
  messages?: Array<{
    ts: string;
    text: string;
    user?: string;
    bot_id?: string;
    app_id?: string;
    thread_ts?: string;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
}

export class SlackWebClient {
  private readonly botToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: SlackClientOptions) {
    this.botToken = options.botToken;
    this.baseUrl = options.baseUrl ?? 'https://slack.com/api';
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async postMessage(params: SlackPostMessageParams): Promise<DeliveryResult> {
    return this.callApi('chat.postMessage', {
      channel: params.channel,
      text: params.text,
      thread_ts: params.thread_ts,
      unfurl_links: params.unfurl_links ?? false,
      unfurl_media: params.unfurl_media ?? false,
    });
  }

  async updateMessage(params: SlackUpdateMessageParams): Promise<DeliveryResult> {
    return this.callApi('chat.update', {
      channel: params.channel,
      ts: params.ts,
      text: params.text,
    });
  }

  async getConversationReplies(params: SlackRepliesParams): Promise<{ ok: true; messages: NonNullable<SlackApiResponse['messages']> } | { ok: false; error: PublicError }> {
    const url = new URL(`${this.baseUrl}/conversations.replies`);
    url.searchParams.set('channel', params.channel);
    url.searchParams.set('ts', params.ts);
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.latest) url.searchParams.set('latest', params.latest);
    if (params.oldest) url.searchParams.set('oldest', params.oldest);
    if (params.inclusive !== undefined) url.searchParams.set('inclusive', String(params.inclusive));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        return { ok: false, error: publicError('RATE_LIMIT', 'Slack API rate limited') };
      }

      const json = (await response.json()) as SlackApiResponse;
      if (!response.ok || !json.ok) {
        return { ok: false, error: classifySlackError(json.error ?? `HTTP ${response.status}`) };
      }

      return { ok: true, messages: json.messages ?? [] };
    } catch (err) {
      return { ok: false, error: publicError('TIMEOUT', 'Slack API request failed') };
    } finally {
      clearTimeout(timer);
    }
  }

  private async callApi(endpoint: string, body: Record<string, unknown>): Promise<DeliveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
        const retryAfterMs = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 1000;
        return {
          status: 'retryable',
          error: publicError('RATE_LIMIT', 'Slack API rate limited (429)'),
          retryAfterMs,
        };
      }

      const json = (await response.json()) as SlackApiResponse;

      if (!response.ok || !json.ok) {
        const slackErr = json.error ?? `HTTP ${response.status}`;
        const classified = classifySlackError(slackErr);
        if (classified.retryable) {
          return {
            status: 'retryable',
            error: classified,
            retryAfterMs: null,
          };
        }
        return {
          status: 'permanent_failure',
          error: classified,
        };
      }

      if (json.ts) {
        return {
          status: 'delivered',
          ts: json.ts,
        };
      }

      return {
        status: 'uncertain',
        error: publicError('DELIVERY_UNCERTAIN', 'Slack returned ok: true without message timestamp'),
      };
    } catch (err: unknown) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      return {
        status: 'uncertain',
        error: publicError(
          isAbort ? 'TIMEOUT' : 'DELIVERY_UNCERTAIN',
          isAbort ? 'Slack delivery request timed out' : 'Slack delivery request failed after possible network send',
        ),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function classifySlackError(error: string): PublicError {
  switch (error) {
    case 'invalid_auth':
    case 'account_inactive':
    case 'token_revoked':
    case 'token_expired':
      return publicError('AUTH', `Slack authentication failure: ${error}`);
    case 'missing_scope':
    case 'not_in_channel':
    case 'channel_not_found':
    case 'is_archived':
    case 'restricted_action':
      return publicError('FORBIDDEN', `Slack access forbidden: ${error}`);
    case 'message_not_found':
    case 'cant_update_message':
    case 'edit_window_closed':
    case 'no_text':
    case 'msg_too_long':
      return publicError('INVALID_INPUT', `Slack input rejected: ${error}`);
    case 'ratelimited':
      return publicError('RATE_LIMIT', 'Slack rate limit exceeded');
    case 'service_unavailable':
    case 'internal_error':
      return publicError('PROVIDER_ERROR', `Slack server error: ${error}`);
    default:
      return publicError('PROVIDER_ERROR', `Slack error: ${error}`);
  }
}

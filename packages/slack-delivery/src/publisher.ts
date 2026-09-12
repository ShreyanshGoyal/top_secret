/** @accord/slack-delivery — PublisherPort factory and implementation.
 * Delivers and reconciles publications via Slack Web API.
 */
import type {
  DeliveryResult,
  Publication,
  PublisherConfig,
  PublisherDependencies,
  PublisherPort,
} from '@accord/contracts';
import {
  AccordError,
  PublicationSchema,
  publicError,
  validate,
} from '@accord/contracts';
import { SlackWebClient } from './client.js';
import { reconcilePublication } from './reconcile.js';

export class SlackPublisher implements PublisherPort {
  private readonly config: PublisherConfig;
  private readonly deps: PublisherDependencies;
  private readonly client: SlackWebClient;

  constructor(config: PublisherConfig, deps: PublisherDependencies, customClient?: SlackWebClient) {
    this.config = config;
    this.deps = deps;
    this.client = customClient ?? new SlackWebClient({ botToken: config.botToken });
  }

  async deliver(publication: Publication): Promise<DeliveryResult> {
    const validPub = validate(PublicationSchema, publication, 'deliver publication');

    // Audience assertion: publication must target configured team & channel
    if (validPub.thread.teamId !== this.config.teamId || validPub.thread.channelId !== this.config.channelId) {
      return {
        status: 'permanent_failure',
        error: publicError(
          'FORBIDDEN',
          `Publication target ${validPub.thread.teamId}/${validPub.thread.channelId} does not match configured ${this.config.teamId}/${this.config.channelId}`,
        ),
      };
    }

    try {
      if (validPub.existingTs) {
        // Update existing bot message
        return await this.client.updateMessage({
          channel: validPub.thread.channelId,
          ts: validPub.existingTs,
          text: validPub.text,
        });
      } else {
        // Post new threaded message
        return await this.client.postMessage({
          channel: validPub.thread.channelId,
          text: validPub.text,
          thread_ts: validPub.thread.rootTs,
          unfurl_links: false,
          unfurl_media: false,
        });
      }
    } catch (err: unknown) {
      if (err instanceof AccordError) {
        return {
          status: err.public.retryable ? 'retryable' : 'permanent_failure',
          error: err.public,
          retryAfterMs: null,
        };
      }
      return {
        status: 'uncertain',
        error: publicError('DELIVERY_UNCERTAIN', 'Unexpected failure during Slack delivery'),
      };
    }
  }

  async reconcile(publication: Publication): Promise<{ status: 'found'; ts: string } | { status: 'not_found' | 'unknown' }> {
    const validPub = validate(PublicationSchema, publication, 'reconcile publication');
    return reconcilePublication(validPub, this.deps.receipts, this.client);
  }
}

export function createPublisherPort(
  config: PublisherConfig,
  deps: PublisherDependencies,
  customClient?: SlackWebClient,
): PublisherPort {
  return new SlackPublisher(config, deps, customClient);
}

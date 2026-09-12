/** @accord/channel — CopilotKit Channels Slack channel setup.
 * Handles direct Slack Socket Mode events, enrollment, inbound normalization, and native interaction routing.
 */
import { createChannel } from '@copilotkit/channels';
import { slack, defaultSlackTools, defaultSlackContext } from '@copilotkit/channels/slack';
import type { ApplicationPort, OwnerAction } from '@accord/contracts';
import { randomUUID } from 'node:crypto';
import { makeChannelAgent } from './agent.js';
import { ConfirmationCard, EnrollmentCard, StatusCard } from './components.js';
import type { ChannelAppConfig } from './config.js';
import { normalizeInboundEvent, normalizeSlackMessage } from './normalize.js';
import { createChannelTools } from './tools.js';

export function createSlackChannel(app: ApplicationPort, config: ChannelAppConfig) {
  const tools = [
    ...createChannelTools(app, { teamId: config.teamId, channelId: config.channelId }),
    ...defaultSlackTools,
  ];

  const channel = createChannel({
    name: config.channelCode,
    identifyUser: 'platform',
    adapters: [
      slack({
        botToken: config.slackBotToken,
        appToken: config.slackAppToken,
      }),
    ],
    agent: makeChannelAgent,
    tools,
    context: [
      ...defaultSlackContext,
      {
        description: 'Role',
        value: 'Accord compliance and data retention verification assistant.',
      },
      {
        description: 'Allowed Audience',
        value: `Team: ${config.teamId}, Channel: ${config.channelId}`,
      },
    ],
  });

  // Handle Mentions (Enrolls thread)
  channel.onMention(async ({ thread, message }) => {
    const rawText = message.text ?? '';
    const msgRecord = message as unknown as Record<string, unknown>;
    const userObj = message.user as { id?: string } | null;
    const authorId = userObj?.id ?? (typeof msgRecord.user === 'string' ? msgRecord.user : (msgRecord.authorId as string | undefined)) ?? 'unknown';
    const messageTs = (typeof msgRecord.ts === 'string' ? msgRecord.ts : null) ?? String(Date.now() / 1000);
    const threadRecord = thread as unknown as Record<string, unknown>;
    const rootTs = (threadRecord.rootTs as string | undefined) ?? (threadRecord.threadId as string | undefined) ?? (threadRecord.id as string | undefined) ?? messageTs;

    const inbound = normalizeInboundEvent(
      {
        teamId: config.teamId,
        channelId: config.channelId,
        rootTs,
        messageTs,
        authorId,
        text: rawText,
        wasMention: true,
      },
      { teamId: config.teamId, channelId: config.channelId },
    );

    if (!inbound) {
      return;
    }

    const receipt = await app.acceptEvent(inbound);
    if (receipt.accepted) {
      await thread.subscribe();
      await thread.post(EnrollmentCard());
    }
  });

  // Handle Enrolled Messages
  channel.onMessage(async ({ thread, message }) => {
    const isSubscribed = await thread.isSubscribed();
    if (!isSubscribed) {
      return;
    }

    const rawText = message.text ?? '';
    const msgRecord = message as unknown as Record<string, unknown>;
    const userObj = message.user as { id?: string } | null;
    const authorId = userObj?.id ?? (typeof msgRecord.user === 'string' ? msgRecord.user : (msgRecord.authorId as string | undefined)) ?? 'unknown';
    const messageTs = (typeof msgRecord.ts === 'string' ? msgRecord.ts : null) ?? String(Date.now() / 1000);
    const threadRecord = thread as unknown as Record<string, unknown>;
    const rootTs = (threadRecord.rootTs as string | undefined) ?? (threadRecord.threadId as string | undefined) ?? (threadRecord.id as string | undefined) ?? messageTs;

    const inbound = normalizeInboundEvent(
      {
        teamId: config.teamId,
        channelId: config.channelId,
        rootTs,
        messageTs,
        authorId,
        text: rawText,
        wasMention: false,
      },
      { teamId: config.teamId, channelId: config.channelId },
    );

    if (!inbound) {
      return;
    }

    const receipt = await app.acceptEvent(inbound);
    if (receipt.accepted) {
      await thread.runAgent();
    }
  });

  return channel;
}

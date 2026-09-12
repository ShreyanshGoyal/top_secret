/** @accord/channel — event normalization & validation.
 * Converts raw platform events into strictly validated InboundEvent contracts.
 */
import type { InboundEvent, SlackMessage, ThreadRef } from '@accord/contracts';
import { CONTRACT_VERSION, InboundEventSchema, LIMITS, SlackMessageSchema, validate } from '@accord/contracts';
import { createHash } from 'node:crypto';

export interface RawSlackEventInput {
  teamId: string;
  channelId: string;
  rootTs?: string | null;
  messageTs: string;
  authorId: string;
  text: string;
  isBot?: boolean;
  botId?: string;
  wasMention?: boolean;
  kind?: 'message' | 'message_edited' | 'message_deleted';
  editedTs?: string | null;
  permalink?: string | null;
  history?: Array<{
    ts: string;
    authorId: string;
    text: string;
    editedTs?: string | null;
    permalink?: string | null;
  }>;
  historyComplete?: boolean;
  receivedAt?: string;
}

export function isAllowedAudience(
  teamId: string,
  channelId: string,
  allowed: { teamId: string; channelId: string },
): boolean {
  return teamId === allowed.teamId && channelId === allowed.channelId;
}

export function makeEventKey(
  teamId: string,
  channelId: string,
  messageTs: string,
  kind: string,
  editedTs?: string | null,
  text?: string,
): string {
  const contentDigest = text
    ? createHash('sha256').update(text).digest('hex').slice(0, 16)
    : 'notext';
  const editPart = editedTs ? `:${editedTs}` : '';
  return `ev:${teamId}:${channelId}:${messageTs}:${kind}${editPart}:${contentDigest}`;
}

export function normalizeSlackMessage(
  teamId: string,
  channelId: string,
  raw: {
    ts: string;
    authorId: string;
    text?: string;
    permalink?: string | null;
    editedTs?: string | null;
  },
): SlackMessage {
  const sanitizedText = (raw.text ?? '').slice(0, LIMITS.messageText);
  const msg: SlackMessage = {
    id: `${teamId}:${channelId}:${raw.ts}`,
    ts: raw.ts,
    authorId: raw.authorId,
    text: sanitizedText,
    permalink: raw.permalink ?? null,
    editedTs: raw.editedTs ?? null,
  };
  return validate(SlackMessageSchema, msg, 'normalizeSlackMessage');
}

export function normalizeInboundEvent(
  raw: RawSlackEventInput,
  allowed: { teamId: string; channelId: string },
): InboundEvent | null {
  // 1. Foreign workspace / channel check (S01)
  if (!isAllowedAudience(raw.teamId, raw.channelId, allowed)) {
    return null;
  }

  // 2. Filter bot messages (S04)
  if (raw.isBot || raw.botId) {
    return null;
  }

  const kind = raw.kind ?? 'message';
  const rootTs = raw.rootTs && raw.rootTs.trim() !== '' ? raw.rootTs : raw.messageTs;
  const thread: ThreadRef = {
    teamId: raw.teamId,
    channelId: raw.channelId,
    rootTs,
  };

  const message = normalizeSlackMessage(raw.teamId, raw.channelId, {
    ts: raw.messageTs,
    authorId: raw.authorId,
    text: raw.text,
    editedTs: raw.editedTs,
    permalink: raw.permalink,
  });

  const now = raw.receivedAt ?? new Date().toISOString();
  const eventKey = makeEventKey(raw.teamId, raw.channelId, raw.messageTs, kind, raw.editedTs, raw.text);

  const snapshot: SlackMessage[] = [];
  if (raw.history && raw.history.length > 0) {
    for (const h of raw.history.slice(-LIMITS.snapshotMessages)) {
      snapshot.push(normalizeSlackMessage(raw.teamId, raw.channelId, h));
    }
  } else {
    snapshot.push(message);
  }

  const event: InboundEvent = {
    contractVersion: CONTRACT_VERSION,
    eventKey,
    kind,
    thread,
    message,
    snapshot,
    snapshotComplete: raw.historyComplete ?? true,
    receivedAt: now,
    wasMention: raw.wasMention ?? false,
  };

  return validate(InboundEventSchema, event, 'normalizeInboundEvent');
}

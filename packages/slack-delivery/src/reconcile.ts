/** @accord/slack-delivery — publication reconciliation.
 * Reconciles uncertain deliveries by first consulting persisted own-bot publication receipts,
 * and optionally scanning the bounded thread history window for the exact finding/delivery marker.
 */
import type { Publication, PublicationReceiptReader } from '@accord/contracts';
import type { SlackWebClient } from './client.js';

export type ReconcileResult = { status: 'found'; ts: string } | { status: 'not_found' | 'unknown' };

export async function reconcilePublication(
  publication: Publication,
  receipts: PublicationReceiptReader,
  client?: SlackWebClient,
): Promise<ReconcileResult> {
  // 1. Check durable publication receipts first
  const receipt = await receipts.find(publication.id);
  if (receipt && receipt.ts) {
    return { status: 'found', ts: receipt.ts };
  }

  // 2. If client is available, search thread replies for the marker
  if (client) {
    const repliesResult = await client.getConversationReplies({
      channel: publication.thread.channelId,
      ts: publication.thread.rootTs,
      limit: 50,
    });

    if (repliesResult.ok) {
      const markerPrefix = `Accord finding ${publication.findingId}`;
      const deliveryMarker = `delivery ${publication.id}`;

      for (const msg of repliesResult.messages) {
        if (msg.text && (msg.text.includes(deliveryMarker) || (msg.text.includes(markerPrefix) && msg.text.includes(`update ${publication.contextRevision}`)))) {
          return { status: 'found', ts: msg.ts };
        }
      }

      // If the scan was complete (less than 50 messages returned or no more), it's not found
      return { status: 'not_found' };
    }
  }

  // 3. Absence of receipt alone without complete search evidence is unknown
  return { status: 'unknown' };
}

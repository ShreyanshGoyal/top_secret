/** @accord/channel — Channels agent tools.
 * Safe tools for reading persisted findings and thread status from ApplicationPort.
 */
import { defineChannelTool } from '@copilotkit/channels';
import type { ApplicationPort } from '@accord/contracts';
import { z } from 'zod';
import { StatusCard } from './components.js';

export function createChannelTools(
  app: ApplicationPort,
  config: { teamId: string; channelId: string },
) {
  const getCurrentFinding = defineChannelTool({
    name: 'get_current_finding',
    description: 'Get the current persisted Accord finding and investigation status for this thread.',
    parameters: z.object({
      threadTs: z.string().describe('The root thread timestamp of the conversation.'),
    }),
    async handler({ threadTs }, { thread }) {
      const view = await app.getThreadView({
        teamId: config.teamId,
        channelId: config.channelId,
        rootTs: threadTs,
      });

      if (!view.enrolled) {
        return 'This thread is not currently enrolled in Accord tracking.';
      }

      if (!view.finding) {
        return 'Accord is actively following this thread. No investigation finding has been generated yet.';
      }

      await thread.post(StatusCard({ view }));
      return `Displayed current finding: ${view.finding.title} (status: ${view.finding.status}, decision v${view.finding.decisionVersion}).`;
    },
  });

  return [getCurrentFinding];
}

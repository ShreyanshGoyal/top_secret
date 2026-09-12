/** @accord/channel — Channels agent factory.
 * Fresh BuiltInAgent with narrow prompt bounded to persisted investigation evidence.
 */
import { BuiltInAgent } from '@copilotkit/runtime/v2';

export function makeChannelAgent(threadId: string): BuiltInAgent {
  const model = process.env.ACCORD_MODEL || 'openai:gpt-4o-mini';
  const agent = new BuiltInAgent({
    model,
    maxSteps: 5,
    prompt: `You are Accord, a compliance and retention decision assistant for Slack.
Your responsibilities:
- Show persisted investigation findings and current decision status using the available tools.
- Never invent retention rules, policy calculations, or data counts outside of ApplicationPort findings.
- When an owner asks about status, use get_current_finding to display the exact persisted record.
- Explain status calmly and accurately.`,
  });
  agent.threadId = threadId;
  return agent;
}

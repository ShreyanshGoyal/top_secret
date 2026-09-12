/** @accord/channel — server & bridge configuration loader.
 * Validates environment variables required for the direct Slack adapter and CopilotKit runtime.
 */
import { AccordError, publicError } from '@accord/contracts';

export interface ChannelAppConfig {
  intelligenceApiKey: string;
  channelCode: string;
  slackBotToken: string;
  slackAppToken: string;
  teamId: string;
  channelId: string;
  ownerUserId: string;
  port: number;
  mode: 'demo' | 'live';
  intelligenceApiUrl?: string;
  intelligenceWsUrl?: string;
}

export function loadChannelConfig(env: Record<string, string | undefined> = process.env): ChannelAppConfig {
  const missing: string[] = [];

  const get = (key: string): string => {
    const val = env[key];
    if (!val || val.trim() === '') {
      missing.push(key);
      return '';
    }
    return val.trim();
  };

  const intelligenceApiKey = get('INTELLIGENCE_API_KEY');
  const channelCode = get('CHANNEL_CODE');
  const slackBotToken = get('SLACK_BOT_TOKEN');
  const slackAppToken = get('SLACK_APP_TOKEN');
  const teamId = get('ACCORD_SLACK_TEAM_ID');
  const channelId = get('ACCORD_SLACK_CHANNEL_ID');
  const ownerUserId = get('ACCORD_OWNER_SLACK_USER_ID');

  if (missing.length > 0) {
    throw new AccordError(
      publicError('AUTH', `Missing required environment configuration: ${missing.join(', ')}`),
    );
  }

  const portRaw = env.PORT ?? '3000';
  const port = parseInt(portRaw, 10);
  const mode = env.ACCORD_MODE === 'live' ? 'live' : 'demo';

  return {
    intelligenceApiKey,
    channelCode,
    slackBotToken,
    slackAppToken,
    teamId,
    channelId,
    ownerUserId,
    port: Number.isFinite(port) ? port : 3000,
    mode,
    intelligenceApiUrl: env.INTELLIGENCE_API_URL,
    intelligenceWsUrl: env.INTELLIGENCE_GATEWAY_WS_URL,
  };
}

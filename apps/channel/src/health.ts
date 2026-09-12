/** @accord/channel — Health check service.
 * Reports process liveness, Slack adapter status, and ApplicationPort readiness.
 * Never leaks environment secrets or tokens.
 */
import type { ApplicationPort } from '@accord/contracts';

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  slack: {
    connected: boolean;
    channelStatus: string;
  };
  store: {
    ready: boolean;
  };
}

export async function getHealthStatus(
  app: ApplicationPort,
  channelStatusFn?: () => { overall: string },
): Promise<HealthReport> {
  const uptimeSeconds = Math.floor(process.uptime());
  const timestamp = new Date().toISOString();

  let storeReady = false;
  try {
    // Probe store / application readiness with empty thread ref
    const view = await app.getThreadView({
      teamId: 'health_check',
      channelId: 'health_check',
      rootTs: '0.0',
    });
    storeReady = view !== undefined;
  } catch {
    storeReady = false;
  }

  const channelStat = channelStatusFn ? channelStatusFn() : { overall: 'unknown' };
  const slackConnected = channelStat.overall === 'online';

  const overall = slackConnected && storeReady ? 'healthy' : storeReady ? 'degraded' : 'unhealthy';

  return {
    status: overall,
    uptimeSeconds,
    timestamp,
    slack: {
      connected: slackConnected,
      channelStatus: channelStat.overall,
    },
    store: {
      ready: storeReady,
    },
  };
}

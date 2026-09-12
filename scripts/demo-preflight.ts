import net from 'node:net';
import { fixedDemoClock, requireDemoMode } from './lib/env.js';

async function tcpProbe(urlValue: string | undefined): Promise<boolean> {
  try {
    if (!urlValue) return false;
    const url = new URL(urlValue); const port = Number(url.port || (url.protocol === 'https:' ? 443 : url.protocol === 'postgres:' ? 5432 : 80));
    await new Promise<void>((resolve, reject) => { const socket = net.createConnection({ host: url.hostname, port }); socket.setTimeout(2_000); socket.once('connect', () => { socket.end(); resolve(); }); socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')); }); socket.once('error', reject); });
    return true;
  } catch { return false; }
}
requireDemoMode(); fixedDemoClock();
const checks = [
  ['ClickHouse endpoint', await tcpProbe(process.env.CLICKHOUSE_URL)],
  ['PostgreSQL endpoint', await tcpProbe(process.env.DATABASE_URL)],
  ['runtime ClickHouse identity configured', Boolean(process.env.CLICKHOUSE_USER && process.env.CLICKHOUSE_PASSWORD)],
  ['admin seed identity configured', Boolean(process.env.ACCORD_CLICKHOUSE_ADMIN_USER && process.env.ACCORD_CLICKHOUSE_ADMIN_PASSWORD)],
  ['immutable dataset configured', Boolean(process.env.ACCORD_DATASET_VERSION)],
  ['GitHub configuration present', Boolean(process.env.GITHUB_TOKEN && process.env.ACCORD_GITHUB_OWNER && process.env.ACCORD_GITHUB_REPO)],
  ['Slack configuration present', Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN && process.env.ACCORD_SLACK_TEAM_ID && process.env.ACCORD_SLACK_CHANNEL_ID)],
  ['Trigger configuration present', Boolean(process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_REF)],
];
for (const [name, ready] of checks) console.log(`${ready ? 'READY' : 'MISSING'}  ${name}`);
if (checks.some(([, ready]) => !ready)) process.exitCode = 1;

import { spawnSync } from 'node:child_process';

const required = ['CLICKHOUSE_URL', 'CLICKHOUSE_DATABASE', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'ACCORD_DATASET_VERSION'];
const missing = required.filter((name) => !process.env[name]);
if (!process.env.ACCORD_TEST_DATABASE_URL && !process.env.DATABASE_URL) missing.push('ACCORD_TEST_DATABASE_URL (or DATABASE_URL)');
if (missing.length > 0) throw new Error(`Integration tests require real PostgreSQL and ClickHouse configuration: ${missing.join(', ')}.`);
for (const command of [
  ['npm', ['run', 'test:pg', '--workspace', '@accord/store']],
  [process.execPath, ['--import', 'tsx', '--test', 'tests/e2e/clickhouse.integration.test.ts', 'tests/e2e/fixture-data.test.ts']],
] as const) {
  const result = spawnSync(command[0], command[1], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

import { spawnSync } from 'node:child_process';

const required = ['DATABASE_URL', 'CLICKHOUSE_URL', 'CLICKHOUSE_DATABASE', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'ACCORD_DATASET_VERSION'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) throw new Error(`Integration tests require real PostgreSQL and ClickHouse configuration: ${missing.join(', ')}.`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/e2e/*.test.ts'], { shell: true, stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exitCode = result.status ?? 1;

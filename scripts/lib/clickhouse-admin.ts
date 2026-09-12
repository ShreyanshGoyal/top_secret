import { required } from './env.js';
export interface AdminClickHouse { query(sql: string): Promise<Record<string, unknown>[]>; insert(table: 'accounts' | 'records', rows: unknown[]): Promise<void>; }
function configuration() {
  const endpoint = new URL(required('CLICKHOUSE_URL'));
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('CLICKHOUSE_URL must be an http(s) URL without embedded credentials.');
  return { endpoint, database: required('CLICKHOUSE_DATABASE'), username: required('ACCORD_CLICKHOUSE_ADMIN_USER'), password: required('ACCORD_CLICKHOUSE_ADMIN_PASSWORD') };
}
async function post(sql: string, body?: string): Promise<string> {
  const config = configuration(); const url = new URL(config.endpoint);
  url.searchParams.set('database', config.database);
  // ClickHouse's HTTP endpoint receives the query followed by FORMAT payload rows in one body.
  // Sending only JSON makes ClickHouse parse the first record as SQL.
  const response = await fetch(url, { method: 'POST', body: body ? `${sql}\n${body}` : sql, headers: { authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`, 'content-type': 'text/plain' } });
  if (!response.ok) throw new Error(`ClickHouse admin request failed with HTTP ${response.status}.`);
  return response.text();
}
export function createAdminClickHouse(): AdminClickHouse {
  return {
    async query(sql) {
      const response = await post(`${sql}\nFORMAT JSONEachRow`);
      return response.trim() ? response.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>) : [];
    },
    async insert(table, rows) {
      if (rows.length === 0) return;
      await post(`INSERT INTO ${table} FORMAT JSONEachRow`, rows.map((row) => JSON.stringify(row)).join('\n'));
    },
  };
}

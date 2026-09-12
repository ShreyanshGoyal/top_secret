import { AccordError, publicError } from '@accord/contracts';
import type { PublicError } from '@accord/contracts';
import type { QueryParameters } from './compiler.js';
import type { ValidImpactConfig } from './config.js';

export interface ClickHouseResponse { queryId: string; row: Record<string, unknown> }
function asParameter(value: string | number | readonly (string | number)[]): string { return Array.isArray(value) ? JSON.stringify(value) : String(value); }
function providerError(status: number): PublicError {
  if (status === 401 || status === 403) return publicError('AUTH', 'ClickHouse rejected the configured read-only identity.');
  if (status === 429) return publicError('RATE_LIMIT', 'ClickHouse rate limited the impact query.');
  return publicError('PROVIDER_ERROR', 'ClickHouse could not complete the impact query.');
}
export async function executeReadOnlyQuery(config: ValidImpactConfig, sql: string, parameters: QueryParameters, queryId: string): Promise<ClickHouseResponse> {
  const url = new URL(config.endpoint);
  url.searchParams.set('database', config.database);
  url.searchParams.set('query_id', queryId);
  // Server-side limits live on the read-only role. Sending per-query settings can be denied by
  // a correctly locked-down identity, so the client only supplies its 15-second abort deadline.
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(`param_${name}`, asParameter(value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { method: 'POST', body: sql, signal: controller.signal, headers: { accept: 'application/json', authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}` } });
    if (!response.ok) throw new AccordError(providerError(response.status));
    const line = (await response.text()).trim().split('\n')[0];
    if (!line) throw new AccordError({ code: 'PROVIDER_ERROR', message: 'ClickHouse returned no aggregate result.', retryable: false });
    let row: unknown;
    try { row = JSON.parse(line); } catch { throw new AccordError({ code: 'PROVIDER_ERROR', message: 'ClickHouse returned an invalid aggregate result.', retryable: false }); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new AccordError({ code: 'PROVIDER_ERROR', message: 'ClickHouse returned an invalid aggregate result.', retryable: false });
    return { queryId, row: row as Record<string, unknown> };
  } catch (error) {
    if (error instanceof AccordError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new AccordError(publicError('TIMEOUT', 'ClickHouse impact query timed out.'));
    throw new AccordError(publicError('PROVIDER_ERROR', 'ClickHouse impact query failed.'));
  } finally { clearTimeout(timer); }
}

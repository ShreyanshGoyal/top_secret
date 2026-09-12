import type { SafeLoggerPort } from '@accord/contracts';
export interface SafeLogSink { write(entry: { level: 'info' | 'error'; event: string; fields: Record<string, string | number | boolean | null> }): void; }
export interface SafeLoggerOptions { component: string; sink?: SafeLogSink; }
const ALLOWED_FIELDS = new Set(['component', 'phase', 'status', 'code', 'retryable', 'durationMs', 'attempt', 'count', 'accounts', 'records', 'decisionId', 'investigationId', 'findingId', 'publicationId', 'queryId', 'threadId', 'teamId', 'channelId', 'eventKey', 'datasetVersion']);
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;
function safeEvent(value: string): string { return /^[a-z][a-z0-9_.-]{0,120}$/i.test(value) ? value : 'invalid_event'; }
function safeFields(component: string, fields: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = { component };
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (typeof value === 'string' && !SAFE_IDENTIFIER.test(value)) continue;
    out[key] = value;
  }
  return out;
}
const consoleSink: SafeLogSink = { write(entry) { console[entry.level](JSON.stringify(entry)); } };
/** Final signature: createSafeLogger({ component, sink? }). */
export function createSafeLogger(options: SafeLoggerOptions): SafeLoggerPort {
  if (!SAFE_IDENTIFIER.test(options.component)) throw new Error('Safe logger component must be a bounded identifier.');
  const sink = options.sink ?? consoleSink;
  const emit = (level: 'info' | 'error', event: string, fields: Record<string, string | number | boolean | null>) => sink.write({ level, event: safeEvent(event), fields: safeFields(options.component, fields) });
  return { info: (event, fields) => emit('info', event, fields), error: (event, fields) => emit('error', event, fields) };
}

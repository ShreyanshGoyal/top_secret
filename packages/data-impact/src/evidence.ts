import { EvidenceSchema, excerptHash, validate } from '@accord/contracts';
import type { Evidence, ImpactRequest } from '@accord/contracts';
import type { CompiledImpactQuery } from './compiler.js';
const MAX_EXCERPT = 1_500;
function bounded(value: string): string { return value.length <= MAX_EXCERPT ? value : `${value.slice(0, MAX_EXCERPT - 14)}\n[TRUNCATED]`; }
export function queryEvidence(input: ImpactRequest, queryId: string, observedAt: string, compiled: CompiledImpactQuery, sanitize: (value: string) => string): Evidence {
  const excerpt = bounded(sanitize(`${compiled.sql}\n-- bound parameters: ${JSON.stringify(compiled.parameters)}`));
  return validate(EvidenceSchema, { id: queryId, kind: 'query', summary: `Restricted aggregate impact query for dataset ${input.run.datasetVersion}.`, locator: `accord-query:${queryId}`, excerpt, excerptHash: excerptHash(excerpt), capturedAt: observedAt, repository: null, commitSha: null, path: null, startLine: null, endLine: null }, 'Impact query evidence');
}

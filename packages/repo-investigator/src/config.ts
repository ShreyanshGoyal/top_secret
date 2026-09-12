/**
 * Repository Investigator Configuration & Hard Limits
 * Frozen limits specified in 04-AGENT-3-REPOSITORY.md
 */
import type { RepositoryConfig, RepositoryId } from '@accord/contracts';

export const REPOSITORY_LIMITS = {
  MAX_ALLOWED_FILES: 20,
  MAX_CONTENT_BYTES: 200 * 1024, // 200 KB total sanitized content
  MAX_SEARCH_HITS_PER_QUERY: 12,
  MAX_REASONING_ROUNDS: 8,
  MAX_EXCERPT_CHARS: 1500,
  MAX_EVIDENCE_ITEMS_PER_REPORT: 20,
} as const;

export const BLOCKED_FILE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /credentials/i,
  /secrets?/i,
  /package-lock\.json$/i,
  /node_modules\//i,
  /\.git\//i,
] as const;

export function isPathBlocked(path: string): boolean {
  return BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(path));
}

export function validateRepositoryConfig(config: RepositoryConfig): void {
  if (!config.repository?.owner || !config.repository?.name) {
    throw new Error('RepositoryConfig: repository owner and name are required');
  }
  if (!config.pathPrefix) {
    throw new Error('RepositoryConfig: pathPrefix is required');
  }
  if (!config.model) {
    throw new Error('RepositoryConfig: model identifier is required');
  }
}

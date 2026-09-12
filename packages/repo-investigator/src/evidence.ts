/**
 * Evidence Management & Redaction
 * Mints schema-valid Evidence instances tied to pinned commit SHAs.
 */
import { randomUUID } from 'node:crypto';
import { excerptHash, normalizeIsoTime } from '@accord/contracts';
import type { Evidence, EvidenceKind, Id, RepositoryId, Sha } from '@accord/contracts';
import { REPOSITORY_LIMITS } from './config.js';

export function redactSensitiveContent(text: string): string {
  return text
    .replace(/(?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{8,})["']?/gi, '$1: [REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_OPENAI_KEY]');
}

export interface MintEvidenceParams {
  kind: EvidenceKind;
  summary: string;
  repository: RepositoryId | null;
  commitSha: Sha | null;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  rawExcerpt: string;
  customLocator?: string;
}

export class EvidenceRegistry {
  private readonly items = new Map<Id, Evidence>();

  mint(params: MintEvidenceParams): Evidence {
    const id = randomUUID();
    const redacted = redactSensitiveContent(params.rawExcerpt);
    const cappedExcerpt = redacted.slice(0, REPOSITORY_LIMITS.MAX_EXCERPT_CHARS);
    const hash = excerptHash(cappedExcerpt);

    let locator = params.customLocator;
    if (!locator) {
      if (params.repository && params.commitSha && params.path) {
        const lineFragment = params.startLine !== null && params.endLine !== null
          ? `#L${params.startLine}-L${params.endLine}`
          : '';
        locator = `https://github.com/${params.repository.owner}/${params.repository.name}/blob/${params.commitSha}/${params.path}${lineFragment}`;
      } else {
        locator = `accord-evidence:${id}`;
      }
    }

    const evidence: Evidence = {
      id,
      kind: params.kind,
      summary: params.summary,
      locator,
      excerpt: cappedExcerpt,
      excerptHash: hash,
      capturedAt: normalizeIsoTime(new Date()),
      repository: params.repository,
      commitSha: params.commitSha,
      path: params.path,
      startLine: params.startLine,
      endLine: params.endLine,
    };

    this.items.set(id, evidence);
    return evidence;
  }

  get(id: Id): Evidence | undefined {
    return this.items.get(id);
  }

  has(id: Id): boolean {
    return this.items.has(id);
  }

  all(): Evidence[] {
    return Array.from(this.items.values()).slice(0, REPOSITORY_LIMITS.MAX_EVIDENCE_ITEMS_PER_REPORT);
  }
}

/**
 * Trace Graph Construction
 * Establishes valid evidence relationships: generates, imports, calls, overrides, tests.
 */
import type { Id, TraceEdge } from '@accord/contracts';
import type { EvidenceRegistry } from './evidence.js';

export class TraceGraph {
  private readonly edges: TraceEdge[] = [];

  constructor(private readonly evidenceRegistry: EvidenceRegistry) {}

  addEdge(edge: TraceEdge): void {
    if (!this.evidenceRegistry.has(edge.fromEvidenceId)) {
      throw new Error(`TraceGraph: fromEvidenceId not found: ${edge.fromEvidenceId}`);
    }
    if (!this.evidenceRegistry.has(edge.toEvidenceId)) {
      throw new Error(`TraceGraph: toEvidenceId not found: ${edge.toEvidenceId}`);
    }
    this.edges.push(edge);
  }

  all(): TraceEdge[] {
    return [...this.edges];
  }
}

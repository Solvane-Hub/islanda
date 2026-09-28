import type {
  CommercialPublicationEligibility,
  KnowledgePackStatus,
  ValidationOutcome,
} from '@/types/knowledge';
import { mayPublish } from '@/services/knowledge/validation';

/**
 * K7 staged publishing.
 *
 * Publication is the last point at which Islanda can decide not to say
 * something, so every gate here refuses rather than warns.
 */

/**
 * K7 §4 state machine.
 *
 * `published → rolled_back` exists as its own edge rather than reusing
 * `superseded`: succession and withdrawal look identical in the data otherwise,
 * and only one of them means something went wrong.
 */
const ALLOWED_TRANSITIONS: Record<KnowledgePackStatus, readonly KnowledgePackStatus[]> = {
  draft: ['validating'],
  validating: ['staged', 'draft'],
  staged: ['published', 'draft'],
  published: ['superseded', 'rolled_back'],
  // Terminal. History is preserved, never reopened (K7 §4.3, §10).
  superseded: [],
  rolled_back: [],
};

export function canTransitionPack(from: KnowledgePackStatus, to: KnowledgePackStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class PublicationError extends Error {
  readonly reasons: readonly string[];
  constructor(message: string, reasons: readonly string[] = []) {
    super(message);
    this.name = 'PublicationError';
    this.reasons = reasons;
  }
}

export function assertPackTransition(from: KnowledgePackStatus, to: KnowledgePackStatus): void {
  if (!canTransitionPack(from, to)) {
    throw new PublicationError(`K7 §4: illegal Knowledge Pack transition ${from} -> ${to}`);
  }
}

/**
 * G11 — a pack may only be PUBLISHED once cleared for commercial reuse.
 *
 * Application-level mirror of the guard in `publish_knowledge_pack` (the RPC is
 * authoritative and cannot be bypassed by any client; this gives callers a clear
 * typed error before they reach the database). Ingestion, validation and staging
 * are deliberately NOT gated — only publication/redistribution is.
 */
export function assertCommercialPublicationCleared(
  eligibility: CommercialPublicationEligibility,
): void {
  if (eligibility !== 'cleared') {
    throw new PublicationError(
      `G11: this Knowledge Pack is not cleared for commercial publication (eligibility: ${eligibility}). ` +
        'Record the required reuse permission before publishing. Staging for internal review is permitted.',
    );
  }
}

/** One source's readiness, as seen by the K7 §6 gate. */
export interface SourceReadiness {
  sourceId: string;
  outcome: ValidationOutcome;
  chunkCount: number;
  chunksMissingIdentity: number;
  chunksMissingProvenance: number;
}

export interface QualityGateReport {
  passed: boolean;
  failures: string[];
  totalChunks: number;
}

/**
 * K7 §6 quality gate.
 *
 * Runs before staging. It does not warn — a failure stops publication, because
 * the alternative is shipping a citation a founder cannot verify.
 */
export function runQualityGate(sources: readonly SourceReadiness[]): QualityGateReport {
  const failures: string[] = [];
  let totalChunks = 0;

  if (sources.length === 0) {
    failures.push('K7 §6: a Knowledge Pack must contain at least one validated source.');
  }

  for (const s of sources) {
    totalChunks += s.chunkCount;

    if (!mayPublish(s.outcome)) {
      failures.push(`K7 §6: source ${s.sourceId} has validation outcome '${s.outcome}'.`);
    }
    if (s.chunkCount === 0) {
      failures.push(`K7 §6: source ${s.sourceId} produced no chunks.`);
    }
    if (s.chunksMissingIdentity > 0) {
      failures.push(
        `K5 §3.10: source ${s.sourceId} has ${s.chunksMissingIdentity} chunk(s) without a chunk_id.`,
      );
    }
    if (s.chunksMissingProvenance > 0) {
      failures.push(
        `K4 §6: source ${s.sourceId} has ${s.chunksMissingProvenance} chunk(s) without citation provenance.`,
      );
    }
  }

  return { passed: failures.length === 0, failures, totalChunks };
}

/**
 * K7 §3.1 — regenerating embeddings does NOT increment the Knowledge Pack
 * version. The knowledge did not change; only the index over it did.
 *
 * Encoded as a function because it is the rule most likely to be violated by
 * someone doing the obvious thing after swapping the embedding model.
 */
export function embeddingRebuildRequiresNewPackVersion(): false {
  return false;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import { registerSourceSchema } from '@/lib/validation/knowledge';
import { contentHash } from '@/lib/knowledge/chunk-id';
import { findPackById } from '@/lib/db/knowledge/packs';
import { insertSource, insertValidationRecord } from '@/lib/db/knowledge/sources';
import { upsertChunks } from '@/lib/db/knowledge/chunks';
import { prepareChunks } from '@/services/knowledge/chunking';
import { validateSource } from '@/services/knowledge/validation';
import type { KnowledgeSource, ValidationOutcome } from '@/types/knowledge';

/**
 * Knowledge ingestion Application Service — ADR-0001 (all writes live here).
 *
 * Boundaries this service must not cross, each for a documented reason:
 *   • It never publishes.               K7 §9 requires explicit human approval.
 *   • It never assigns claim-level trust. ADR-0015 — derived, never assigned.
 *   • It never produces founder-facing requirements. That is AI-2's job.
 *   • It never bypasses validation.     K2 gates entry to the pipeline.
 *   • It never silently overwrites.     A published pack is immutable (K7 §4.3).
 *
 * ADR-0016: in production each call is one step of a persisted workflow run.
 * Every operation here is idempotent, because retries are normal operation.
 */

export interface IngestSourceInput {
  registration: unknown;
  /** Deterministic intermediate representation — the parsed, ordered chunks. */
  drafts: readonly unknown[];
  rawContent?: string;
  validator: string;
}

export interface IngestSourceResult {
  source: KnowledgeSource;
  chunkIds: string[];
  /**
   * Typed, not `string`. A caller feeding this into the K7 §6 quality gate must
   * not have to cast, because a cast is where a wrong outcome would be laundered
   * into an acceptable one.
   */
  validationOutcome: ValidationOutcome;
  correlationId: string;
}

export async function ingestSource(
  db: SupabaseClient<Database>,
  input: IngestSourceInput,
): Promise<IngestSourceResult> {
  const correlationId = newCorrelationId();

  const parsed = registerSourceSchema.safeParse(input.registration);
  if (!parsed.success) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'This source could not be registered.',
      developerMessage: `K1/K4 source registration failed: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      correlationId,
    });
  }
  const reg = parsed.data;

  const pack = await findPackById(db, reg.knowledgePackId);
  if (!pack) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'That Knowledge Pack could not be found.',
      developerMessage: `Knowledge Pack ${reg.knowledgePackId} does not exist.`,
      correlationId,
    });
  }

  // K7 §4.3. Refused here as well as by the database trigger: the caller
  // deserves an explanation, not a constraint violation.
  if (
    pack.status === 'published' ||
    pack.status === 'superseded' ||
    pack.status === 'rolled_back'
  ) {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'This Knowledge Pack version is closed. Corrections go into a new version.',
      developerMessage: `K7 §4.3: cannot ingest into a pack with status '${pack.status}'. Published versions are immutable.`,
      correlationId,
    });
  }

  // K2 §6 — validate BEFORE persisting. Structural facts come from the drafts,
  // so an empty parse is caught here rather than surfacing as an empty pack.
  const totalBodyLength = input.drafts.reduce<number>((sum, d) => {
    const body = (d as { body?: unknown }).body;
    return sum + (typeof body === 'string' ? body.trim().length : 0);
  }, 0);
  const anySectionReference = input.drafts.some(
    (d) => typeof (d as { sectionReference?: unknown }).sectionReference === 'string',
  );

  const validation = validateSource({
    agency: reg.agency,
    title: reg.title,
    sourceUrl: reg.sourceUrl ?? null,
    sourceAuthority: reg.sourceAuthority,
    legalSourceCategory: reg.legalSourceCategory,
    publicationDate: reg.publicationDate ?? null,
    lastReviewedDate: reg.lastReviewedDate ?? null,
    sectionReferencePresent: anySectionReference,
    bodyLength: totalBodyLength,
  });

  if (validation.outcome === 'rejected') {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'This source cannot be added to the Knowledge Pack.',
      developerMessage: `K2 §9 rejected: ${validation.failureReasons.join(' ')}`,
      correlationId,
    });
  }

  const { data: source, error: sourceError } = await insertSource(db, {
    knowledge_pack_id: reg.knowledgePackId,
    // The stable key the amendment chain resolves through — never source_url.
    manifest_id: reg.manifestId,
    agency: reg.agency,
    title: reg.title,
    source_url: reg.sourceUrl ?? null,
    source_type: reg.sourceType,
    country_code: reg.countryCode,
    region: reg.region ?? null,
    municipality: reg.municipality ?? null,
    source_authority: reg.sourceAuthority,
    legal_source_category: reg.legalSourceCategory,
    // Explicit, never defaulted. A source whose standing has not been
    // established must not enter the pack asserting that it is current.
    freshness_state: reg.freshnessState,
    // Explicit legal standing. enacted_not_in_force / unresolved are kept out of
    // current-law retrieval downstream.
    legal_status: reg.legalStatus,
    publication_date: reg.publicationDate ?? null,
    effective_date: reg.effectiveDate ?? null,
    expiry_date: reg.expiryDate ?? null,
    last_reviewed_date: reg.lastReviewedDate ?? null,
    accessed_at: reg.accessedAt ?? null,
    content_hash: input.rawContent ? contentHash(input.rawContent) : null,
    content_media_type: reg.contentMediaType ?? null,
  });

  if (sourceError || !source) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'This source could not be saved.',
      developerMessage: `insertSource failed: ${sourceError ?? 'no row returned'}`,
      correlationId,
    });
  }

  // K2 §4.7 — the validation record is permanent and append-only.
  await insertValidationRecord(db, {
    knowledge_source_id: source.id,
    outcome: validation.outcome,
    source_valid: validation.checks.sourceValid,
    structure_valid: validation.checks.structureValid,
    metadata_valid: validation.checks.metadataValid,
    provenance_valid: validation.checks.provenanceValid,
    classification_valid: validation.checks.classificationValid,
    validator: input.validator,
    reviewer_notes: null,
    failure_reasons: validation.failureReasons,
  });

  const prepared = prepareChunks({
    source,
    knowledgeVersion: pack.version,
    drafts: input.drafts,
  });

  const { error: chunkError } = await upsertChunks(db, prepared);
  if (chunkError) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'This source could not be prepared for retrieval.',
      developerMessage: `upsertChunks failed: ${chunkError}`,
      correlationId,
    });
  }

  return {
    source,
    chunkIds: prepared.map((c) => c.chunk_id),
    validationOutcome: validation.outcome,
    correlationId,
  };
}

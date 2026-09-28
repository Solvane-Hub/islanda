import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessDocument, BusinessDocumentType } from '@/types/business-intelligence';
import type { FactProvenance, VerificationState } from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  insertBusinessEvidence,
  insertEvidenceForMetric,
  listBusinessEvidenceByIds,
  listEvidenceForMetricsByBusiness,
} from '@/lib/db/evidence';
import { findMetricById } from '@/lib/db/financials';
import { findBusinessDocumentById } from '@/lib/db/business-documents';
import { getBusinessDocuments } from '@/services/documents';
import type { RequestContext } from '@/services/auth';

/**
 * Evidence Application Service (P8 activation — ADR-0022, post-competition
 * Milestone 3). The first real capability built on the P8 evidence
 * foundation: explicitly linking a private business document to a financial
 * metric as its evidence.
 *
 * ⚠ Evidence here means "this metric has been explicitly linked to this
 *   document" — nothing more. There is no document extraction in this
 *   product yet, so this service never reads, quotes, or claims to have read
 *   a document's contents. `provenance` is always `user_document` (the exact
 *   value `resolveMetricEntry` already uses for a metric that names a
 *   supporting document at creation time — this activates the same honest
 *   vocabulary for a link made after the fact) and `verification_state` is
 *   left at its DB default (`unverified`); nothing here invents verification.
 *
 * Every write is business-scoped twice over: RLS enforces it at the database
 * (`app.business_access` on both `business_evidence` and
 * `business_evidence_for_metrics`), and this service independently verifies
 * the metric and the document both belong to the SAME, server-resolved
 * business before ever attempting the insert — a client-supplied business
 * relationship is never trusted on its own. All writes go through the
 * caller's own RLS-scoped client; nothing here uses the service-role client
 * to bypass tenant authorization. `actor_id` is always the authenticated
 * server-side user id (`ownerId`, resolved the same way every other write
 * path in this codebase resolves it) — never a client-supplied value.
 */

export interface AttachMetricEvidenceInput {
  businessId: string;
  metricId: string;
  documentId: string;
}

export interface MetricEvidenceView {
  /** The `business_evidence_for_metrics` link row id. */
  linkId: string;
  /** The `business_evidence` row id it points to. */
  evidenceId: string;
  documentId: string;
  documentTitle: string;
  documentType: BusinessDocumentType;
  provenance: FactProvenance;
  verificationState: VerificationState;
  createdAt: string;
}

/**
 * Attach an existing business document to an existing metric as evidence.
 *
 * Creates one `business_evidence` row (the canonical evidence entity,
 * exclusive-arc over document_id/knowledge_chunk_id — this call always sets
 * document_id, never knowledge_chunk_id) and one `business_evidence_for_metrics`
 * link row (relationship `supports`: the document backs the figure; nothing
 * claims the figure was mechanically derived from it, since no extraction
 * pipeline produced it).
 */
export async function attachMetricEvidence(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: AttachMetricEvidenceInput,
  ctx: RequestContext = {},
): Promise<MetricEvidenceView> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  // Verify both sides belong to the SAME, server-resolved business. RLS would
  // already return null for a foreign row, but a client-supplied relationship
  // between two rows this session genuinely owns (a metric from business A, a
  // document also from business A but not the CURRENT business if the founder
  // has more than one) must never be assumed correct without checking.
  const [metric, document] = await Promise.all([
    findMetricById(db, input.metricId),
    findBusinessDocumentById(db, input.documentId),
  ]);

  if (!metric || metric.business_id !== input.businessId) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that metric.',
      correlationId,
    });
  }
  if (!document || document.business_id !== input.businessId) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that document.',
      correlationId,
    });
  }

  const { data: evidence, error: evidenceError } = await insertBusinessEvidence(db, {
    business_id: input.businessId,
    document_id: input.documentId,
    provenance: 'user_document',
    actor_id: ownerId,
  });
  if (evidenceError || !evidence) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not attach that document. Please try again.',
      developerMessage: evidenceError ?? 'insert returned no row',
      correlationId,
    });
  }

  const { data: link, error: linkError } = await insertEvidenceForMetric(db, {
    business_id: input.businessId,
    evidence_id: evidence.id,
    metric_id: input.metricId,
    relationship: 'supports',
    actor_id: ownerId,
  });
  if (linkError || !link) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not attach that document. Please try again.',
      developerMessage: linkError ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.evidence_attached',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — which KIND of subject and document, never titles or values.
    metadata: { subject: 'metric', document_type: document.document_type },
  });

  return {
    linkId: link.id,
    evidenceId: evidence.id,
    documentId: document.id,
    documentTitle: document.title,
    documentType: document.document_type,
    provenance: evidence.provenance,
    verificationState: evidence.verification_state,
    createdAt: link.created_at,
  };
}

/** Evidence for one metric, newest first. */
export async function getMetricEvidence(
  db: SupabaseClient<Database>,
  businessId: string,
  metricId: string,
): Promise<MetricEvidenceView[]> {
  const map = await getEvidenceForMetrics(db, businessId, [metricId]);
  return map[metricId] ?? [];
}

/**
 * Evidence for a set of metrics in one business, keyed by metric id. Three
 * plain, business-scoped queries rather than a nested PostgREST embed across
 * the two composite foreign keys — simpler to read and to keep correct than
 * relying on how the client library resolves a multi-hop embed, and cheap at
 * the volumes this product has today.
 *
 * `prefetchedDocuments` is optional: a caller that already holds this
 * business's documents (Business Passport composes documents and evidence
 * from the same data) can pass them in to avoid fetching `business_documents`
 * a second time. Every existing caller omits it and gets the exact same
 * fetch-then-join behavior as before.
 */
export async function getEvidenceForMetrics(
  db: SupabaseClient<Database>,
  businessId: string,
  metricIds: readonly string[],
  prefetchedDocuments?: readonly BusinessDocument[],
): Promise<Record<string, MetricEvidenceView[]>> {
  if (metricIds.length === 0) return {};

  const links = (await listEvidenceForMetricsByBusiness(db, businessId)).filter((l) =>
    metricIds.includes(l.metric_id),
  );
  if (links.length === 0) return {};

  const evidenceRows = await listBusinessEvidenceByIds(
    db,
    businessId,
    links.map((l) => l.evidence_id),
  );
  const evidenceById = new Map(evidenceRows.map((e) => [e.id, e]));

  const documentIds = [
    ...new Set(evidenceRows.map((e) => e.document_id).filter((id): id is string => id !== null)),
  ];
  const allDocs = prefetchedDocuments ?? (await getBusinessDocuments(db, businessId));
  const documentById = new Map(
    allDocs.filter((d) => documentIds.includes(d.id)).map((d) => [d.id, d]),
  );

  const byMetric: Record<string, MetricEvidenceView[]> = {};
  for (const link of links) {
    const evidence = evidenceById.get(link.evidence_id);
    if (!evidence || !evidence.document_id) continue; // exclusive-arc: skip non-document evidence
    const document = documentById.get(evidence.document_id);
    if (!document) continue;

    const view: MetricEvidenceView = {
      linkId: link.id,
      evidenceId: evidence.id,
      documentId: document.id,
      documentTitle: document.title,
      documentType: document.document_type,
      provenance: evidence.provenance,
      verificationState: evidence.verification_state,
      createdAt: link.created_at,
    };
    (byMetric[link.metric_id] ??= []).push(view);
  }
  return byMetric;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { BusinessDocument, BusinessDocumentType } from '@/types/business-intelligence';
import type { FactProvenance } from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  insertBusinessDocument,
  listBusinessDocuments,
  findBusinessDocumentById,
} from '@/lib/db/business-documents';
import type { RequestContext } from '@/services/auth';

/**
 * Business Document Application Service — the secure vault's write path.
 *
 * This registers a document RECORD. It does not itself move bytes into storage
 * (a Storage bucket + signed-upload flow is the next build) and it never claims
 * a document has been read: `extraction_status` stays `not_started` until real
 * extraction runs. Ownership is enforced by RLS; documents never cross business
 * boundaries. Audit metadata carries the document TYPE only.
 */

export interface AddBusinessDocumentInput {
  businessId: string;
  documentType: BusinessDocumentType;
  title: string;
  financialPeriodId?: string | null;
  documentDate?: string | null;
  expirationDate?: string | null;
  /** Reference to the object in secure storage. Never a public URL. */
  storagePath?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  provenance?: FactProvenance;
  metadata?: Record<string, Json>;
}

export async function addBusinessDocument(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: AddBusinessDocumentInput,
  ctx: RequestContext = {},
): Promise<BusinessDocument> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await insertBusinessDocument(db, {
    business_id: input.businessId,
    document_type: input.documentType,
    title: input.title,
    financial_period_id: input.financialPeriodId ?? null,
    document_date: input.documentDate ?? null,
    expiration_date: input.expirationDate ?? null,
    storage_path: input.storagePath ?? null,
    content_type: input.contentType ?? null,
    byte_size: input.byteSize ?? null,
    provenance: input.provenance ?? 'founder_provided',
    ...(input.metadata ? { metadata: input.metadata as Json } : {}),
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that document. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.document_added',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — the document TYPE, never its title or contents.
    metadata: { document_type: input.documentType },
  });

  return data;
}

/** Read accessors (ADR-0001). */
export async function getBusinessDocuments(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessDocument[]> {
  return listBusinessDocuments(db, businessId);
}

export async function getBusinessDocument(
  db: SupabaseClient<Database>,
  documentId: string,
): Promise<BusinessDocument | null> {
  return findBusinessDocumentById(db, documentId);
}

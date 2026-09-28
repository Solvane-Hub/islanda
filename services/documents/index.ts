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
  updateBusinessDocument,
} from '@/lib/db/business-documents';
import type { RequestContext } from '@/services/auth';

/** The private bucket that backs `business_documents`. Never public. */
export const BUSINESS_DOCUMENTS_BUCKET = 'business-documents';

/** A safe object filename — no path separators, restricted charset, bounded. */
function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'document';
}

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
    actor_id: ownerId,
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

export interface BeginDocumentUploadInput {
  businessId: string;
  documentType: BusinessDocumentType;
  title: string;
  filename: string;
  financialPeriodId?: string | null;
  documentDate?: string | null;
  expirationDate?: string | null;
}

export interface DocumentUploadTicket {
  documentId: string;
  bucket: string;
  /** `<business_id>/<document_id>/<filename>` — the object path in the bucket. */
  path: string;
  /** Single-use signed-upload token; the browser uploads with `uploadToSignedUrl`. */
  token: string;
}

/**
 * Begin a secure upload.
 *
 * Creates the document record (pending, no bytes yet), records its storage path,
 * and mints a single-use signed upload URL — all through the RLS-scoped client,
 * so ownership of the path's business is enforced by the storage policy. The
 * browser then uploads the bytes directly to the signed URL and calls
 * `markDocumentStored`. The bucket is private; no public URL is ever produced.
 */
export async function beginDocumentUpload(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: BeginDocumentUploadInput,
  ctx: RequestContext = {},
): Promise<DocumentUploadTicket> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data: row, error } = await insertBusinessDocument(db, {
    business_id: input.businessId,
    actor_id: ownerId,
    document_type: input.documentType,
    title: input.title,
    financial_period_id: input.financialPeriodId ?? null,
    document_date: input.documentDate ?? null,
    expiration_date: input.expirationDate ?? null,
    // The founder provided this document. Any facts EXTRACTED from it later are
    // recorded separately as `user_document` provenance on metrics.
    provenance: 'founder_provided',
  });
  if (error || !row) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not start that upload. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  const path = `${input.businessId}/${row.id}/${safeFilename(input.filename)}`;
  await updateBusinessDocument(db, row.id, { storage_path: path });

  const signed = await db.storage.from(BUSINESS_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not prepare secure storage for that document. Please try again.',
      developerMessage: signed.error?.message ?? 'no signed upload url',
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
    metadata: { document_type: input.documentType },
  });

  return {
    documentId: row.id,
    bucket: BUSINESS_DOCUMENTS_BUCKET,
    path,
    token: signed.data.token,
  };
}

/**
 * Confirm the bytes landed. Marks the document `stored` and records the real
 * content type and size. It does NOT set `extraction_status` — no extraction has
 * run, and the UI must keep saying "stored, analysis not yet available".
 */
export async function markDocumentStored(
  db: SupabaseClient<Database>,
  _ownerId: string,
  documentId: string,
  meta: { contentType?: string | null; byteSize?: number | null },
  ctx: RequestContext = {},
): Promise<BusinessDocument> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const existing = await findBusinessDocumentById(db, documentId);
  if (!existing) {
    // RLS filtered a foreign document out — same response as "does not exist".
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that document.',
      correlationId,
    });
  }

  const { data, error } = await updateBusinessDocument(db, documentId, {
    processing_status: 'stored',
    content_type: meta.contentType ?? existing.content_type,
    byte_size: meta.byteSize ?? existing.byte_size,
  });
  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not finish saving that document. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }
  return data;
}

/**
 * A short-lived signed URL to view one's own document.
 *
 * Ownership is enforced by RLS on the lookup AND by the storage select policy on
 * the signed-URL mint. Returns null when the document has no stored object or is
 * not the caller's — never a public URL, never another business's file.
 */
export async function getDocumentDownloadUrl(
  db: SupabaseClient<Database>,
  documentId: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const doc = await findBusinessDocumentById(db, documentId);
  if (!doc || !doc.storage_path) return null;
  const { data, error } = await db.storage
    .from(BUSINESS_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
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

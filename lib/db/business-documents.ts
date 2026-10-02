import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessDocument } from '@/types/business-intelligence';

/**
 * Business document repository — the only place document rows are queried.
 * RLS scopes every result to the owner via `app.business_access`.
 *
 * ⚠ Rows reference SENSITIVE business records. `storage_path` is a reference to
 *   secure storage, never the file contents and never a public URL.
 */

type Db = SupabaseClient<Database>;
type DocumentInsert = Database['public']['Tables']['business_documents']['Insert'];

export async function insertBusinessDocument(
  db: Db,
  values: DocumentInsert,
): Promise<{ data: BusinessDocument | null; error: string | null }> {
  const { data, error } = await db.from('business_documents').insert(values).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listBusinessDocuments(
  db: Db,
  businessId: string,
): Promise<BusinessDocument[]> {
  const { data } = await db
    .from('business_documents')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function findBusinessDocumentById(
  db: Db,
  documentId: string,
): Promise<BusinessDocument | null> {
  const { data } = await db
    .from('business_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();
  return data ?? null;
}

type DocumentUpdate = Database['public']['Tables']['business_documents']['Update'];

export async function updateBusinessDocument(
  db: Db,
  documentId: string,
  patch: Pick<
    DocumentUpdate,
    'storage_path' | 'content_type' | 'byte_size' | 'processing_status' | 'extraction_status'
  >,
): Promise<{ data: BusinessDocument | null; error: string | null }> {
  const { data, error } = await db
    .from('business_documents')
    .update(patch)
    .eq('id', documentId)
    .select('*')
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

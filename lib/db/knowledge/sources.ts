import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeSource, SourceAuthority, ValidationOutcome } from '@/types/knowledge';

type Db = SupabaseClient<Database>;

export interface InsertSourceValues {
  knowledge_pack_id: string;
  /**
   * MANDATORY. The stable key the amendment chain resolves through. Matching on
   * `source_url` meant a changed government URL silently detached a source from
   * its amendments, and a broken join looked exactly like "no amendments exist".
   */
  manifest_id: string;
  agency: string;
  title: string;
  source_url: string | null;
  source_type: KnowledgeSource['source_type'];
  country_code: string;
  region: string | null;
  municipality: string | null;
  source_authority: SourceAuthority;
  legal_source_category: KnowledgeSource['legal_source_category'];
  /**
   * MANDATORY. The column's database default was dropped in
   * 20260823000000_knowledge_freshness_explicit.sql, so an omitted value is a
   * write error rather than a silent claim of currency.
   */
  freshness_state: KnowledgeSource['freshness_state'];
  /**
   * MANDATORY. Verified legal standing. Never defaulted at the application layer:
   * a source whose standing has not been established must say so ('unresolved')
   * rather than be presented as current law.
   */
  legal_status: KnowledgeSource['legal_status'];
  publication_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  last_reviewed_date: string | null;
  accessed_at: string | null;
  content_hash: string | null;
  content_media_type: string | null;
}

export async function insertSource(
  db: Db,
  values: InsertSourceValues,
): Promise<{ data: KnowledgeSource | null; error: string | null }> {
  const { data, error } = await db.from('knowledge_sources').insert(values).select('*').single();
  return { data: (data as KnowledgeSource | null) ?? null, error: error?.message ?? null };
}

export async function findSourceById(db: Db, id: string): Promise<KnowledgeSource | null> {
  const { data } = await db.from('knowledge_sources').select('*').eq('id', id).maybeSingle();
  return (data as KnowledgeSource | null) ?? null;
}

export async function listSourcesForPack(db: Db, packId: string): Promise<KnowledgeSource[]> {
  const { data } = await db
    .from('knowledge_sources')
    .select('*')
    .eq('knowledge_pack_id', packId)
    .order('created_at', { ascending: true });
  return (data as KnowledgeSource[] | null) ?? [];
}

/** Append-only — revalidation adds a row, it never overwrites one (K2 §4.7). */
/**
 * The most recent validation outcome recorded for a source.
 *
 * Needed by any pipeline step that resumes work it did not itself perform. The
 * alternative — assuming a previously registered source validated — would put
 * an assumption inside the K7 §6 gate, and a gate fed by assumptions checks
 * nothing.
 */
export async function latestValidationOutcome(
  db: Db,
  sourceId: string,
): Promise<ValidationOutcome | null> {
  const { data } = await db
    .from('knowledge_source_validations')
    .select('outcome')
    .eq('knowledge_source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.outcome as ValidationOutcome | undefined) ?? null;
}

export async function insertValidationRecord(
  db: Db,
  values: {
    knowledge_source_id: string;
    outcome: ValidationOutcome;
    source_valid: boolean;
    structure_valid: boolean;
    metadata_valid: boolean;
    provenance_valid: boolean;
    classification_valid: boolean;
    validator: string;
    reviewer_notes: string | null;
    failure_reasons: string[];
  },
): Promise<{ error: string | null }> {
  const { error } = await db.from('knowledge_source_validations').insert(values);
  return { error: error?.message ?? null };
}

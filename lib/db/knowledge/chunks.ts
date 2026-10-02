import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, SourceAuthority } from '@/types/knowledge';

type Db = SupabaseClient<Database>;

/**
 * Chunk repository — K3.
 *
 * ⚠ The insert shape carries Source Authority and provenance only. There is no
 * column, and no field here, for Evidence Strength, Reasoning Confidence, Trust
 * Level or Trust Score (K3 §5.1).
 */
export interface InsertChunkValues {
  chunk_id: string;
  knowledge_source_id: string;
  knowledge_pack_id: string;
  chunk_index: number;
  title: string | null;
  body: string;
  content_hash: string;
  country_code: string;
  section_reference: string | null;
  clause: string | null;
  page: number | null;
  source_authority: SourceAuthority;
  legal_source_category: KnowledgeChunk['legal_source_category'];
  industry: string | null;
  regulatory_domain: string | null;
  keywords: string[];
  effective_date: string | null;
  /** Substantive text ranks ahead of an edit instruction. Never defaulted here. */
  instrument_role: Exclude<KnowledgeChunk['instrument_role'], 'unknown'>;
  /** Canonical id of the provision this chunk is. Null when unparseable. */
  provision_id: string | null;
  /** Canonical id of the provision this chunk edits. Amending instructions only. */
  amends_provision: string | null;
}

/**
 * Upsert on `chunk_id`.
 *
 * Upsert rather than insert because `chunk_id` is deterministic and retries are
 * normal operation under ADR-0016 — re-running a chunking step must converge,
 * not collide. The database still refuses the write if the pack is published.
 */
export async function upsertChunks(
  db: Db,
  values: readonly InsertChunkValues[],
): Promise<{ inserted: number; error: string | null }> {
  if (values.length === 0) return { inserted: 0, error: null };
  const { data, error } = await db
    .from('knowledge_chunks')
    .upsert(values as InsertChunkValues[], { onConflict: 'chunk_id' })
    .select('chunk_id');
  return { inserted: data?.length ?? 0, error: error?.message ?? null };
}

export async function findChunkById(db: Db, chunkId: string): Promise<KnowledgeChunk | null> {
  const { data } = await db
    .from('knowledge_chunks')
    .select('*')
    .eq('chunk_id', chunkId)
    .maybeSingle();
  return (data as KnowledgeChunk | null) ?? null;
}

export async function listChunksForPack(db: Db, packId: string): Promise<KnowledgeChunk[]> {
  const { data } = await db
    .from('knowledge_chunks')
    .select('*')
    .eq('knowledge_pack_id', packId)
    .order('chunk_index', { ascending: true });
  return (data as KnowledgeChunk[] | null) ?? [];
}

export async function countChunksForPack(db: Db, packId: string): Promise<number> {
  const { count } = await db
    .from('knowledge_chunks')
    .select('chunk_id', { count: 'exact', head: true })
    .eq('knowledge_pack_id', packId);
  return count ?? 0;
}

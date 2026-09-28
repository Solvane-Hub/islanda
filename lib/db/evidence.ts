import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessEvidence, BusinessEvidenceForMetric } from '@/types/evidence';

/**
 * Evidence repository (P8 — ADR-0022). The only place `business_evidence` and
 * `business_evidence_for_metrics` rows are queried. Every call uses the
 * request-scoped client, so RLS scopes results to the caller through
 * `app.business_access`. Neither table has an UPDATE or DELETE policy — a
 * link, once made, is immutable (retraction is a documented future concern,
 * not this milestone's).
 */

type Db = SupabaseClient<Database>;
type EvidenceInsert = Database['public']['Tables']['business_evidence']['Insert'];
type EvidenceForMetricInsert =
  Database['public']['Tables']['business_evidence_for_metrics']['Insert'];

export async function insertBusinessEvidence(
  db: Db,
  values: EvidenceInsert,
): Promise<{ data: BusinessEvidence | null; error: string | null }> {
  const { data, error } = await db.from('business_evidence').insert(values).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function insertEvidenceForMetric(
  db: Db,
  values: EvidenceForMetricInsert,
): Promise<{ data: BusinessEvidenceForMetric | null; error: string | null }> {
  const { data, error } = await db
    .from('business_evidence_for_metrics')
    .insert(values)
    .select('*')
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

/** Every metric↔evidence link for a business, newest first. */
export async function listEvidenceForMetricsByBusiness(
  db: Db,
  businessId: string,
): Promise<BusinessEvidenceForMetric[]> {
  const { data } = await db
    .from('business_evidence_for_metrics')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

/** The evidence rows behind a set of ids, scoped to one business. */
export async function listBusinessEvidenceByIds(
  db: Db,
  businessId: string,
  evidenceIds: readonly string[],
): Promise<BusinessEvidence[]> {
  if (evidenceIds.length === 0) return [];
  const { data } = await db
    .from('business_evidence')
    .select('*')
    .eq('business_id', businessId)
    .in('id', evidenceIds);
  return data ?? [];
}

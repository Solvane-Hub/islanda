import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessCase, BusinessCaseStatus } from '@/types/business-case';

/**
 * Business case repository — the only place case rows are queried. RLS scopes
 * every result to the owner via `app.business_access`.
 */

type Db = SupabaseClient<Database>;
type CaseInsert = Database['public']['Tables']['business_cases']['Insert'];

export async function insertBusinessCase(
  db: Db,
  values: CaseInsert,
): Promise<{ data: BusinessCase | null; error: string | null }> {
  const { data, error } = await db.from('business_cases').insert(values).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listBusinessCases(db: Db, businessId: string): Promise<BusinessCase[]> {
  const { data } = await db
    .from('business_cases')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function findBusinessCaseById(db: Db, caseId: string): Promise<BusinessCase | null> {
  const { data } = await db.from('business_cases').select('*').eq('id', caseId).maybeSingle();
  return data ?? null;
}

export async function updateBusinessCase(
  db: Db,
  caseId: string,
  patch: { status?: BusinessCaseStatus },
): Promise<{ data: BusinessCase | null; error: string | null }> {
  const { data, error } = await db
    .from('business_cases')
    .update(patch)
    .eq('id', caseId)
    .select('*')
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

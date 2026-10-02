import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessGoal, BusinessGoalStatus } from '@/types/business-intelligence';

/**
 * Business goal repository — the only place goal rows are queried. RLS scopes
 * every result to the owner via `app.business_access`.
 */

type Db = SupabaseClient<Database>;
type GoalInsert = Database['public']['Tables']['business_goals']['Insert'];

export async function insertBusinessGoal(
  db: Db,
  values: GoalInsert,
): Promise<{ data: BusinessGoal | null; error: string | null }> {
  const { data, error } = await db.from('business_goals').insert(values).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listBusinessGoals(db: Db, businessId: string): Promise<BusinessGoal[]> {
  const { data } = await db
    .from('business_goals')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function findBusinessGoalById(db: Db, goalId: string): Promise<BusinessGoal | null> {
  const { data } = await db.from('business_goals').select('*').eq('id', goalId).maybeSingle();
  return data ?? null;
}

export async function updateBusinessGoal(
  db: Db,
  goalId: string,
  patch: { status?: BusinessGoalStatus },
): Promise<{ data: BusinessGoal | null; error: string | null }> {
  const { data, error } = await db
    .from('business_goals')
    .update(patch)
    .eq('id', goalId)
    .select('*')
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

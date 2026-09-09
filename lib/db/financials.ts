import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessFinancialPeriod, BusinessMetric } from '@/types/business-intelligence';

/**
 * Financial repository — the only place financial-period and metric queries are
 * written. Every call uses the request-scoped client, so RLS scopes results to
 * the caller through `app.business_access`.
 */

type Db = SupabaseClient<Database>;
type PeriodInsert = Database['public']['Tables']['business_financial_periods']['Insert'];
type MetricInsert = Database['public']['Tables']['business_metrics']['Insert'];

export async function insertFinancialPeriod(
  db: Db,
  values: PeriodInsert,
): Promise<{ data: BusinessFinancialPeriod | null; error: string | null }> {
  const { data, error } = await db
    .from('business_financial_periods')
    .insert(values)
    .select('*')
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listFinancialPeriods(
  db: Db,
  businessId: string,
): Promise<BusinessFinancialPeriod[]> {
  const { data } = await db
    .from('business_financial_periods')
    .select('*')
    .eq('business_id', businessId)
    .order('period_start', { ascending: false });
  return data ?? [];
}

export async function findFinancialPeriodById(
  db: Db,
  periodId: string,
): Promise<BusinessFinancialPeriod | null> {
  const { data } = await db
    .from('business_financial_periods')
    .select('*')
    .eq('id', periodId)
    .maybeSingle();
  return data ?? null;
}

export async function insertMetric(
  db: Db,
  values: MetricInsert,
): Promise<{ data: BusinessMetric | null; error: string | null }> {
  const { data, error } = await db.from('business_metrics').insert(values).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listMetricsForBusiness(
  db: Db,
  businessId: string,
): Promise<BusinessMetric[]> {
  const { data } = await db
    .from('business_metrics')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function listMetricsForPeriod(db: Db, periodId: string): Promise<BusinessMetric[]> {
  const { data } = await db
    .from('business_metrics')
    .select('*')
    .eq('financial_period_id', periodId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Business, Country } from '@/types/business';

/**
 * Business repository — the only place business queries are written.
 *
 * Every call uses the request-scoped client, so RLS scopes results to the
 * caller. Ownership is NOT re-filtered here: doing so would imply the policy
 * might not hold, and the RLS suite proves it does.
 */
/** @deprecated Prefer `Business` from '@/types/business'. Kept for internal use. */
export type BusinessRow = Business;

export async function insertBusiness(
  db: SupabaseClient<Database>,
  values: {
    owner_id: string;
    name: string;
    country_code: string;
    industry?: string | undefined;
    /** Which front door created this business. Defaults to 'build' at the DB. */
    business_mode?: Business['business_mode'] | undefined;
    legal_name?: string | undefined;
    trading_name?: string | undefined;
    business_type?: string | undefined;
  },
): Promise<{ data: BusinessRow | null; error: string | null }> {
  const { data, error } = await db
    .from('businesses')
    .insert({
      owner_id: values.owner_id,
      name: values.name,
      country_code: values.country_code,
      industry: values.industry ?? null,
      ...(values.business_mode ? { business_mode: values.business_mode } : {}),
      legal_name: values.legal_name ?? null,
      trading_name: values.trading_name ?? null,
      business_type: values.business_type ?? null,
    })
    .select('*')
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

/** Active businesses, most recently updated first — matches the partial index. */
export async function listActiveBusinesses(db: SupabaseClient<Database>): Promise<BusinessRow[]> {
  const { data } = await db
    .from('businesses')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function findBusinessById(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessRow | null> {
  const { data } = await db.from('businesses').select('*').eq('id', businessId).maybeSingle();
  return data ?? null;
}

export async function updateBusiness(
  db: SupabaseClient<Database>,
  businessId: string,
  patch: Partial<
    Pick<
      BusinessRow,
      | 'name'
      | 'industry'
      | 'status'
      | 'archived_at'
      | 'legal_name'
      | 'trading_name'
      | 'business_type'
      | 'logo_storage_path'
    >
  >,
): Promise<{ data: BusinessRow | null; error: string | null }> {
  const { data, error } = await db
    .from('businesses')
    .update(patch)
    .eq('id', businessId)
    .select('*')
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function listActiveCountries(db: SupabaseClient<Database>): Promise<Country[]> {
  const { data } = await db
    .from('countries')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  return data ?? [];
}

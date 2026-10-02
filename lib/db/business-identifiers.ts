import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessIdentifier, BusinessIdentifierType, FactProvenance } from '@/types/business';

/**
 * Business identifier repository — the only place identifier rows are queried.
 *
 * Every call uses the request-scoped client, so RLS scopes results to the
 * caller through `app.business_access`. Ownership is not re-filtered here; the
 * RLS suite proves the policy holds.
 *
 * ⚠ These rows hold SENSITIVE values (tax ids, registration numbers). Callers
 *   must never place `value` in logs, URLs, Nova query representations,
 *   `agent_executions` or analytics. The database is the only place it lives.
 */

export interface InsertBusinessIdentifier {
  business_id: string;
  identifier_type: BusinessIdentifierType;
  value: string;
  label?: string | null;
  /** Defaults to founder_provided at the DB when omitted. */
  provenance?: FactProvenance;
}

export async function listIdentifiersForBusiness(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessIdentifier[]> {
  const { data } = await db
    .from('business_identifiers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function insertBusinessIdentifier(
  db: SupabaseClient<Database>,
  values: InsertBusinessIdentifier,
): Promise<{ data: BusinessIdentifier | null; error: string | null }> {
  const { data, error } = await db
    .from('business_identifiers')
    .insert({
      business_id: values.business_id,
      identifier_type: values.identifier_type,
      value: values.value,
      label: values.label ?? null,
      // Founder-entered by construction on this path. The DB CHECK
      // (bi_no_unfounded_verification) guarantees it can never become 'verified'.
      provenance: values.provenance ?? 'founder_provided',
    })
    .select('*')
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

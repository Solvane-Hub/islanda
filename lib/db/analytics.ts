import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Db = SupabaseClient<Database>;

export type AnalyticsEventRow = Database['public']['Tables']['analytics_events']['Insert'];

/**
 * Analytics repository. Writes only.
 *
 * `analytics_events` has no INSERT grant for any API role: rows are written by
 * the server, after validation, with the service-role client — which is why
 * this takes an explicit client rather than creating one. A repeated
 * `event_id` (a retried beacon, a double effect in development) is ignored
 * rather than counted twice.
 */
export async function insertAnalyticsEvents(
  admin: Db,
  rows: AnalyticsEventRow[],
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null };
  const { error } = await admin
    .from('analytics_events')
    .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
  return { error: error?.message ?? null };
}

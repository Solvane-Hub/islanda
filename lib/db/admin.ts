import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type Db = SupabaseClient<Database>;

/**
 * Admin repository. Every call runs on the CALLER'S session: the SQL
 * functions refuse (42501) unless `app.is_platform_admin()` is true, and the
 * tables they read are protected by RLS policies on the same predicate. The
 * service-role client is never used to serve admin data.
 */

export interface AdminAccessRow {
  allowlisted: boolean;
  aal: string;
  display_name: string | null;
}

export async function readAdminAccess(db: Db): Promise<AdminAccessRow> {
  const { data, error } = await db.rpc('get_admin_access');
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allowlisted: row.allowlisted === true,
    aal: typeof row.aal === 'string' ? row.aal : 'aal1',
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
  };
}

export type ReportFunction =
  'admin_web_analytics' | 'admin_waitlist_insights' | 'admin_user_overview' | 'admin_product_usage';

export async function runRangeReport(
  db: Db,
  fn: ReportFunction,
  from: string,
  to: string,
): Promise<Json> {
  const { data, error } = await db.rpc(fn, { p_from: from, p_to: to });
  if (error) throw error;
  return data;
}

export async function listUsers(
  db: Db,
  args: { search: string | null; includeTest: boolean; offset: number; limit: number },
): Promise<Json> {
  const { data, error } = await db.rpc('admin_list_users', {
    p_search: args.search,
    p_include_test: args.includeTest,
    p_offset: args.offset,
    p_limit: args.limit,
  });
  if (error) throw error;
  return data;
}

export async function userDetail(db: Db, userId: string): Promise<Json> {
  const { data, error } = await db.rpc('admin_user_detail', { p_user_id: userId });
  if (error) throw error;
  return data;
}

export interface AuditRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  business_id: string | null;
  event: string;
  correlation_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
}

export async function listAuditEvents(
  db: Db,
  args: { from: string; to: string; prefix: string | null; offset: number; limit: number },
): Promise<{ rows: AuditRow[]; total: number }> {
  let q = db
    .from('audit_log')
    .select(
      'id, occurred_at, actor_id, business_id, event, correlation_id, ip_address, user_agent, metadata',
      {
        count: 'exact',
      },
    )
    .gte('occurred_at', args.from)
    .lt('occurred_at', args.to);
  if (args.prefix) q = q.like('event', `${args.prefix}%`);
  const { data, error, count } = await q
    .order('occurred_at', { ascending: false })
    .range(args.offset, args.offset + args.limit - 1);
  if (error) throw error;
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

/** Emails of platform administrators, for labelling audit actors. Admin-only via RLS (own row) — so this returns only the caller. */
export async function readOwnAdminRow(
  db: Db,
  userId: string,
): Promise<{ email: string; display_name: string; provisioned_at: string } | null> {
  const { data, error } = await db
    .from('platform_admins')
    .select('email, display_name, provisioned_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

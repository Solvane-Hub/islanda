import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type Db = SupabaseClient<Database>;

/**
 * RLS tests run against a REAL Supabase project with REAL authenticated sessions.
 * Mocking here would test the mock, not the security boundary.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const aEmail = process.env.RLS_TEST_USER_A_EMAIL;
const aPassword = process.env.RLS_TEST_USER_A_PASSWORD;
const bEmail = process.env.RLS_TEST_USER_B_EMAIL;
const bPassword = process.env.RLS_TEST_USER_B_PASSWORD;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const rlsConfigured = Boolean(url && anonKey && aEmail && aPassword && bEmail && bPassword);

/**
 * Whether a service-role client can be built. Gates the handful of tests that
 * need to do something the application itself never does through the API —
 * currently, creating and deleting a throwaway `auth.users` row to prove an
 * `ON DELETE SET NULL` foreign key live rather than by reading migration
 * metadata. Separate from `rlsConfigured` since an environment can have the
 * two test users without necessarily exposing the service-role key to tests.
 */
export const adminConfigured = Boolean(url && serviceRoleKey);

/**
 * Skipping a security suite silently is how isolation regressions ship.
 * CI sets RLS_TESTS_REQUIRED=1, which turns "not configured" into a failure.
 */
export const rlsRequired = process.env.RLS_TESTS_REQUIRED === '1';

let seq = 0;

function client(): Db {
  // Distinct storage keys: several clients coexist in one process, and sharing a
  // key makes GoTrue sessions clobber each other — which would silently invalidate
  // the isolation these tests exist to prove.
  seq += 1;
  return createClient<Database>(url!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `foundryai-rls-test-${seq}`,
    },
  });
}

/** An unauthenticated client — used to prove `anon` can reach nothing. */
export function anonClient(): Db {
  return client();
}

/**
 * Service-role client. BYPASSES RLS — test setup/teardown only, never a
 * stand-in for a real tenant. Used exactly once today: creating and deleting
 * a throwaway `auth.users` row to prove `ON DELETE SET NULL` live on
 * `actor_id`. Guarded by `adminConfigured`; callers must check it first.
 */
export function adminClient(): Db {
  return createClient<Database>(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signIn(which: 'A' | 'B'): Promise<{ db: Db; userId: string }> {
  const db = client();
  const email = which === 'A' ? aEmail! : bEmail!;
  const password = which === 'A' ? aPassword! : bPassword!;
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in test user ${which}: ${error.message}`);
  if (!data.user) throw new Error(`No user returned for test user ${which}`);
  return { db, userId: data.user.id };
}

/**
 * Businesses cannot be deleted — there is no DELETE policy, by design (ADR-0009).
 * Tests therefore clean up the only way the application can: by archiving.
 * The partial unique index on active names means archiving frees the name for reuse,
 * which is what makes this suite re-runnable.
 */
export async function archiveAll(db: Db, ownerId: string, namePrefix: string): Promise<void> {
  const { data } = await db
    .from('businesses')
    .select('id')
    .eq('owner_id', ownerId)
    .like('name', `${namePrefix}%`)
    .neq('status', 'archived');
  for (const row of data ?? []) {
    await db
      .from('businesses')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', row.id);
  }
}

/**
 * A per-suite data namespace.
 *
 * ⚠ Includes random entropy, not just a timestamp. Both RLS suites sign in as
 *   the SAME two auth users (A and B) and clean up by archiving every business
 *   whose name starts with `RUN` (see `archiveAll`). When the two test files are
 *   imported in the same millisecond — which Vitest's parallel workers routinely
 *   do — a timestamp-only `RUN` collides, and one suite's `archiveAll` then
 *   archives the other suite's fixtures mid-run. That made a broad cross-tenant
 *   SELECT see a sibling suite's row and turned an "archived requires
 *   archived_at" assertion into a no-op update. The random suffix makes each
 *   suite's namespace disjoint so the suites cannot interfere.
 */
export const RUN = `rlstest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

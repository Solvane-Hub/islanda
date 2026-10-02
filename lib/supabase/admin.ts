import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { clientEnv, serverEnv } from '@/lib/env';

/**
 * Service-role client. **BYPASSES ROW LEVEL SECURITY.**
 *
 * Security Architecture — service keys are server-side only. Rules:
 *   - never import this from a Client Component
 *   - never use it to read or return user data
 *   - only for writes the user is deliberately not privileged to make directly,
 *     currently: audit_log, which has zero policies by design
 *
 * Returns null when the key is absent, so the caller must handle its absence
 * explicitly rather than silently proceeding without an audit trail.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createSupabaseClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

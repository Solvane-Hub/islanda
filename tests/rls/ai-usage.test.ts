import { describe, expect, it } from 'vitest';
import { anonClient, rlsConfigured, signIn } from './client';

/**
 * Row Level Security — `ai_usage` (P5), hardened in P7.0.
 *
 * `ai_usage` has RLS enabled with ZERO policies, like `audit_log` — so
 * `authenticated` and `anon` are already fully denied regardless of FORCE, and
 * that is what this suite pins. `FORCE ROW LEVEL SECURITY` (added in
 * `20260911000000_ai_usage_force_rls.sql`) closes a DIFFERENT gap — an
 * ordinary (non-BYPASSRLS) table-owner connection — which is not observable
 * through the `anon`/`authenticated` clients this test harness uses. That flag
 * was verified directly via schema inspection during the P7 audit
 * (`relforcerowsecurity = true`), not by a client-level test, because no
 * client-level behaviour exists to distinguish it.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — ai_usage', () => {
  it('an authenticated user cannot read ai_usage', async () => {
    const { db } = await signIn('A');
    const { data, error } = await db.from('ai_usage').select('id');
    expect(error ?? { m: 1 }).toBeTruthy();
    expect(data ?? []).toHaveLength(0);
  });

  it('an authenticated user cannot write to ai_usage', async () => {
    const { db } = await signIn('A');
    const { error } = await db.from('ai_usage').insert({
      category: 'forged',
      determination: 'deterministic',
    } as never);
    expect(error).not.toBeNull();
  });

  it('anonymous users cannot read ai_usage', async () => {
    const { data } = await anonClient().from('ai_usage').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});

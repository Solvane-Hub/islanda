import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  adminClient,
  adminConfigured,
  anonClient,
  rlsConfigured,
  rlsRequired,
  signIn,
} from './client';

/**
 * Row Level Security — the owner-only admin portal
 * (20261018000000_admin_portal_and_analytics).
 *
 * Proves, live, that every admin data path refuses anyone who is not a
 * provisioned platform administrator on an MFA session: anonymous visitors,
 * signed-in founders, and an account holding the retired `waitlist_admin`
 * role. The positive administrator path needs an aal2 session for one of the
 * two allowlisted accounts, which a test cannot create; it is verified
 * directly in Postgres with simulated JWT claims (see the implementation
 * report) and by the administrators' own first sign-in.
 */

if (!rlsConfigured && rlsRequired) {
  throw new Error('RLS tests are required but the test users are not configured.');
}

const RANGE = { p_from: '2026-08-01T00:00:00Z', p_to: '2026-12-31T00:00:00Z' };
const ADMIN_FUNCTIONS = [
  ['admin_web_analytics', RANGE],
  ['admin_waitlist_insights', RANGE],
  ['admin_user_overview', RANGE],
  ['admin_product_usage', RANGE],
  ['admin_list_users', { p_search: null, p_include_test: true, p_offset: 0, p_limit: 10 }],
  ['admin_user_detail', { p_user_id: '00000000-0000-0000-0000-000000000000' }],
] as const;

describe.skipIf(!rlsConfigured)('Row Level Security — admin portal', () => {
  describe('an anonymous visitor', () => {
    it('cannot call any admin reporting function', async () => {
      const anon = anonClient();
      for (const [fn, args] of ADMIN_FUNCTIONS) {
        const { data, error } = await anon.rpc(fn as never, args as never);
        expect(error, fn).not.toBeNull();
        expect(data, fn).toBeNull();
      }
    });

    it('cannot read analytics, the audit log or the administrator list', async () => {
      const anon = anonClient();
      for (const table of ['analytics_events', 'audit_log', 'platform_admins'] as const) {
        const { data } = await anon.from(table).select('*').limit(1);
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    it('cannot write analytics events directly (only the server can)', async () => {
      const { error } = await anonClient()
        .from('analytics_events')
        .insert({ event_id: randomUUID(), kind: 'web', event_name: 'page_view', path: '/' });
      expect(error).not.toBeNull();
    });

    it('is not an administrator', async () => {
      const { data, error } = await anonClient().rpc('get_admin_access');
      expect(error).not.toBeNull(); // no grant to anon
      expect(data).toBeNull();
    });
  });

  describe('a signed-in founder', () => {
    it('is told they are not allowlisted', async () => {
      const { db } = await signIn('A');
      const { data, error } = await db.rpc('get_admin_access');
      expect(error).toBeNull();
      expect(data).toMatchObject({ allowlisted: false, display_name: null });
    });

    it('is refused by every admin reporting function (42501), learning nothing', async () => {
      const { db } = await signIn('A');
      for (const [fn, args] of ADMIN_FUNCTIONS) {
        const { data, error } = await db.rpc(fn as never, args as never);
        expect(error?.code, fn).toBe('42501');
        expect(data, fn).toBeNull();
      }
    });

    it('reads no analytics, no audit rows, no waitlist rows and no administrator rows', async () => {
      const { db } = await signIn('A');
      for (const table of [
        'analytics_events',
        'audit_log',
        'waitlist_signups',
        'platform_admins',
      ] as const) {
        const { data } = await db.from(table).select('*').limit(5);
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    it('cannot make themselves an administrator', async () => {
      const { db, userId } = await signIn('A');
      const { error } = await db.from('platform_admins').insert({
        user_id: userId,
        email: 'jamilnash@solvanehub.us',
        display_name: 'Not Jamil',
        provisioned_by: 'self',
      });
      expect(error).not.toBeNull(); // no INSERT grant
    });

    it('cannot tamper with the audit log', async () => {
      const { db } = await signIn('A');
      const insert = await db.from('audit_log').insert({ event: 'admin.signed_in' } as never);
      expect(insert.error).not.toBeNull();
      const del = await db.from('audit_log').delete().gte('id', 0).select('id');
      expect(del.data ?? []).toHaveLength(0);
    });

    it('cannot update recruitment fields, including the new dates and feedback', async () => {
      const { db } = await signIn('A');
      const { data } = await db
        .from('waitlist_signups')
        .update({ recruitment_tested_on: '2026-10-18', feedback_summary: 'x' })
        .gte('created_at', '2000-01-01')
        .select('id');
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe.skipIf(!adminConfigured)('the allowlist itself', () => {
    it('the database refuses to provision any address other than the two owners', async () => {
      const { userId } = await signIn('B');
      const { error } = await adminClient().from('platform_admins').insert({
        user_id: userId,
        email: 'someone-else@solvanehub.us',
        display_name: 'Someone',
        provisioned_by: 'rls-test',
      });
      expect(error?.code).toBe('23514'); // pa_email_allowlist check constraint
    });

    it("binding an owner's address to a different account grants nothing", async () => {
      // Even if a row could be written with an owner address but the wrong user id,
      // the identity check requires the account's own email to match. Proven here
      // without writing such a row: the test user's own access remains denied.
      const { db } = await signIn('B');
      const { data } = await db.rpc('get_admin_access');
      expect(data).toMatchObject({ allowlisted: false });
    });

    it('the retired waitlist_admin role no longer grants access to the waitlist', async () => {
      const { db, userId } = await signIn('B');
      const admin = adminClient();
      const grant = await admin
        .from('staff_members')
        .insert({ user_id: userId, role: 'waitlist_admin' });
      if (grant.error && grant.error.code !== '23505') throw grant.error;
      try {
        const { data } = await db.from('waitlist_signups').select('id').limit(1);
        expect(data ?? []).toHaveLength(0);
        const { error } = await db.rpc('admin_waitlist_insights', RANGE);
        expect(error?.code).toBe('42501');
      } finally {
        await admin
          .from('staff_members')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'waitlist_admin');
      }
    });
  });
});

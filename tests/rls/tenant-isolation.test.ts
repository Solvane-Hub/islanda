import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, rlsRequired, RUN, signIn, type Db } from './client';
import { isUserAssignedCountryCode } from '@/lib/knowledge/jurisdiction';

/**
 * A country code that is not, and will not become, a row in `countries`.
 *
 * ⚠ This was `'ZZ'` until ZZ became the SYNTHETIC demonstration jurisdiction and
 *   was registered for real. The test then inserted successfully, failed its
 *   assertion, and — worse — briefly created a ZZ business owned by a test
 *   tenant. Under `app.knowledge_jurisdiction_access` that would have handed
 *   that tenant read access to the ZZ Knowledge Pack. A constraint test must
 *   never be able to grant a privilege as a side effect.
 *
 * `ZY` is chosen because it is:
 *   • syntactically valid, so `countries_code_format` passes and the FOREIGN KEY
 *     is what does the rejecting — which is the constraint under test;
 *   • unassigned in ISO 3166-1;
 *   • deliberately OUTSIDE the user-assigned ranges (AA, QM–QZ, XA–XZ, ZZ), so
 *     it can never be adopted as a future synthetic jurisdiction. That
 *     convention is asserted below rather than trusted to memory.
 */
const UNREGISTERED_COUNTRY_CODE = 'ZY';

if (isUserAssignedCountryCode(UNREGISTERED_COUNTRY_CODE)) {
  throw new Error(
    `tests/rls: "${UNREGISTERED_COUNTRY_CODE}" is an ISO 3166-1 user-assigned code, which this ` +
      'project reserves for synthetic jurisdictions. Pick an unassigned code instead — otherwise ' +
      'this test will one day insert a real row and grant a test tenant access to a Knowledge Pack.',
  );
}

if (!rlsConfigured && rlsRequired) {
  throw new Error(
    'RLS_TESTS_REQUIRED=1 but the RLS test environment is not configured. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and RLS_TEST_USER_{A,B}_{EMAIL,PASSWORD}.',
  );
}
if (!rlsConfigured) {
  console.warn(
    '\n⚠  RLS SUITE SKIPPED — tenant isolation is NOT being verified in this run.\n' +
      '   Configure the RLS test environment, or set RLS_TESTS_REQUIRED=1 to make this a failure.\n',
  );
}

describe.skipIf(!rlsConfigured)('Row Level Security — tenant isolation', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBusinessId: string;

  beforeAll(async () => {
    ({ db: A, userId: aId } = await signIn('A'));
    ({ db: B, userId: bId } = await signIn('B'));
    anon = anonClient();

    await archiveAll(A, aId, RUN);
    await archiveAll(B, bId, RUN);

    const { data, error } = await A.from('businesses')
      .insert({ owner_id: aId, name: `${RUN}-alpha`, country_code: 'BS', industry: 'Hospitality' })
      .select('id')
      .single();
    if (error) throw new Error(`Setup failed: ${error.message}`);
    aBusinessId = data.id;

    const { error: pErr } = await A.from('business_profiles').insert({
      business_id: aBusinessId,
      description: 'Tenant A private intake data',
      last_completed_step: 1,
    });
    if (pErr) throw new Error(`Setup failed (profile): ${pErr.message}`);
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
  }, 30_000);

  // ---------------------------------------------------------------- anon ---
  describe('anonymous access', () => {
    it('cannot read countries', async () => {
      const { data, error } = await anon.from('countries').select('code');
      expect(error ?? { message: 'no error' }).toBeTruthy();
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot read businesses', async () => {
      const { data } = await anon.from('businesses').select('id');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot read profiles', async () => {
      const { data } = await anon.from('profiles').select('id');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot insert a business', async () => {
      const { error } = await anon
        .from('businesses')
        .insert({ owner_id: aId, name: `${RUN}-anon`, country_code: 'BS' });
      expect(error).not.toBeNull();
    });
  });

  // ------------------------------------------------------------ own data ---
  describe('a founder can reach their own data', () => {
    it('reads reference data', async () => {
      const { data, error } = await A.from('countries').select('code, is_active');
      expect(error).toBeNull();
      expect(data?.some((c) => c.code === 'BS' && c.is_active)).toBe(true);
    });

    it('reads their own business', async () => {
      const { data, error } = await A.from('businesses').select('id, name').eq('id', aBusinessId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('reads their own intake profile', async () => {
      const { data, error } = await A.from('business_profiles')
        .select('description')
        .eq('business_id', aBusinessId);
      expect(error).toBeNull();
      expect(data?.[0]?.description).toContain('Tenant A');
    });

    it('sees exactly one profile row — their own', async () => {
      const { data, error } = await A.from('profiles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(aId);
    });

    it('supports multiple businesses per founder (ADR-0006)', async () => {
      const { error } = await A.from('businesses').insert({
        owner_id: aId,
        name: `${RUN}-beta`,
        country_code: 'BS',
      });
      expect(error).toBeNull();
      const { data } = await A.from('businesses').select('id').like('name', `${RUN}%`);
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ------------------------------------------------- CROSS-TENANT DENIAL ---
  describe('tenant B cannot reach tenant A', () => {
    it('cannot SELECT A’s business', async () => {
      const { data, error } = await B.from('businesses').select('id').eq('id', aBusinessId);
      expect(error).toBeNull(); // RLS filters silently rather than erroring
      expect(data).toHaveLength(0);
    });

    it('sees no rows at all in a broad SELECT', async () => {
      const { data } = await B.from('businesses').select('id').like('name', `${RUN}%`);
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot UPDATE A’s business', async () => {
      const { data } = await B.from('businesses')
        .update({ name: `${RUN}-hijacked` })
        .eq('id', aBusinessId)
        .select('id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('businesses').select('name').eq('id', aBusinessId);
      expect(check?.[0]?.name).toBe(`${RUN}-alpha`);
    });

    it('cannot DELETE A’s business — no DELETE policy exists', async () => {
      const { data } = await B.from('businesses').delete().eq('id', aBusinessId).select('id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('businesses').select('id').eq('id', aBusinessId);
      expect(check).toHaveLength(1);
    });

    it('cannot create a business owned by A (owner_id spoofing)', async () => {
      const { error } = await B.from('businesses').insert({
        owner_id: aId,
        name: `${RUN}-spoofed`,
        country_code: 'BS',
      });
      expect(error).not.toBeNull();
    });

    it('cannot SELECT A’s intake profile', async () => {
      const { data } = await B.from('business_profiles')
        .select('description')
        .eq('business_id', aBusinessId);
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot UPDATE A’s intake profile', async () => {
      const { data } = await B.from('business_profiles')
        .update({ description: 'hijacked' })
        .eq('business_id', aBusinessId)
        .select('business_id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('business_profiles')
        .select('description')
        .eq('business_id', aBusinessId);
      expect(check?.[0]?.description).toContain('Tenant A');
    });

    it('cannot INSERT an intake profile against A’s business (app.business_access)', async () => {
      const { error } = await B.from('business_profiles').insert({
        business_id: aBusinessId,
        description: 'injected by tenant B',
      });
      expect(error).not.toBeNull();
    });

    it('cannot SELECT A’s profile row', async () => {
      const { data } = await B.from('profiles').select('id').eq('id', aId);
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot UPDATE A’s profile row', async () => {
      const { data } = await B.from('profiles')
        .update({ full_name: 'hijacked' })
        .eq('id', aId)
        .select('id');
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------ deletion ---
  describe('deletion is impossible for everyone (ADR-0009)', () => {
    it('a founder cannot delete their OWN business', async () => {
      const { data } = await A.from('businesses').delete().eq('id', aBusinessId).select('id');
      expect(data ?? []).toHaveLength(0);
      const { data: check } = await A.from('businesses').select('id').eq('id', aBusinessId);
      expect(check).toHaveLength(1);
    });

    it('archival is the supported removal path', async () => {
      const { data: biz } = await A.from('businesses')
        .insert({ owner_id: aId, name: `${RUN}-gamma`, country_code: 'BS' })
        .select('id')
        .single();
      const { error } = await A.from('businesses')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', biz!.id);
      expect(error).toBeNull();
    });
  });

  // ----------------------------------------------------------- audit log ---
  describe('audit log is invisible to the API (D12)', () => {
    it('authenticated users cannot read it', async () => {
      const { data, error } = await A.from('audit_log').select('id');
      expect(error ?? { m: 1 }).toBeTruthy();
      expect(data ?? []).toHaveLength(0);
    });

    it('authenticated users cannot write to it', async () => {
      const { error } = await A.from('audit_log').insert({ event: 'forged.event' });
      expect(error).not.toBeNull();
    });

    it('anonymous users cannot read it', async () => {
      const { data } = await anon.from('audit_log').select('id');
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------- constraints --
  describe('database constraints hold against the API', () => {
    it('rejects a blank business name', async () => {
      const { error } = await A.from('businesses').insert({
        owner_id: aId,
        name: '   ',
        country_code: 'BS',
      });
      expect(error).not.toBeNull();
    });

    it('rejects an unknown country code', async () => {
      const { error } = await A.from('businesses').insert({
        owner_id: aId,
        name: `${RUN}-badcountry`,
        country_code: UNREGISTERED_COUNTRY_CODE,
      });
      expect(error).not.toBeNull();
    });

    it('leaves no business behind when the country code is rejected', async () => {
      // The failure mode this guards is not the constraint — it is the test.
      // While the fixture used a code that had quietly become real, this insert
      // SUCCEEDED, and the row it created granted its owner jurisdiction access
      // to a published Knowledge Pack until cleanup archived it.
      const { data } = await A.from('businesses')
        .select('id')
        .eq('country_code', UNREGISTERED_COUNTRY_CODE);

      expect(data ?? []).toHaveLength(0);
    });

    it('rejects archived status without archived_at', async () => {
      const { error } = await A.from('businesses')
        .update({ status: 'archived' })
        .eq('id', aBusinessId);
      expect(error).not.toBeNull();
    });

    it('rejects a funding amount with no currency', async () => {
      const { error } = await A.from('business_profiles')
        .update({ funding_requirement_amount: 50000 })
        .eq('business_id', aBusinessId);
      expect(error).not.toBeNull();
    });

    it('rejects a negative employee count', async () => {
      const { error } = await A.from('business_profiles')
        .update({ employee_count: -1 })
        .eq('business_id', aBusinessId);
      expect(error).not.toBeNull();
    });

    it('enforces one intake profile per business', async () => {
      const { error } = await A.from('business_profiles').insert({
        business_id: aBusinessId,
        description: 'second profile',
      });
      expect(error).not.toBeNull();
    });
  });
});

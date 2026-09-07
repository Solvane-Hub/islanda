import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';

/**
 * Row Level Security — the Business Object's new surface.
 *
 * `business_identifiers` holds SENSITIVE government identifiers, so its isolation
 * is a P0 security property, not a nicety. This suite proves a second tenant can
 * neither read nor write another founder's identifiers, that anonymous access
 * reaches nothing, and that the honesty/uniqueness constraints hold against the
 * API. It also confirms the additive identity columns on `businesses` stay
 * owner-scoped.
 *
 * Skipped unless the RLS environment is configured (see tests/rls/client.ts);
 * CI sets RLS_TESTS_REQUIRED=1 so a silent skip is a failure there.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — business identifiers', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBusinessId: string;
  let aIdentifierId: string;

  beforeAll(async () => {
    ({ db: A, userId: aId } = await signIn('A'));
    ({ db: B, userId: bId } = await signIn('B'));
    anon = anonClient();

    await archiveAll(A, aId, RUN);
    await archiveAll(B, bId, RUN);

    const { data: biz, error } = await A.from('businesses')
      .insert({
        owner_id: aId,
        name: `${RUN}-obj-alpha`,
        country_code: 'BS',
        business_mode: 'manage',
        legal_name: `${RUN} Naturals Ltd`,
        trading_name: `${RUN} Naturals`,
        business_type: 'company',
      })
      .select('id')
      .single();
    if (error) throw new Error(`Setup failed: ${error.message}`);
    aBusinessId = biz.id;

    const { data: ident, error: iErr } = await A.from('business_identifiers')
      .insert({
        business_id: aBusinessId,
        identifier_type: 'tax_identification_number',
        value: 'TIN-A-SECRET-0001',
      })
      .select('id')
      .single();
    if (iErr) throw new Error(`Setup failed (identifier): ${iErr.message}`);
    aIdentifierId = ident.id;
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
  }, 30_000);

  describe('a founder reaches their own identifiers', () => {
    it('reads their own identifier', async () => {
      const { data, error } = await A.from('business_identifiers')
        .select('id, value, provenance, verification_state')
        .eq('business_id', aBusinessId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.provenance).toBe('founder_provided');
      expect(data?.[0]?.verification_state).toBe('unverified');
    });

    it('reads their own identity columns on the business', async () => {
      const { data } = await A.from('businesses')
        .select('business_mode, legal_name')
        .eq('id', aBusinessId);
      expect(data?.[0]?.business_mode).toBe('manage');
      expect(data?.[0]?.legal_name).toContain('Naturals Ltd');
    });
  });

  describe('tenant B cannot reach tenant A’s identifiers', () => {
    it('cannot SELECT A’s identifiers', async () => {
      const { data, error } = await B.from('business_identifiers')
        .select('id, value')
        .eq('business_id', aBusinessId);
      expect(error).toBeNull(); // RLS filters silently
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot INSERT an identifier against A’s business (app.business_access)', async () => {
      const { error } = await B.from('business_identifiers').insert({
        business_id: aBusinessId,
        identifier_type: 'vat_registration_number',
        value: 'injected-by-B',
      });
      expect(error).not.toBeNull();
    });

    it('cannot UPDATE A’s identifier', async () => {
      const { data } = await B.from('business_identifiers')
        .update({ value: 'hijacked' })
        .eq('id', aIdentifierId)
        .select('id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('business_identifiers')
        .select('value')
        .eq('id', aIdentifierId);
      expect(check?.[0]?.value).toBe('TIN-A-SECRET-0001');
    });
  });

  describe('anonymous access reaches nothing', () => {
    it('cannot read identifiers', async () => {
      const { data } = await anon.from('business_identifiers').select('id');
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('deletion is impossible — no DELETE policy (ADR-0009)', () => {
    it('a founder cannot delete their OWN identifier', async () => {
      const { data } = await A.from('business_identifiers')
        .delete()
        .eq('id', aIdentifierId)
        .select('id');
      expect(data ?? []).toHaveLength(0);
      const { data: check } = await A.from('business_identifiers')
        .select('id')
        .eq('id', aIdentifierId);
      expect(check).toHaveLength(1);
    });
  });

  describe('honesty & uniqueness constraints hold against the API', () => {
    it('rejects a founder-provided identifier stored as verified', async () => {
      const { error } = await A.from('business_identifiers').insert({
        business_id: aBusinessId,
        identifier_type: 'company_registration_number',
        value: 'C-11111',
        provenance: 'founder_provided',
        verification_state: 'verified',
        verified_at: new Date().toISOString(),
      });
      expect(error).not.toBeNull(); // bi_no_unfounded_verification
    });

    it('rejects a second identifier of the same specific type', async () => {
      const { error } = await A.from('business_identifiers').insert({
        business_id: aBusinessId,
        identifier_type: 'tax_identification_number',
        value: 'TIN-A-SECRET-0002',
      });
      expect(error).not.toBeNull(); // unique index (business_id, identifier_type)
    });

    it('allows multiple "other" identifiers', async () => {
      const { error: e1 } = await A.from('business_identifiers').insert({
        business_id: aBusinessId,
        identifier_type: 'other',
        value: 'misc-1',
      });
      const { error: e2 } = await A.from('business_identifiers').insert({
        business_id: aBusinessId,
        identifier_type: 'other',
        value: 'misc-2',
      });
      expect(e1).toBeNull();
      expect(e2).toBeNull();
    });
  });
});

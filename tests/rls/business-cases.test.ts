import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';

/**
 * Row Level Security — the Business Case primitive (P7.1).
 *
 * A case is a correlation object attached to a business; it introduces no new
 * permission boundary. This suite proves it follows the exact ADR-0009 pattern
 * every other business-owned table follows: owner-only access via
 * `app.business_access`, cross-tenant denial, anonymous denial, and no DELETE
 * path. It also proves `advisor_id` — deliberately unconstrained — grants no
 * access by itself: a case is reachable through `business_id` alone.
 *
 * ⚠ Owner integrity (P7.1 fix, `20260911020000_business_cases_owner_integrity.sql`):
 *   the INSERT policy additionally requires `owner_id = auth.uid()`, so a
 *   caller can never create a case attributed to a different user — even for a
 *   business they legitimately own. `advisor_id` and the `business_id`
 *   boundary are unaffected by that fix; this file proves both remain true.
 *
 * Skipped unless the RLS environment is configured (CI requires it).
 */
describe.skipIf(!rlsConfigured)('Row Level Security — business cases', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBiz: string, bBiz: string;
  let aCase: string;

  beforeAll(async () => {
    ({ db: A, userId: aId } = await signIn('A'));
    ({ db: B, userId: bId } = await signIn('B'));
    anon = anonClient();
    await archiveAll(A, aId, RUN);
    await archiveAll(B, bId, RUN);

    const mkBiz = async (db: Db, owner: string, name: string) => {
      const { data, error } = await db
        .from('businesses')
        .insert({ owner_id: owner, name, country_code: 'BS' })
        .select('id')
        .single();
      if (error) throw new Error(`biz setup: ${error.message}`);
      return data.id as string;
    };
    aBiz = await mkBiz(A, aId, `${RUN}-case-alpha`);
    bBiz = await mkBiz(B, bId, `${RUN}-case-beta`);

    const { data: c, error: cErr } = await A.from('business_cases')
      .insert({
        business_id: aBiz,
        title: `${RUN} readiness review`,
        objective: 'Determine formation requirements.',
        owner_id: aId,
      })
      .select('id')
      .single();
    if (cErr) throw new Error(`case setup: ${cErr.message}`);
    aCase = c.id;
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  describe('a founder reaches their own case', () => {
    it('reads its own case, default status open', async () => {
      const { data, error } = await A.from('business_cases').select('*').eq('id', aCase);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.status).toBe('open');
      expect(data?.[0]?.owner_id).toBe(aId);
      expect(data?.[0]?.advisor_id).toBeNull();
    });

    it('updates its own case status', async () => {
      const { error } = await A.from('business_cases')
        .update({ status: 'in_review' })
        .eq('id', aCase);
      expect(error).toBeNull();
      const { data } = await A.from('business_cases').select('status').eq('id', aCase);
      expect(data?.[0]?.status).toBe('in_review');
    });
  });

  describe('owner_id integrity (P7.1 fix)', () => {
    // A. A can create a case for its own business with owner_id = A.
    it('A can create a case for Business A with owner_id = A', async () => {
      const { data, error } = await A.from('business_cases')
        .insert({
          business_id: aBiz,
          title: `${RUN} owner-integrity A`,
          objective: 'Prove A can create with its own owner_id.',
          owner_id: aId,
        })
        .select('owner_id')
        .single();
      expect(error).toBeNull();
      expect(data?.owner_id).toBe(aId);
    });

    // B. A cannot create a case for Business A while attributing it to B —
    // even though A legitimately owns the business. This is the exact gap the
    // fix closes: business_access(business_id) alone used to be sufficient.
    it('A cannot create a case for Business A with owner_id = B', async () => {
      const { data, error } = await A.from('business_cases')
        .insert({
          business_id: aBiz,
          title: `${RUN} owner-spoof attempt`,
          objective: 'Attempt to attribute this case to another user.',
          owner_id: bId,
        })
        .select('id');
      expect(error).not.toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('tenant B cannot reach tenant A’s case', () => {
    it('cannot SELECT A’s case', async () => {
      const { data, error } = await B.from('business_cases').select('id').eq('id', aCase);
      expect(error).toBeNull(); // RLS filters silently
      expect(data ?? []).toHaveLength(0);
    });

    // C. B cannot create a case against A's business regardless of owner_id —
    // proven with both a spoofed owner_id (B claiming to be A) and B's own id,
    // so the business_id boundary is shown to hold independently of the
    // owner_id fix.
    it('cannot INSERT a case against A’s business, regardless of owner_id', async () => {
      const asB = await B.from('business_cases').insert({
        business_id: aBiz,
        title: 'intrusion',
        objective: 'intrusion',
        owner_id: bId,
      });
      expect(asB.error).not.toBeNull();

      const impersonatingA = await B.from('business_cases').insert({
        business_id: aBiz,
        title: 'intrusion via owner spoof',
        objective: 'intrusion via owner spoof',
        owner_id: aId,
      });
      expect(impersonatingA.error).not.toBeNull();
    });

    it('B can create its own case against its own business — isolation cuts both ways', async () => {
      const { data, error } = await B.from('business_cases')
        .insert({
          business_id: bBiz,
          title: `${RUN} b-case`,
          objective: 'B’s own objective.',
          owner_id: bId,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      // A cannot see B's case either.
      const { data: aView } = await A.from('business_cases').select('id').eq('business_id', bBiz);
      expect(aView ?? []).toHaveLength(0);
    });

    it('cannot UPDATE A’s case', async () => {
      const { data } = await B.from('business_cases')
        .update({ status: 'archived' })
        .eq('id', aCase)
        .select('id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('business_cases').select('status').eq('id', aCase);
      expect(check?.[0]?.status).toBe('in_review'); // unchanged from the prior test
    });

    it('being named as advisor_id grants B no access to A’s case', async () => {
      // Even if a founder someday lists B as an advisor, RLS is keyed on
      // business_id, not advisor_id — this column grants nothing by itself.
      await A.from('business_cases').update({ advisor_id: bId }).eq('id', aCase);
      const { data } = await B.from('business_cases').select('id').eq('id', aCase);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('anonymous access reaches nothing', () => {
    it('cannot read cases', async () => {
      const { data } = await anon.from('business_cases').select('id');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot insert a case', async () => {
      const { error } = await anon.from('business_cases').insert({
        business_id: aBiz,
        title: 'x',
        objective: 'x',
        owner_id: aId,
      });
      expect(error).not.toBeNull();
    });
  });

  describe('deletion is impossible (ADR-0009)', () => {
    it('a founder cannot delete their own case', async () => {
      const { data } = await A.from('business_cases').delete().eq('id', aCase).select('id');
      expect(data ?? []).toHaveLength(0);
      const { data: check } = await A.from('business_cases').select('id').eq('id', aCase);
      expect(check).toHaveLength(1);
    });
  });

  describe('constraints hold against the API', () => {
    it('rejects a blank title', async () => {
      const { error } = await A.from('business_cases').insert({
        business_id: aBiz,
        title: '   ',
        objective: 'valid objective',
        owner_id: aId,
      });
      expect(error).not.toBeNull(); // bc_title_length
    });

    it('rejects a blank objective', async () => {
      const { error } = await A.from('business_cases').insert({
        business_id: aBiz,
        title: 'valid title',
        objective: '',
        owner_id: aId,
      });
      expect(error).not.toBeNull(); // bc_objective_length
    });

    it('defaults status to open when omitted', async () => {
      const { data, error } = await A.from('business_cases')
        .insert({
          business_id: aBiz,
          title: `${RUN} second case`,
          objective: 'A second, independent case.',
          owner_id: aId,
        })
        .select('status')
        .single();
      expect(error).toBeNull();
      expect(data?.status).toBe('open');
    });
  });
});

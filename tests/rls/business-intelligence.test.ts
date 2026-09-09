import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';

/**
 * Row Level Security — the Business Intelligence Core.
 *
 * Financial periods, documents, metrics and goals are sensitive business data.
 * This suite proves a second tenant can neither read nor write another founder's
 * records, that anonymous access reaches nothing, that deletion is impossible,
 * that a founder-sourced figure cannot be stored "verified", and that a metric
 * or document cannot reference a period/document belonging to another business.
 *
 * Skipped unless the RLS environment is configured (CI requires it).
 */
describe.skipIf(!rlsConfigured)('Row Level Security — business intelligence core', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBiz: string, bBiz: string;
  let aPeriod: string, bPeriod: string;
  let aDoc: string, aMetric: string, aGoal: string;

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
    aBiz = await mkBiz(A, aId, `${RUN}-bi-alpha`);
    bBiz = await mkBiz(B, bId, `${RUN}-bi-beta`);

    const mkPeriod = async (db: Db, biz: string) => {
      const { data, error } = await db
        .from('business_financial_periods')
        .insert({
          business_id: biz,
          period_type: 'quarter',
          period_start: '2026-04-01',
          period_end: '2026-06-30',
          label: 'Q2 2026',
        })
        .select('id')
        .single();
      if (error) throw new Error(`period setup: ${error.message}`);
      return data.id as string;
    };
    aPeriod = await mkPeriod(A, aBiz);
    bPeriod = await mkPeriod(B, bBiz);

    const { data: doc, error: docErr } = await A.from('business_documents')
      .insert({
        business_id: aBiz,
        document_type: 'financial_statement',
        title: `${RUN} statement`,
      })
      .select('id')
      .single();
    if (docErr) throw new Error(`doc setup: ${docErr.message}`);
    aDoc = doc.id;

    const { data: metric, error: mErr } = await A.from('business_metrics')
      .insert({
        business_id: aBiz,
        metric_key: 'revenue',
        value: 120000,
        currency: 'BSD',
        financial_period_id: aPeriod,
      })
      .select('id')
      .single();
    if (mErr) throw new Error(`metric setup: ${mErr.message}`);
    aMetric = metric.id;

    const { data: goal, error: gErr } = await A.from('business_goals')
      .insert({
        business_id: aBiz,
        goal_type: 'revenue_target',
        title: `${RUN} reach 250k`,
        target_metric_key: 'revenue',
        target_value: 250000,
        target_currency: 'BSD',
      })
      .select('id')
      .single();
    if (gErr) throw new Error(`goal setup: ${gErr.message}`);
    aGoal = goal.id;
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  describe('a founder reaches their own intelligence', () => {
    it('reads own period, document, metric, goal', async () => {
      expect(
        (await A.from('business_financial_periods').select('id').eq('id', aPeriod)).data,
      ).toHaveLength(1);
      expect((await A.from('business_documents').select('id').eq('id', aDoc)).data).toHaveLength(1);
      expect((await A.from('business_metrics').select('id').eq('id', aMetric)).data).toHaveLength(
        1,
      );
      expect((await A.from('business_goals').select('id').eq('id', aGoal)).data).toHaveLength(1);
    });
  });

  describe('tenant B cannot reach tenant A', () => {
    it('cannot SELECT A’s rows', async () => {
      expect(
        (await B.from('business_financial_periods').select('id').eq('id', aPeriod)).data ?? [],
      ).toHaveLength(0);
      expect(
        (await B.from('business_documents').select('id').eq('id', aDoc)).data ?? [],
      ).toHaveLength(0);
      expect(
        (await B.from('business_metrics').select('id').eq('id', aMetric)).data ?? [],
      ).toHaveLength(0);
      expect((await B.from('business_goals').select('id').eq('id', aGoal)).data ?? []).toHaveLength(
        0,
      );
    });

    it('cannot INSERT against A’s business', async () => {
      expect(
        (
          await B.from('business_documents').insert({
            business_id: aBiz,
            document_type: 'invoice',
            title: 'x',
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await B.from('business_metrics').insert({
            business_id: aBiz,
            metric_key: 'revenue',
            value: 1,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await B.from('business_goals').insert({
            business_id: aBiz,
            goal_type: 'other',
            title: 'x',
          })
        ).error,
      ).not.toBeNull();
    });

    it('cannot UPDATE A’s metric', async () => {
      const { data } = await B.from('business_metrics')
        .update({ value: 0 })
        .eq('id', aMetric)
        .select('id');
      expect(data ?? []).toHaveLength(0);
      const { data: check } = await A.from('business_metrics').select('value').eq('id', aMetric);
      expect(Number(check?.[0]?.value)).toBe(120000);
    });
  });

  describe('anonymous access reaches nothing', () => {
    it('reads no BI rows', async () => {
      expect((await anon.from('business_metrics').select('id')).data ?? []).toHaveLength(0);
      expect((await anon.from('business_documents').select('id')).data ?? []).toHaveLength(0);
    });
  });

  describe('deletion is impossible (ADR-0009)', () => {
    it('a founder cannot delete their own metric', async () => {
      const { data } = await A.from('business_metrics').delete().eq('id', aMetric).select('id');
      expect(data ?? []).toHaveLength(0);
      expect((await A.from('business_metrics').select('id').eq('id', aMetric)).data).toHaveLength(
        1,
      );
    });
  });

  describe('honesty & integrity constraints hold against the API', () => {
    it('rejects a founder-provided metric stored as verified', async () => {
      const { error } = await A.from('business_metrics').insert({
        business_id: aBiz,
        metric_key: 'expenses',
        value: 5000,
        provenance: 'founder_provided',
        verification_state: 'verified',
      });
      expect(error).not.toBeNull(); // bm_no_unfounded_verification
    });

    it('rejects a founder-provided document stored as verified', async () => {
      const { error } = await A.from('business_documents').insert({
        business_id: aBiz,
        document_type: 'tax_document',
        title: `${RUN} taxdoc`,
        provenance: 'founder_provided',
        verification_state: 'verified',
      });
      expect(error).not.toBeNull(); // bd_no_unfounded_verification
    });

    it('rejects a metric referencing another business’s period (composite FK)', async () => {
      const { error } = await A.from('business_metrics').insert({
        business_id: aBiz,
        metric_key: 'revenue',
        value: 1,
        financial_period_id: bPeriod, // belongs to tenant B
      });
      expect(error).not.toBeNull(); // bm_period_same_business
    });

    it('requires a label for an "other" metric', async () => {
      const { error } = await A.from('business_metrics').insert({
        business_id: aBiz,
        metric_key: 'other',
        value: 1,
      });
      expect(error).not.toBeNull(); // bm_other_requires_label
    });
  });
});

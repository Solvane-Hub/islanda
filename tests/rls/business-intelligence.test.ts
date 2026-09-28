import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  adminConfigured,
  anonClient,
  archiveAll,
  rlsConfigured,
  RUN,
  signIn,
  type Db,
} from './client';

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
  let aDoc: string, aMetric: string, aGoal: string, bDoc: string;

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

    const { data: bdoc, error: bdErr } = await B.from('business_documents')
      .insert({ business_id: bBiz, document_type: 'financial_statement', title: `${RUN} b-doc` })
      .select('id')
      .single();
    if (bdErr) throw new Error(`b doc setup: ${bdErr.message}`);
    bDoc = bdoc.id;

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

    it('rejects a metric referencing another business’s document (composite FK)', async () => {
      const { error } = await A.from('business_metrics').insert({
        business_id: aBiz,
        metric_key: 'revenue',
        value: 1,
        source_document_id: bDoc, // belongs to tenant B
      });
      expect(error).not.toBeNull(); // bm_document_same_business
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

  /**
   * actor_id — historical attribution retrofit (ADR-0022, post-competition
   * Milestone 2). Nullable, ON DELETE SET NULL, not part of RLS: business_id /
   * app.business_access() stays the only tenant boundary these tables have.
   * These tests exist to prove that addition holds, not to re-prove RLS itself.
   */
  describe('actor_id — historical attribution retrofit', () => {
    it('an authenticated insert stores the signed-in founder as actor_id', async () => {
      const { data: metric, error: mErr } = await A.from('business_metrics')
        .insert({ business_id: aBiz, metric_key: 'expenses', value: 42, actor_id: aId })
        .select('actor_id')
        .single();
      expect(mErr).toBeNull();
      expect(metric?.actor_id).toBe(aId);

      const { data: goal, error: gErr } = await A.from('business_goals')
        .insert({
          business_id: aBiz,
          goal_type: 'revenue_target',
          title: `${RUN} actor-attributed goal`,
          actor_id: aId,
        })
        .select('actor_id')
        .single();
      expect(gErr).toBeNull();
      expect(goal?.actor_id).toBe(aId);

      const { data: doc, error: dErr } = await A.from('business_documents')
        .insert({
          business_id: aBiz,
          document_type: 'financial_statement',
          title: `${RUN} actor-attributed doc`,
          actor_id: aId,
        })
        .select('actor_id')
        .single();
      expect(dErr).toBeNull();
      expect(doc?.actor_id).toBe(aId);
    });

    it('an insert omitting actor_id succeeds with actor_id null — legacy rows remain valid', async () => {
      const { data, error } = await A.from('business_metrics')
        .insert({ business_id: aBiz, metric_key: 'expenses', value: 7 })
        .select('id, actor_id')
        .single();
      expect(error).toBeNull();
      expect(data?.actor_id).toBeNull();

      // Untouched by the retrofit: still readable under the exact same policy.
      const { data: check } = await A.from('business_metrics').select('id').eq('id', data!.id);
      expect(check).toHaveLength(1);
    });

    it('does not become a new access boundary — B still cannot reach an actor-attributed row of A’s', async () => {
      const { data: metric } = await A.from('business_metrics')
        .insert({ business_id: aBiz, metric_key: 'expenses', value: 9, actor_id: aId })
        .select('id')
        .single();

      const { data } = await B.from('business_metrics').select('id').eq('id', metric!.id);
      expect(data ?? []).toHaveLength(0); // exactly as before — business_id decides this, not actor_id
    });

    it('anonymous still cannot write a row, actor_id payload or not', async () => {
      const { error } = await anon.from('business_metrics').insert({
        business_id: aBiz,
        metric_key: 'expenses',
        value: 1,
        actor_id: aId,
      });
      expect(error).not.toBeNull();
    });

    describe.skipIf(!adminConfigured)('deleting the auth user (live ON DELETE SET NULL)', () => {
      it('clears actor_id but leaves the business record intact', async () => {
        const admin = adminClient();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: `actor-retrofit-${RUN}@foundryai-test.dev`,
          password: `Retrofit-${RUN}-Aa1!`,
          email_confirm: true,
        });
        if (createErr || !created.user) {
          throw new Error(`Could not create throwaway user: ${createErr?.message}`);
        }
        const throwawayId = created.user.id;

        try {
          const { data: metric, error: insertErr } = await A.from('business_metrics')
            .insert({
              business_id: aBiz,
              metric_key: 'expenses',
              value: 13,
              actor_id: throwawayId,
            })
            .select('id, actor_id')
            .single();
          expect(insertErr).toBeNull();
          expect(metric?.actor_id).toBe(throwawayId);

          const { error: deleteErr } = await admin.auth.admin.deleteUser(throwawayId);
          expect(deleteErr).toBeNull();

          const { data: after, error: afterErr } = await A.from('business_metrics')
            .select('id, actor_id')
            .eq('id', metric!.id)
            .single();
          expect(afterErr).toBeNull();
          // The row survives the user's deletion — SET NULL, not CASCADE or RESTRICT.
          expect(after?.id).toBe(metric!.id);
          expect(after?.actor_id).toBeNull();
        } finally {
          // In case an assertion above throws before the delete step runs.
          await admin.auth.admin.deleteUser(throwawayId).catch(() => {});
        }
      });
    });
  });

  describe('document storage is private and per-business', () => {
    const bucket = 'business-documents';
    const objectPath = () => `${aBiz}/rls-${RUN}/probe.txt`;

    it('A can upload and sign a URL for its own document object', async () => {
      const path = objectPath();
      const signed = await A.storage.from(bucket).createSignedUploadUrl(path);
      expect(signed.error).toBeNull();
      const up = await A.storage
        .from(bucket)
        .uploadToSignedUrl(path, signed.data!.token, new Blob(['probe']));
      expect(up.error).toBeNull();

      const dl = await A.storage.from(bucket).createSignedUrl(path, 60);
      expect(dl.error).toBeNull();
      expect(typeof dl.data?.signedUrl).toBe('string');
    });

    it('B cannot sign a URL for A’s document object', async () => {
      const dl = await B.storage.from(bucket).createSignedUrl(objectPath(), 60);
      expect(dl.error).not.toBeNull(); // storage SELECT policy denies
    });

    it('anonymous cannot sign a URL for A’s document object', async () => {
      const dl = await anon.storage.from(bucket).createSignedUrl(objectPath(), 60);
      expect(dl.error).not.toBeNull();
    });

    it('B cannot mint an upload URL under A’s business folder', async () => {
      const attempt = await B.storage
        .from(bucket)
        .createSignedUploadUrl(`${aBiz}/rls-${RUN}/intrusion.txt`);
      expect(attempt.error).not.toBeNull(); // storage INSERT policy denies
    });
  });
});

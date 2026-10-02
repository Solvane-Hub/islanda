import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Row Level Security — Generalized Evidence Linkage (P8 / ADR-0022).
 *
 * Proves the four load-bearing guarantees of `business_evidence` and its four
 * typed subject-link tables:
 *
 *  1. The exclusive-arc CHECK — exactly one source, never zero, never both.
 *  2. Tenant isolation on `business_evidence` itself, via `app.business_access`.
 *  3. Cross-business SUBJECT linkage is rejected by the composite foreign keys
 *     (not merely by RLS) — evidence from business A cannot attach to a
 *     subject owned by business B, even when the caller legitimately owns
 *     business A.
 *  4. Subject-link rows are immutable (no UPDATE, no DELETE), and
 *     `business_evidence` itself can never be deleted.
 *
 * `business_regulatory_requirements` has no authenticated INSERT policy
 * (its state is service-derived, per `20260814000000_regulatory_domain.sql`),
 * so its two fixture rows here are seeded through the admin/service-role
 * client — exactly as the real application service would — not through the
 * RLS-scoped test clients.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — business evidence (P8 / ADR-0022)', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBiz: string, bBiz: string;
  let aDoc: string, bDoc: string;
  let aMetric: string, bMetric: string;
  let aGoal: string, bGoal: string;
  let aCase: string, bCase: string;
  let aRequirement: string, bRequirement: string;
  let regRequirementId: string;
  let realChunkId: string;
  let aEvidenceDoc: string; // A's evidence row citing aDoc
  let bEvidenceDoc: string; // B's evidence row citing bDoc

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
    aBiz = await mkBiz(A, aId, `${RUN}-evidence-alpha`);
    bBiz = await mkBiz(B, bId, `${RUN}-evidence-beta`);

    const mkDoc = async (db: Db, businessId: string, title: string) => {
      const { data, error } = await db
        .from('business_documents')
        .insert({ business_id: businessId, document_type: 'licence', title })
        .select('id')
        .single();
      if (error) throw new Error(`doc setup: ${error.message}`);
      return data.id as string;
    };
    aDoc = await mkDoc(A, aBiz, `${RUN} a-doc`);
    bDoc = await mkDoc(B, bBiz, `${RUN} b-doc`);

    const mkMetric = async (db: Db, businessId: string) => {
      const { data, error } = await db
        .from('business_metrics')
        .insert({ business_id: businessId, metric_key: 'revenue', value: 1000 })
        .select('id')
        .single();
      if (error) throw new Error(`metric setup: ${error.message}`);
      return data.id as string;
    };
    aMetric = await mkMetric(A, aBiz);
    bMetric = await mkMetric(B, bBiz);

    const mkGoal = async (db: Db, businessId: string, title: string) => {
      const { data, error } = await db
        .from('business_goals')
        .insert({ business_id: businessId, goal_type: 'revenue_target', title })
        .select('id')
        .single();
      if (error) throw new Error(`goal setup: ${error.message}`);
      return data.id as string;
    };
    aGoal = await mkGoal(A, aBiz, `${RUN} a-goal`);
    bGoal = await mkGoal(B, bBiz, `${RUN} b-goal`);

    const mkCase = async (db: Db, businessId: string, ownerId: string, title: string) => {
      const { data, error } = await db
        .from('business_cases')
        .insert({
          business_id: businessId,
          title,
          objective: 'Evidence-linkage RLS fixture case.',
          owner_id: ownerId,
        })
        .select('id')
        .single();
      if (error) throw new Error(`case setup: ${error.message}`);
      return data.id as string;
    };
    aCase = await mkCase(A, aBiz, aId, `${RUN} a-case`);
    bCase = await mkCase(B, bBiz, bId, `${RUN} b-case`);

    const admin = createAdminClient();
    if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured for test setup');

    const { data: chunk, error: chunkErr } = await admin
      .from('knowledge_chunks')
      .select('chunk_id')
      .limit(1)
      .single();
    if (chunkErr || !chunk)
      throw new Error(`no knowledge_chunks fixture available: ${chunkErr?.message}`);
    realChunkId = chunk.chunk_id as string;

    const { data: req, error: reqErr } = await admin
      .from('regulatory_requirements')
      .insert({
        jurisdiction: 'BS',
        title: `${RUN} evidence-test requirement`,
        description: 'Fixture requirement for evidence-linkage RLS tests.',
        regulatory_domain: 'test',
        requirement_type: 'test',
        status: 'draft',
      })
      .select('id')
      .single();
    if (reqErr) throw new Error(`requirement setup: ${reqErr.message}`);
    regRequirementId = req.id as string;

    const mkBrr = async (businessId: string) => {
      const { data, error } = await admin
        .from('business_regulatory_requirements')
        .insert({ business_id: businessId, requirement_id: regRequirementId, state: 'applicable' })
        .select('id')
        .single();
      if (error) throw new Error(`business_regulatory_requirement setup: ${error.message}`);
      return data.id as string;
    };
    aRequirement = await mkBrr(aBiz);
    bRequirement = await mkBrr(bBiz);

    // Baseline evidence rows reused across the cross-business linkage tests.
    const mkEvidence = async (db: Db, businessId: string, documentId: string, actorId: string) => {
      const { data, error } = await db
        .from('business_evidence')
        .insert({
          business_id: businessId,
          document_id: documentId,
          provenance: 'user_document',
          actor_id: actorId,
        })
        .select('id')
        .single();
      if (error) throw new Error(`evidence setup: ${error.message}`);
      return data.id as string;
    };
    aEvidenceDoc = await mkEvidence(A, aBiz, aDoc, aId);
    bEvidenceDoc = await mkEvidence(B, bBiz, bDoc, bId);
  }, 30_000);

  afterAll(async () => {
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from('business_regulatory_requirements')
        .delete()
        .eq('requirement_id', regRequirementId);
      await admin.from('regulatory_requirements').delete().eq('id', regRequirementId);
    }
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  describe('exclusive-arc source model', () => {
    it('accepts a document-only source', async () => {
      const { data, error } = await A.from('business_evidence')
        .insert({
          business_id: aBiz,
          document_id: aDoc,
          provenance: 'user_document',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it('accepts a knowledge-chunk-only source', async () => {
      const { data, error } = await A.from('business_evidence')
        .insert({
          business_id: aBiz,
          knowledge_chunk_id: realChunkId,
          provenance: 'external_public_data',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it('rejects neither source populated', async () => {
      const { error } = await A.from('business_evidence').insert({
        business_id: aBiz,
        provenance: 'founder_provided',
      } as never);
      expect(error).not.toBeNull(); // be_exactly_one_source
    });

    it('rejects both sources populated', async () => {
      const { error } = await A.from('business_evidence').insert({
        business_id: aBiz,
        document_id: aDoc,
        knowledge_chunk_id: realChunkId,
        provenance: 'user_document',
      } as never);
      expect(error).not.toBeNull(); // be_exactly_one_source
    });
  });

  describe('tenant isolation on business_evidence', () => {
    it('B cannot create evidence for business A', async () => {
      const { error } = await B.from('business_evidence').insert({
        business_id: aBiz,
        document_id: aDoc,
        provenance: 'user_document',
      } as never);
      expect(error).not.toBeNull(); // with check (app.business_access(business_id))
    });

    it('B cannot read business A’s evidence', async () => {
      const { data } = await B.from('business_evidence').select('id').eq('id', aEvidenceDoc);
      expect(data ?? []).toHaveLength(0);
    });

    it('B cannot update business A’s evidence', async () => {
      const { data } = await B.from('business_evidence')
        .update({ verification_state: 'verified' })
        .eq('id', aEvidenceDoc)
        .select('id');
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await A.from('business_evidence')
        .select('verification_state')
        .eq('id', aEvidenceDoc);
      expect(check?.[0]?.verification_state).toBe('unverified'); // unchanged
    });

    it('anonymous users cannot read or write business_evidence', async () => {
      const read = await anon.from('business_evidence').select('id');
      expect(read.data ?? []).toHaveLength(0);

      const write = await anon.from('business_evidence').insert({
        business_id: aBiz,
        document_id: aDoc,
        provenance: 'user_document',
      } as never);
      expect(write.error).not.toBeNull();
    });
  });

  describe('cross-business subject linkage — rejected by the composite foreign keys', () => {
    it('rejects evidence from A attached to a metric owned by B', async () => {
      const { data, error } = await A.from('business_evidence_for_metrics')
        .insert({
          business_id: aBiz,
          evidence_id: aEvidenceDoc,
          metric_id: bMetric,
          relationship: 'supports',
          actor_id: aId,
        })
        .select('id');
      expect(error).not.toBeNull(); // befm_metric_same_business
      expect(data ?? []).toHaveLength(0);
    });

    it('rejects evidence from B attached to a metric owned by A (reverse direction)', async () => {
      const { error } = await A.from('business_evidence_for_metrics').insert({
        business_id: aBiz,
        evidence_id: bEvidenceDoc,
        metric_id: aMetric,
        relationship: 'supports',
      } as never);
      expect(error).not.toBeNull(); // befm_evidence_same_business
    });

    it('rejects evidence from A attached to a goal owned by B', async () => {
      const { error } = await A.from('business_evidence_for_goals').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        goal_id: bGoal,
        relationship: 'supports',
        actor_id: aId,
      });
      expect(error).not.toBeNull(); // befg_goal_same_business
    });

    it('rejects evidence from A attached to a case owned by B', async () => {
      const { error } = await A.from('business_evidence_for_cases').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        case_id: bCase,
        relationship: 'supports',
        actor_id: aId,
      });
      expect(error).not.toBeNull(); // befc_case_same_business
    });

    it('rejects evidence from A attached to a regulatory requirement state owned by B', async () => {
      const { error } = await A.from('business_evidence_for_requirements').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        business_regulatory_requirement_id: bRequirement,
        relationship: 'supports',
        actor_id: aId,
      });
      expect(error).not.toBeNull(); // befr_requirement_same_business
    });

    it('accepts a same-business link for every subject type', async () => {
      const metricLink = await A.from('business_evidence_for_metrics')
        .insert({
          business_id: aBiz,
          evidence_id: aEvidenceDoc,
          metric_id: aMetric,
          relationship: 'supports',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(metricLink.error).toBeNull();

      const goalLink = await A.from('business_evidence_for_goals')
        .insert({
          business_id: aBiz,
          evidence_id: aEvidenceDoc,
          goal_id: aGoal,
          relationship: 'supports',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(goalLink.error).toBeNull();

      const caseLink = await A.from('business_evidence_for_cases')
        .insert({
          business_id: aBiz,
          evidence_id: aEvidenceDoc,
          case_id: aCase,
          relationship: 'derived_from',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(caseLink.error).toBeNull();

      const requirementLink = await A.from('business_evidence_for_requirements')
        .insert({
          business_id: aBiz,
          evidence_id: aEvidenceDoc,
          business_regulatory_requirement_id: aRequirement,
          relationship: 'supports',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(requirementLink.error).toBeNull();
    });

    it('B cannot read A’s subject-link rows', async () => {
      const { data } = await B.from('business_evidence_for_metrics')
        .select('id')
        .eq('business_id', aBiz);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('link immutability', () => {
    it('cannot UPDATE a business_evidence_for_metrics row', async () => {
      const { error } = await A.from('business_evidence_for_metrics')
        .update({ relationship: 'derived_from' } as never)
        .eq('evidence_id', aEvidenceDoc)
        .eq('metric_id', aMetric);
      expect(error).not.toBeNull(); // no UPDATE grant/policy
    });

    it('cannot DELETE a business_evidence_for_metrics row', async () => {
      const { error, data } = await A.from('business_evidence_for_metrics')
        .delete()
        .eq('evidence_id', aEvidenceDoc)
        .eq('metric_id', aMetric)
        .select('id');
      expect(error).not.toBeNull(); // no DELETE grant/policy
      expect(data ?? []).toHaveLength(0);

      const { data: stillThere } = await A.from('business_evidence_for_metrics')
        .select('id')
        .eq('evidence_id', aEvidenceDoc)
        .eq('metric_id', aMetric);
      expect(stillThere).toHaveLength(1);
    });
  });

  describe('evidence deletion is impossible', () => {
    it('a founder cannot delete their own business_evidence row', async () => {
      const { error, data } = await A.from('business_evidence')
        .delete()
        .eq('id', aEvidenceDoc)
        .select('id');
      expect(error).not.toBeNull(); // no DELETE grant/policy
      expect(data ?? []).toHaveLength(0);

      const { data: stillThere } = await A.from('business_evidence')
        .select('id')
        .eq('id', aEvidenceDoc);
      expect(stillThere).toHaveLength(1);
    });
  });

  describe('valid relationship values', () => {
    it('accepts "supports"', async () => {
      const { error } = await A.from('business_evidence_for_metrics').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        metric_id: aMetric,
        relationship: 'supports',
        actor_id: aId,
      });
      expect(error).toBeNull();
    });

    it('accepts "derived_from"', async () => {
      const { error } = await A.from('business_evidence_for_metrics').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        metric_id: aMetric,
        relationship: 'derived_from',
        actor_id: aId,
      });
      expect(error).toBeNull();
    });

    it('rejects a relationship value outside the enum', async () => {
      const { error } = await A.from('business_evidence_for_metrics').insert({
        business_id: aBiz,
        evidence_id: aEvidenceDoc,
        metric_id: aMetric,
        relationship: 'verifies',
      } as never);
      expect(error).not.toBeNull(); // invalid input value for enum evidence_relationship_type
    });
  });

  describe('global knowledge evidence', () => {
    it('a valid knowledge chunk can be cited by more than one business without implying ownership', async () => {
      const aCite = await A.from('business_evidence')
        .insert({
          business_id: aBiz,
          knowledge_chunk_id: realChunkId,
          provenance: 'external_public_data',
          actor_id: aId,
        })
        .select('id')
        .single();
      expect(aCite.error).toBeNull();

      const bCite = await B.from('business_evidence')
        .insert({
          business_id: bBiz,
          knowledge_chunk_id: realChunkId,
          provenance: 'external_public_data',
          actor_id: bId,
        })
        .select('id')
        .single();
      expect(bCite.error).toBeNull();

      // Neither business's evidence row is visible to the other, even though
      // both cite the same global chunk.
      const bReadsA = await B.from('business_evidence').select('id').eq('id', aCite.data!.id);
      expect(bReadsA.data ?? []).toHaveLength(0);
    });
  });
});

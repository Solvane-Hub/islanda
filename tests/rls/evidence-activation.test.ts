import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';
import {
  attachMetricEvidence,
  getEvidenceForMetrics,
  getMetricEvidence,
} from '@/services/evidence';
import { AppError } from '@/lib/errors';

/**
 * Evidence activation (P8 → real capability, ADR-0022, post-competition
 * Milestone 3) — DOCUMENT → EVIDENCE → FINANCIAL METRIC.
 *
 * These tests exercise the real `services/evidence` functions against real
 * signed-in sessions, not just the raw table/RLS layer `business-evidence.test.ts`
 * already covers. Two guarantees this milestone adds cannot be proven by RLS
 * alone: the service's own cross-business re-check (a metric and a document
 * the caller genuinely owns, but not the same business), and that `actor_id`
 * always comes from the server-resolved caller, never anything in the input.
 *
 * Skipped unless the RLS environment is configured (CI requires it).
 */
describe.skipIf(!rlsConfigured)('Evidence activation — document → metric', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBiz: string, bBiz: string;
  let aMetric: string, aMetric2: string, bMetric: string;
  let aDoc: string, bDoc: string;

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
    aBiz = await mkBiz(A, aId, `${RUN}-ev-alpha`);
    bBiz = await mkBiz(B, bId, `${RUN}-ev-beta`);

    const mkMetric = async (db: Db, biz: string, value: number) => {
      const { data, error } = await db
        .from('business_metrics')
        .insert({ business_id: biz, metric_key: 'expenses', value })
        .select('id')
        .single();
      if (error) throw new Error(`metric setup: ${error.message}`);
      return data.id as string;
    };
    aMetric = await mkMetric(A, aBiz, 100);
    aMetric2 = await mkMetric(A, aBiz, 200);
    bMetric = await mkMetric(B, bBiz, 300);

    const mkDoc = async (db: Db, biz: string, title: string) => {
      const { data, error } = await db
        .from('business_documents')
        .insert({ business_id: biz, document_type: 'financial_statement', title })
        .select('id')
        .single();
      if (error) throw new Error(`doc setup: ${error.message}`);
      return data.id as string;
    };
    aDoc = await mkDoc(A, aBiz, `${RUN} A statement`);
    bDoc = await mkDoc(B, bBiz, `${RUN} B statement`);
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  it('1. attaches a document from Business A to a metric from Business A', async () => {
    const result = await attachMetricEvidence(A, aId, {
      businessId: aBiz,
      metricId: aMetric,
      documentId: aDoc,
    });
    expect(result.documentId).toBe(aDoc);
    expect(result.documentTitle).toBe(`${RUN} A statement`);
    expect(result.provenance).toBe('user_document');
  });

  it('2. rejects attaching a document from a different business', async () => {
    await expect(
      attachMetricEvidence(A, aId, { businessId: aBiz, metricId: aMetric2, documentId: bDoc }),
    ).rejects.toThrow(AppError);
  });

  it('3. rejects attaching to a metric from a different business', async () => {
    await expect(
      attachMetricEvidence(A, aId, { businessId: aBiz, metricId: bMetric, documentId: aDoc }),
    ).rejects.toThrow(AppError);
  });

  it('4. anonymous cannot attach evidence', async () => {
    await expect(
      attachMetricEvidence(anon, 'not-a-real-session', {
        businessId: aBiz,
        metricId: aMetric2,
        documentId: aDoc,
      }),
    ).rejects.toThrow(AppError);
  });

  it('5. attached evidence can be retrieved for the metric', async () => {
    const evidence = await getMetricEvidence(A, aBiz, aMetric);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.documentId).toBe(aDoc);
    expect(evidence[0]?.documentTitle).toBe(`${RUN} A statement`);
  });

  it('6. evidence remains isolated by business', async () => {
    // B, reading with its OWN business id, never sees A's link even though it
    // knows A's metric id — the query is scoped by business_id, not guessable ids.
    const asB = await getEvidenceForMetrics(B, bBiz, [aMetric]);
    expect(asB[aMetric] ?? []).toHaveLength(0);

    // RLS itself also denies B the underlying rows directly.
    const { data: linkRows } = await B.from('business_evidence_for_metrics')
      .select('id')
      .eq('metric_id', aMetric);
    expect(linkRows ?? []).toHaveLength(0);
  });

  it('7. preserves the P8 exclusive-arc rule — evidence always has exactly one source', async () => {
    const { data: row } = await A.from('business_evidence')
      .select('document_id, knowledge_chunk_id')
      .eq('document_id', aDoc)
      .single();
    expect(row?.document_id).toBe(aDoc);
    expect(row?.knowledge_chunk_id).toBeNull();
  });

  it('8. actor_id always comes from the authenticated server context, never the input', async () => {
    // Nothing in `AttachMetricEvidenceInput` can carry an actor id — even a
    // caller that manages to smuggle one onto the object at the JS level
    // (bypassing the type system) cannot affect what gets stored.
    const spoofed = {
      businessId: aBiz,
      metricId: aMetric2,
      documentId: aDoc,
      actorId: bId, // not a real field on the input type
    };
    const result = await attachMetricEvidence(
      A,
      aId,
      spoofed as Parameters<typeof attachMetricEvidence>[2],
    );

    const { data: evidenceRow } = await A.from('business_evidence')
      .select('actor_id')
      .eq('id', result.evidenceId)
      .single();
    const { data: linkRow } = await A.from('business_evidence_for_metrics')
      .select('actor_id')
      .eq('id', result.linkId)
      .single();
    expect(evidenceRow?.actor_id).toBe(aId);
    expect(linkRow?.actor_id).toBe(aId);
    expect(evidenceRow?.actor_id).not.toBe(bId);
  });

  it('9. existing metric behavior is unchanged when no evidence exists', async () => {
    const { data, error } = await A.from('business_metrics')
      .insert({ business_id: aBiz, metric_key: 'revenue', value: 50 })
      .select('id, value')
      .single();
    expect(error).toBeNull();
    expect(Number(data?.value)).toBe(50);
    const evidence = await getMetricEvidence(A, aBiz, data!.id);
    expect(evidence).toHaveLength(0);
  });

  it('10. existing document behavior is unchanged', async () => {
    const { data, error } = await A.from('business_documents')
      .insert({ business_id: aBiz, document_type: 'invoice', title: `${RUN} unrelated invoice` })
      .select('id, title')
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe(`${RUN} unrelated invoice`);
    // Creating a document does not implicitly create an evidence link.
    const { data: allEvidence } = await A.from('business_evidence')
      .select('id')
      .eq('document_id', data!.id);
    expect(allEvidence ?? []).toHaveLength(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';
import { assembleBusinessPassport, type BusinessPassport } from '@/services/passport';
import { assembleBusinessFacts } from '@/services/business/facts';
import { attachMetricEvidence } from '@/services/evidence';

/**
 * Business Passport (P7 Milestone 4) — a read-only composed view, not a
 * fourth business-facts derivation and not a Nova context. These tests prove
 * the composition is correct and safe; they do not re-prove RLS on the
 * individual tables it composes from (each already has its own suite).
 */
describe.skipIf(!rlsConfigured)('Business Passport — read-only composition', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBiz: string, bBiz: string;
  let aMetric: string;
  let aDoc: string;

  beforeAll(async () => {
    ({ db: A, userId: aId } = await signIn('A'));
    ({ db: B, userId: bId } = await signIn('B'));
    anon = anonClient();
    await archiveAll(A, aId, RUN);
    await archiveAll(B, bId, RUN);

    const mkBiz = async (db: Db, owner: string, name: string) => {
      const { data, error } = await db
        .from('businesses')
        .insert({ owner_id: owner, name, country_code: 'BS', business_mode: 'manage' })
        .select('id')
        .single();
      if (error) throw new Error(`biz setup: ${error.message}`);
      return data.id as string;
    };
    aBiz = await mkBiz(A, aId, `${RUN}-passport-alpha`);
    bBiz = await mkBiz(B, bId, `${RUN}-passport-beta`);
    void bBiz; // B just needs to be a real, separate tenant for the cross-business check

    const { data: identifier, error: idErr } = await A.from('business_identifiers')
      .insert({
        business_id: aBiz,
        identifier_type: 'tax_identification_number',
        value: 'PASSPORT-TEST-SECRET',
      })
      .select('id')
      .single();
    if (idErr) throw new Error(`identifier setup: ${idErr.message}`);
    void identifier;

    const { data: goal, error: gErr } = await A.from('business_goals')
      .insert({
        business_id: aBiz,
        goal_type: 'revenue_target',
        title: `${RUN} passport goal`,
        target_metric_key: 'revenue',
        target_value: 100000,
      })
      .select('id')
      .single();
    if (gErr) throw new Error(`goal setup: ${gErr.message}`);
    void goal;

    const { data: metric, error: mErr } = await A.from('business_metrics')
      .insert({ business_id: aBiz, metric_key: 'revenue', value: 25000, currency: 'BSD' })
      .select('id')
      .single();
    if (mErr) throw new Error(`metric setup: ${mErr.message}`);
    aMetric = metric.id;

    const { data: doc, error: dErr } = await A.from('business_documents')
      .insert({
        business_id: aBiz,
        document_type: 'financial_statement',
        title: `${RUN} passport statement`,
      })
      .select('id')
      .single();
    if (dErr) throw new Error(`document setup: ${dErr.message}`);
    aDoc = doc.id;

    await attachMetricEvidence(A, aId, { businessId: aBiz, metricId: aMetric, documentId: aDoc });
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  it('an authorized business receives its Passport', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport).not.toBeNull();
    expect(passport?.businessId).toBe(aBiz);
    expect(passport?.mode).toBe('manage');
  });

  it('cross-business access returns null, matching assembleBusinessFacts', async () => {
    const passport = await assembleBusinessPassport(B, aBiz);
    expect(passport).toBeNull();
  });

  it('anonymous access returns null', async () => {
    const passport = await assembleBusinessPassport(anon, aBiz);
    expect(passport).toBeNull();
  });

  it('sensitive identifiers never appear anywhere in the Passport', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport).not.toBeNull();

    // No top-level, identity, or definition key resembles an identifier field.
    const forbidden = /identifier|registration|tax|vat/i;
    for (const key of Object.keys(passport as BusinessPassport)) {
      expect(forbidden.test(key), key).toBe(false);
    }
    for (const key of Object.keys(passport!.identity)) {
      expect(forbidden.test(key), key).toBe(false);
    }
    for (const key of Object.keys(passport!.definition)) {
      expect(forbidden.test(key), key).toBe(false);
    }
    // And the secret value itself is nowhere in the serialized Passport.
    expect(JSON.stringify(passport)).not.toContain('PASSPORT-TEST-SECRET');
  });

  it('includes real recorded financials', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport?.financials.hasData).toBe(true);
    const revenue = passport?.financials.recorded.find((m) => m.key === 'revenue');
    expect(revenue?.value).toBe(25000);
    expect(revenue?.id).toBe(aMetric);
  });

  it('includes real goals', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport?.goals.some((g) => g.goal.title === `${RUN} passport goal`)).toBe(true);
  });

  it('includes real documents, projected to the safe subset only', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    const doc = passport?.documents.find((d) => d.id === aDoc);
    expect(doc?.title).toBe(`${RUN} passport statement`);
    expect(doc?.documentType).toBe('financial_statement');
    // Only the audited safe fields — nothing storage- or security-related.
    expect(Object.keys(doc as object).sort()).toEqual(
      ['createdAt', 'documentDate', 'documentType', 'id', 'processingStatus', 'title'].sort(),
    );
  });

  it('includes attached metric evidence, naming the document but never its contents', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    const evidence = passport?.evidenceForMetrics[aMetric];
    expect(evidence).toHaveLength(1);
    expect(evidence?.[0]?.documentTitle).toBe(`${RUN} passport statement`);
    expect(evidence?.[0]?.provenance).toBe('user_document');

    // No field anywhere in the evidence view could be mistaken for extracted
    // document content — only identity/type/provenance metadata.
    const evidenceKeys = Object.keys(evidence![0]!);
    const contentLike = /content|text|quote|summary|extract/i;
    for (const key of evidenceKeys) {
      expect(contentLike.test(key), key).toBe(false);
    }
  });

  it('represents empty regulatory state honestly, not as invented compliance status', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport?.regulatory.requirements).toEqual([]);
  });

  it('does not surface business cases at all — omitted by design, not just empty', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect('cases' in (passport as object)).toBe(false);
  });

  it('identity and definition stay consistent with assembleBusinessFacts directly', async () => {
    const [passport, facts] = await Promise.all([
      assembleBusinessPassport(A, aBiz),
      assembleBusinessFacts(A, aBiz),
    ]);
    expect(passport?.identity.legalName).toBe(facts?.legalName);
    expect(passport?.identity.tradingName).toBe(facts?.tradingName);
    expect(passport?.identity.businessType).toBe(facts?.businessType);
    expect(passport?.identity.industry).toBe(facts?.industry);
    expect(passport?.identity.countryCode).toBe(facts?.countryCode);
    expect(passport?.identity.stage).toBe(facts?.stage);
    expect(passport?.identity.operatingStatus).toBe(facts?.operatingStatus);
    expect(passport?.definition.activities).toBe(facts?.activities);
    expect(passport?.definition.productsServices).toBe(facts?.productsServices);
    expect(passport?.definition.targetCustomers).toBe(facts?.targetCustomers);
    expect(passport?.definition.location).toBe(facts?.location);
    expect(passport?.definition.employeeCount).toBe(facts?.employeeCount);
    expect(passport?.definition.founderGoals).toBe(facts?.founderGoals);
    expect(passport?.mode).toBe(facts?.businessMode);
  });

  it('completeness is derived, not invented, and reflects real data', async () => {
    const passport = await assembleBusinessPassport(A, aBiz);
    expect(passport?.completeness.hasFinancials).toBe(true);
    expect(passport?.completeness.hasGoals).toBe(true);
    expect(passport?.completeness.hasDocuments).toBe(true);
    expect(passport?.completeness.intake.total).toBeGreaterThan(0);
  });
});

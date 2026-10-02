import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assembleBusinessFacts, type BusinessFacts } from '@/services/business/facts';
import { assembleIntelligenceContext } from '@/services/intelligence/context';
import { toNovaBusinessFacts } from '@/services/nova/business-awareness';
import { getActiveCountries } from '@/services/business';
import { anonClient, archiveAll, rlsConfigured, RUN, signIn, type Db } from './client';

/**
 * P7 Milestone 1 — the shared business facts contract.
 *
 * `assembleBusinessFacts` is the one canonical fetch+derive both Regulatory
 * Nova (P1) and Financial Nova (P6) can build on. Its correctness depends on
 * `getBusinessObject`'s existing RLS-scoped read, so this suite runs against
 * real signed-in tenants (tests/rls/client.ts), not mocks — a policy
 * regression here would silently leak or hide facts across every consumer.
 *
 * Skipped unless the RLS environment is configured; CI sets
 * RLS_TESTS_REQUIRED=1 so a silent skip is a failure there.
 */
describe.skipIf(!rlsConfigured)('Shared business facts contract', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;
  let aBusinessId: string;
  let bareBusinessId: string; // A's second business — no profile row at all

  beforeAll(async () => {
    ({ db: A, userId: aId } = await signIn('A'));
    ({ db: B, userId: bId } = await signIn('B'));
    anon = anonClient();

    await archiveAll(A, aId, RUN);
    await archiveAll(B, bId, RUN);

    const { data: biz, error } = await A.from('businesses')
      .insert({
        owner_id: aId,
        name: `${RUN}-facts-alpha`,
        country_code: 'BS',
        business_mode: 'manage',
        legal_name: `${RUN} Facts Ltd`,
        trading_name: `${RUN} Facts`,
        business_type: 'company',
        industry: 'agriculture',
      })
      .select('id')
      .single();
    if (error) throw new Error(`Setup failed: ${error.message}`);
    aBusinessId = biz.id;

    const { error: pErr } = await A.from('business_profiles').insert({
      business_id: aBusinessId,
      business_activities: 'Growing and packaging produce',
      products_services: 'Fresh vegetables',
      target_customers: 'Local grocers',
      location: 'Nassau',
      business_stage: 'early_revenue',
      operating_status: 'operating',
      employee_count: 4,
      founder_goals: 'Expand to two more islands',
    });
    if (pErr) throw new Error(`Setup failed (profile): ${pErr.message}`);

    const { data: bare, error: bareErr } = await A.from('businesses')
      .insert({
        owner_id: aId,
        name: `${RUN}-facts-bare`,
        country_code: 'BS',
        business_mode: 'manage',
      })
      .select('id')
      .single();
    if (bareErr) throw new Error(`Setup failed (bare business): ${bareErr.message}`);
    bareBusinessId = bare.id;
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
  }, 30_000);

  it('returns the correct facts for a business the caller owns', async () => {
    const facts = await assembleBusinessFacts(A, aBusinessId);
    expect(facts).not.toBeNull();
    expect(facts?.legalName).toBe(`${RUN} Facts Ltd`);
    expect(facts?.tradingName).toBe(`${RUN} Facts`);
    expect(facts?.businessType).toBe('company');
    expect(facts?.industry).toBe('agriculture');
    expect(facts?.activities).toBe('Growing and packaging produce');
    expect(facts?.productsServices).toBe('Fresh vegetables');
    expect(facts?.targetCustomers).toBe('Local grocers');
    expect(facts?.location).toBe('Nassau');
    expect(facts?.stage).toBe('early_revenue');
    expect(facts?.operatingStatus).toBe('operating');
    expect(facts?.employeeCount).toBe(4);
    expect(facts?.founderGoals).toBe('Expand to two more islands');
    expect(facts?.countryCode).toBe('BS');
  });

  it('returns null for a business the caller does not own (RLS), not an error or a leak', async () => {
    const facts = await assembleBusinessFacts(B, aBusinessId);
    expect(facts).toBeNull();
  });

  it('returns null for anonymous access', async () => {
    const facts = await assembleBusinessFacts(anon, aBusinessId);
    expect(facts).toBeNull();
  });

  it('handles a business with no profile row — optional fields resolve to null, not a throw', async () => {
    const facts = await assembleBusinessFacts(A, bareBusinessId);
    expect(facts).not.toBeNull();
    expect(facts?.activities).toBeNull();
    expect(facts?.productsServices).toBeNull();
    expect(facts?.targetCustomers).toBeNull();
    expect(facts?.location).toBeNull();
    expect(facts?.stage).toBeNull();
    expect(facts?.operatingStatus).toBeNull();
    expect(facts?.employeeCount).toBeNull();
    expect(facts?.founderGoals).toBeNull();
    expect(facts?.countryCode).toBe('BS');
  });

  it('never exposes sensitive identifiers or fields outside the declared contract', async () => {
    const facts = await assembleBusinessFacts(A, aBusinessId);
    expect(facts).not.toBeNull();
    const expectedKeys = [
      'legalName',
      'tradingName',
      'businessType',
      'industry',
      'activities',
      'productsServices',
      'targetCustomers',
      'location',
      'stage',
      'operatingStatus',
      'employeeCount',
      'founderGoals',
      'countryCode',
      'businessMode',
    ].sort();
    expect(Object.keys(facts as BusinessFacts).sort()).toEqual(expectedKeys);
  });

  it('matches toNovaBusinessFacts exactly — the P1 pathway derives the same facts it always has', async () => {
    const { data: business } = await A.from('businesses')
      .select('legal_name, trading_name, business_type, industry')
      .eq('id', aBusinessId)
      .single();
    const { data: profile } = await A.from('business_profiles')
      .select(
        'business_activities, products_services, target_customers, location, business_stage, operating_status, employee_count, founder_goals',
      )
      .eq('business_id', aBusinessId)
      .single();

    const expected = toNovaBusinessFacts(business!, profile);
    const facts = await assembleBusinessFacts(A, aBusinessId);
    expect(facts).not.toBeNull();
    // countryCode and businessMode are BusinessFacts additions on top of the
    // shared toNovaBusinessFacts vocabulary (P7 Milestone 1 and Milestone 4
    // respectively) — excluded here, not because they're wrong, but because
    // this test's job is to prove the REST matches P1's derivation exactly.
    const {
      countryCode: _countryCode,
      businessMode: _businessMode,
      ...pureFacts
    } = facts as BusinessFacts;
    expect(pureFacts).toEqual(expected);
  });

  it('P6 pathway: assembleIntelligenceContext derives identity/definition from the same shared facts', async () => {
    const context = await assembleIntelligenceContext(A, aBusinessId);
    expect(context).not.toBeNull();
    expect(context?.identity.legalName).toBe(`${RUN} Facts Ltd`);
    expect(context?.identity.tradingName).toBe(`${RUN} Facts`);
    expect(context?.identity.stage).toBe('early_revenue');
    expect(context?.identity.operatingStatus).toBe('operating');
    expect(context?.definition.activities).toBe('Growing and packaging produce');
    expect(context?.definition.location).toBe('Nassau');

    const countries = await getActiveCountries(A);
    const expectedJurisdiction = countries.find((c) => c.code === 'BS')?.name ?? 'BS';
    expect(context?.identity.jurisdiction).toBe(expectedJurisdiction);
  });
});

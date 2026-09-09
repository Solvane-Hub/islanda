import { describe, expect, it } from 'vitest';
import {
  buildBusinessContext,
  toNovaBusinessFacts,
  type NovaBusinessFacts,
} from '@/services/nova/business-awareness';
import type { Business, BusinessProfile } from '@/types/business';

/**
 * Business-aware Nova (P1).
 *
 * These tests hold the boundary: business context reaches Nova, sensitive
 * identifiers cannot, known facts are used where supported, missing facts are
 * reported rather than invented, and nothing here states a legal conclusion.
 */

const EMPTY_FACTS: NovaBusinessFacts = {
  legalName: null,
  tradingName: null,
  businessType: null,
  industry: null,
  activities: null,
  productsServices: null,
  targetCustomers: null,
  location: null,
  stage: null,
  operatingStatus: null,
  employeeCount: null,
  founderGoals: null,
};

const RESTAURANT: NovaBusinessFacts = {
  ...EMPTY_FACTS,
  industry: 'Restaurant',
  location: 'New Providence',
  stage: 'operating',
};

const claim = (statement: string, sectionReference: string | null = null) => ({
  statement,
  sectionReference,
});

describe('toNovaBusinessFacts — non-sensitive only', () => {
  it('maps the Business Object into the fact set', () => {
    const business = {
      legal_name: 'Cay Naturals Ltd',
      trading_name: 'Cay Naturals',
      business_type: 'company',
      industry: 'Skincare',
    } as Pick<Business, 'legal_name' | 'trading_name' | 'business_type' | 'industry'>;
    const profile = {
      business_activities: 'making soap',
      products_services: 'soaps',
      target_customers: 'tourists',
      location: 'Nassau',
      business_stage: 'operating',
      operating_status: 'operating',
      employee_count: 4,
      founder_goals: 'grow',
    } as Pick<
      BusinessProfile,
      | 'business_activities'
      | 'products_services'
      | 'target_customers'
      | 'location'
      | 'business_stage'
      | 'operating_status'
      | 'employee_count'
      | 'founder_goals'
    >;

    const facts = toNovaBusinessFacts(business, profile);

    expect(facts.industry).toBe('Skincare');
    expect(facts.activities).toBe('making soap');
    expect(facts.employeeCount).toBe(4);
  });

  it('has NO field for a sensitive identifier — exclusion is structural', () => {
    const facts = toNovaBusinessFacts(
      { legal_name: null, trading_name: null, business_type: null, industry: 'Skincare' },
      null,
    );
    const keys = Object.keys(facts);
    // The fact set literally cannot name a tax id / registration / licence number.
    for (const forbidden of [
      'taxId',
      'tax_id',
      'registration',
      'identifier',
      'licence',
      'license',
    ]) {
      expect(keys.some((k) => k.toLowerCase().includes(forbidden.toLowerCase()))).toBe(false);
    }
  });

  it('tolerates a business with no profile', () => {
    const facts = toNovaBusinessFacts(
      { legal_name: null, trading_name: null, business_type: null, industry: null },
      null,
    );
    expect(facts.location).toBeNull();
    expect(facts.employeeCount).toBeNull();
  });
});

describe('buildBusinessContext — personalization without fabrication', () => {
  it('frames the answer in the business context, stating facts not law', () => {
    const ctx = buildBusinessContext({
      facts: RESTAURANT,
      question: 'do I need a food handler certificate',
      outcome: 'answered',
      claims: [claim('A person who sells prepared food shall hold a certificate.', 's.3')],
      documents: ['Example Prepared Food Trading Act'],
    });

    expect(ctx).not.toBeNull();
    expect(ctx?.category).toBe('regulatory');
    // Business facts are surfaced…
    expect(ctx?.knownFacts.map((f) => f.label)).toEqual(
      expect.arrayContaining(['Industry', 'Location', 'Stage']),
    );
    // …and the relevance sentence names them, framed as context, not conclusion.
    expect(ctx?.relevance).toContain('New Providence');
    expect(ctx?.relevance?.toLowerCase()).toContain('restaurant');
    expect(ctx?.relevance).toContain('read the published material');
    // It must NOT assert the rule applies.
    expect(ctx?.relevance?.toLowerCase()).not.toContain('you must');
    expect(ctx?.relevance?.toLowerCase()).not.toContain('you need');
  });

  it('reports a missing decisive fact as unknown, never invented (VAT/turnover)', () => {
    const ctx = buildBusinessContext({
      facts: RESTAURANT,
      question: 'do I need to register for VAT?',
      outcome: 'answered',
      claims: [
        claim('Registration is required where taxable supplies exceed the threshold.', 's.5'),
      ],
      documents: ['Value Added Tax Act'],
    });

    const turnover = ctx?.openQuestions.find((q) => /turnover/i.test(q.question));
    expect(turnover).toBeTruthy();
    // Honest gap, not a number.
    expect(turnover?.why.toLowerCase()).toContain("haven't");
    expect(JSON.stringify(ctx)).not.toMatch(/\$\d/); // no fabricated figure
    // One decisive fact → a single focused clarification is offered.
    expect(ctx?.clarifyingQuestion).toBeTruthy();
  });

  it('uses a known fact where supported, rather than asking for it', () => {
    const withTeam: NovaBusinessFacts = { ...RESTAURANT, employeeCount: 6 };
    const ctx = buildBusinessContext({
      facts: withTeam,
      question: 'what are my obligations as an employer?',
      outcome: 'answered',
      claims: [claim('An employer shall register employees for national insurance.', 's.9')],
      documents: ['National Insurance Act'],
    });

    // Team size is known, so it is shown — not asked for.
    expect(ctx?.knownFacts.find((f) => f.label === 'Team')?.value).toContain('6');
    expect(ctx?.openQuestions.some((q) => /employ/i.test(q.question))).toBe(false);
  });

  it('flags headcount when it is unknown and the question is about employment', () => {
    const ctx = buildBusinessContext({
      facts: RESTAURANT, // employeeCount null
      question: 'what are my obligations as an employer?',
      outcome: 'answered',
      claims: [claim('An employer shall register employees for national insurance.', 's.9')],
      documents: ['National Insurance Act'],
    });
    expect(ctx?.openQuestions.some((q) => /employ/i.test(q.question))).toBe(true);
  });

  it('returns null on a refusal — nothing was retrieved to frame', () => {
    for (const outcome of [
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      expect(
        buildBusinessContext({
          facts: RESTAURANT,
          question: 'anything',
          outcome,
          claims: [],
          documents: [],
        }),
      ).toBeNull();
    }
  });

  it('returns null when there is no business context and no decisive gap', () => {
    const ctx = buildBusinessContext({
      facts: EMPTY_FACTS,
      question: 'what records must I keep?',
      outcome: 'answered',
      claims: [claim('Records shall be kept for five years.', 's.12')],
      documents: ['Records Act'],
    });
    expect(ctx).toBeNull();
  });
});

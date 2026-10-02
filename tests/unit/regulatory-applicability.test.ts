import { describe, expect, it } from 'vitest';
import type { Database } from '@/types/database';
import { evaluateApplicability } from '@/services/regulatory/applicability';

type Rule = Database['public']['Tables']['regulatory_applicability_rules']['Row'];

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: crypto.randomUUID(),
    requirement_id: crypto.randomUUID(),
    rule_type: 'custom',
    operator: 'equals',
    field_path: 'business.industry',
    expected_value: 'retail',
    explanation: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('evaluateApplicability', () => {
  it('returns applicable when every rule is satisfied', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'business.industry',
          expected_value: 'retail',
        }),
        rule({
          field_path: 'profile.employee_count',
          operator: 'greater_than_or_equal',
          expected_value: 5,
        }),
      ],
      {
        business: {
          industry: 'retail',
        },
        profile: {
          employee_count: 12,
        },
      },
    );

    expect(result).toEqual({
      state: 'applicable',
      reason: 'All applicability rules were satisfied.',
      missingInformation: [],
    });
  });

  it('returns not_applicable when a rule is explicitly false', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'business.industry',
          expected_value: 'construction',
          explanation: 'This requirement only applies to construction businesses.',
        }),
      ],
      {
        business: {
          industry: 'retail',
        },
      },
    );

    expect(result).toEqual({
      state: 'not_applicable',
      reason: 'This requirement only applies to construction businesses.',
      missingInformation: [],
    });
  });

  it('returns needs_information when a required field is missing', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'business.industry',
          expected_value: 'retail',
        }),
      ],
      {
        business: {},
      },
    );

    expect(result).toEqual({
      state: 'needs_information',
      reason: 'Additional business information is required to determine applicability.',
      missingInformation: ['business.industry'],
    });
  });

  it('deduplicates missing fields', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'business.industry',
        }),
        rule({
          field_path: 'business.industry',
          operator: 'not_equals',
          expected_value: 'construction',
        }),
      ],
      {
        business: {},
      },
    );

    expect(result.missingInformation).toEqual(['business.industry']);
  });

  it('supports contains', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'business.activities',
          operator: 'contains',
          expected_value: 'food',
        }),
      ],
      {
        business: {
          activities: ['food', 'retail'],
        },
      },
    );

    expect(result.state).toBe('applicable');
  });

  it('supports numeric comparisons', () => {
    const result = evaluateApplicability(
      [
        rule({
          field_path: 'profile.employee_count',
          operator: 'greater_than',
          expected_value: 10,
        }),
      ],
      {
        profile: {
          employee_count: 25,
        },
      },
    );

    expect(result.state).toBe('applicable');
  });

  it('does not assume applicability when no rules exist', () => {
    const result = evaluateApplicability([], {});

    expect(result).toEqual({
      state: 'needs_information',
      reason: 'No applicability rules have been defined.',
      missingInformation: ['applicability_rules'],
    });
  });
});

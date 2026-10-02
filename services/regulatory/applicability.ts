import type { Database, Json } from '@/types/database';

type ApplicabilityRule = Database['public']['Tables']['regulatory_applicability_rules']['Row'];

export type BusinessKnowledge = Record<string, unknown>;

export type ApplicabilityResult =
  | {
      state: 'applicable';
      reason: string;
      missingInformation: string[];
    }
  | {
      state: 'not_applicable';
      reason: string;
      missingInformation: string[];
    }
  | {
      state: 'needs_information';
      reason: string;
      missingInformation: string[];
    };

function readField(knowledge: BusinessKnowledge, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }, knowledge);
}

function compare(actual: unknown, operator: string, expected: Json): boolean | undefined {
  if (actual === undefined || actual === null) {
    return undefined;
  }

  switch (operator) {
    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }

      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }

      return undefined;

    case 'not_contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return !actual.toLowerCase().includes(expected.toLowerCase());
      }

      if (Array.isArray(actual)) {
        return !actual.includes(expected);
      }

      return undefined;

    case 'greater_than':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual > expected
        : undefined;

    case 'greater_than_or_equal':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual >= expected
        : undefined;

    case 'less_than':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual < expected
        : undefined;

    case 'less_than_or_equal':
      return typeof actual === 'number' && typeof expected === 'number'
        ? actual <= expected
        : undefined;

    case 'in':
      return Array.isArray(expected) ? expected.includes(actual as never) : undefined;

    case 'not_in':
      return Array.isArray(expected) ? !expected.includes(actual as never) : undefined;

    default:
      return undefined;
  }
}

/**
 * Evaluates a requirement's applicability against verified business knowledge.
 *
 * Interpretation for the first implementation:
 * - every rule must be satisfied for the requirement to be applicable;
 * - a failed rule makes the requirement not applicable;
 * - missing rule inputs produce needs_information;
 * - no rules means needs_information rather than assuming applicability.
 *
 * This is application behavior, not a claim about the underlying law.
 */
export function evaluateApplicability(
  rules: ApplicabilityRule[],
  knowledge: BusinessKnowledge,
): ApplicabilityResult {
  if (rules.length === 0) {
    return {
      state: 'needs_information',
      reason: 'No applicability rules have been defined.',
      missingInformation: ['applicability_rules'],
    };
  }

  const missingInformation: string[] = [];

  for (const rule of rules) {
    const actual = readField(knowledge, rule.field_path);

    if (actual === undefined || actual === null) {
      missingInformation.push(rule.field_path);
      continue;
    }

    const result = compare(actual, rule.operator, rule.expected_value);

    if (result === undefined) {
      missingInformation.push(rule.field_path);
      continue;
    }

    if (!result) {
      return {
        state: 'not_applicable',
        reason:
          rule.explanation ?? `Applicability rule for "${rule.field_path}" was not satisfied.`,
        missingInformation: [],
      };
    }
  }

  if (missingInformation.length > 0) {
    return {
      state: 'needs_information',
      reason: 'Additional business information is required to determine applicability.',
      missingInformation: [...new Set(missingInformation)],
    };
  }

  return {
    state: 'applicable',
    reason: 'All applicability rules were satisfied.',
    missingInformation: [],
  };
}

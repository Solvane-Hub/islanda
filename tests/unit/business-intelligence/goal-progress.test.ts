import { describe, expect, it } from 'vitest';
import { computeGoalProgress } from '@/lib/business-intelligence/goal-progress';
import type { BusinessGoal, BusinessMetric } from '@/types/business-intelligence';

/**
 * Goal progress is derived from metrics — never stored, never invented. It
 * returns nulls (not zeros) when it cannot be computed, and prefers an
 * authoritative figure over an AI estimate.
 */

function metric(overrides: Partial<BusinessMetric>): BusinessMetric {
  return {
    id: 'm-' + Math.random().toString(36).slice(2, 8),
    business_id: 'biz-1',
    financial_period_id: null,
    source_document_id: null,
    metric_key: 'revenue',
    label: null,
    value: 0,
    currency: 'BSD',
    unit: null,
    as_of_date: null,
    provenance: 'founder_provided',
    verification_state: 'unverified',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const goal = (overrides: Partial<BusinessGoal>): BusinessGoal =>
  ({
    id: 'g-1',
    business_id: 'biz-1',
    goal_type: 'revenue_target',
    title: 'Reach $250k revenue',
    description: null,
    target_metric_key: 'revenue',
    target_value: 250000,
    target_currency: 'BSD',
    target_date: null,
    status: 'active',
    provenance: 'founder_provided',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as BusinessGoal;

describe('computeGoalProgress', () => {
  it('computes percent from the target and the matching metric', () => {
    const p = computeGoalProgress(goal({}), [metric({ metric_key: 'revenue', value: 120000 })]);
    expect(p.currentValue).toBe(120000);
    expect(p.targetValue).toBe(250000);
    expect(p.percent).toBe(48);
    expect(p.currentValueProvenance).toBe('founder_provided');
  });

  it('prefers an authoritative figure over an AI estimate, even a newer one', () => {
    const p = computeGoalProgress(goal({}), [
      metric({
        metric_key: 'revenue',
        value: 120000,
        provenance: 'founder_provided',
        created_at: '2026-01-01T00:00:00Z',
      }),
      metric({
        metric_key: 'revenue',
        value: 999999,
        provenance: 'ai_inferred',
        created_at: '2026-06-01T00:00:00Z',
      }),
    ]);
    expect(p.currentValue).toBe(120000);
    expect(p.currentValueProvenance).toBe('founder_provided');
  });

  it('returns nulls when no metric matches — never zero', () => {
    const p = computeGoalProgress(goal({}), [metric({ metric_key: 'expenses', value: 5000 })]);
    expect(p.currentValue).toBeNull();
    expect(p.percent).toBeNull();
    expect(p.currentValueProvenance).toBeNull();
  });

  it('returns null progress when the goal has no target metric', () => {
    const p = computeGoalProgress(goal({ target_metric_key: null }), [
      metric({ metric_key: 'revenue', value: 120000 }),
    ]);
    expect(p.percent).toBeNull();
    expect(p.currentValue).toBeNull();
  });

  it('does not divide by a null or zero target', () => {
    expect(
      computeGoalProgress(goal({ target_value: null }), [metric({ value: 100 })]).percent,
    ).toBeNull();
    expect(
      computeGoalProgress(goal({ target_value: 0 }), [metric({ value: 100 })]).percent,
    ).toBeNull();
  });
});

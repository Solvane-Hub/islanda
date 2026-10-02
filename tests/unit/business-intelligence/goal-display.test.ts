import { describe, expect, it } from 'vitest';
import {
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  formatGoalValue,
} from '@/lib/business-intelligence/goal-display';

describe('goal display helpers', () => {
  it('formats a monetary target with its currency', () => {
    expect(formatGoalValue(250000, 'BSD')).toBe('BSD 250,000');
  });

  it('formats a non-monetary target without a currency', () => {
    expect(formatGoalValue(5, null)).toBe('5');
  });

  it('labels goal types and statuses', () => {
    expect(GOAL_TYPE_LABELS.obtain_licence).toBe('Obtain a licence');
    expect(GOAL_STATUS_LABELS.active).toBe('Active');
  });
});

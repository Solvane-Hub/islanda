import type { BusinessGoalStatus, BusinessGoalType } from '@/types/business-intelligence';

/** Human labels for goal types and statuses. Presentation only. */
export const GOAL_TYPE_LABELS: Record<BusinessGoalType, string> = {
  revenue_target: 'Revenue target',
  launch_product: 'Launch a product',
  open_location: 'Open a location',
  hire: 'Hire',
  expand_market: 'Expand to a new market',
  improve_profitability: 'Improve profitability',
  increase_sales: 'Increase sales',
  obtain_licence: 'Obtain a licence',
  other: 'Goal',
};

export const GOAL_STATUS_LABELS: Record<BusinessGoalStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  achieved: 'Achieved',
  on_hold: 'On hold',
  abandoned: 'Abandoned',
};

/** Format a monetary/numeric target. Currency-prefixed when present. */
export function formatGoalValue(value: number, currency: string | null): string {
  return currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
}

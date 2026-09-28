import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getActiveCountries } from '@/services/business';
import { assembleBusinessFacts } from '@/services/business/facts';
import { getFinancialPeriods, getBusinessMetrics } from '@/services/financials';
import { getGoalProgress } from '@/services/goals';
import {
  buildPerformanceView,
  toNovaPerformanceContext,
} from '@/lib/business-intelligence/performance';
import { formatGoalValue } from '@/lib/business-intelligence/goal-display';
import { buildIntelligenceContext } from '@/lib/intelligence/context';
import type { IntelligenceContext } from '@/lib/intelligence/types';

/**
 * Assemble the controlled intelligence context for a business.
 *
 * Runs through the RLS-scoped client and the existing services, so it reads only
 * what the caller owns (business isolation) and reuses — never duplicates — the
 * shared business facts contract (`assembleBusinessFacts`), the P4 performance
 * derivation (`toNovaPerformanceContext`), goals and goal-progress. The P4
 * financial context plugs straight in here.
 *
 * ⚠ It NEVER reads `business_identifiers` and the built context has no field for
 *   a sensitive identifier, so none can reach an LLM.
 */
export async function assembleIntelligenceContext(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<IntelligenceContext | null> {
  const [facts, countries] = await Promise.all([
    assembleBusinessFacts(db, businessId),
    getActiveCountries(db),
  ]);
  if (!facts) return null; // not found or not owned (RLS)

  const [periods, metrics] = await Promise.all([
    getFinancialPeriods(db, businessId),
    getBusinessMetrics(db, businessId),
  ]);
  const goalRows = await getGoalProgress(db, businessId, metrics);

  const performance = toNovaPerformanceContext(buildPerformanceView(periods, metrics));
  const jurisdiction =
    countries.find((c) => c.code === facts.countryCode)?.name ?? facts.countryCode;

  const goals = goalRows.map(({ goal, progress }) => ({
    title: goal.title,
    targetLabel:
      goal.target_value !== null
        ? formatGoalValue(Number(goal.target_value), goal.target_currency)
        : null,
    progressPercent: progress.percent,
  }));

  return buildIntelligenceContext({
    businessId,
    identity: {
      legalName: facts.legalName,
      tradingName: facts.tradingName,
      businessType: facts.businessType,
      industry: facts.industry,
      jurisdiction,
      stage: facts.stage,
      operatingStatus: facts.operatingStatus,
    },
    definition: {
      activities: facts.activities,
      productsServices: facts.productsServices,
      targetCustomers: facts.targetCustomers,
      location: facts.location,
    },
    goals,
    performance,
  });
}

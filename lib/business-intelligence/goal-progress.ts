import type { FactProvenance } from '@/types/business';
import type { BusinessGoal, BusinessMetric, GoalProgress } from '@/types/business-intelligence';

/**
 * Goal progress — DERIVED from recorded metrics, never stored.
 *
 * A goal names a `target_metric_key` and a `target_value`; progress is the most
 * authoritative recorded metric for that key measured against the target. Pure
 * and I/O-free so the rule is testable and cannot drift from a stored copy.
 *
 * "Most authoritative": a founder-provided, document-derived or externally
 * verified figure is preferred over an AI estimate; ties break on recency. This
 * keeps an AI guess from overriding a real number the founder or a document gave.
 */

/** Lower is more authoritative. AI estimates rank last. */
const PROVENANCE_RANK: Record<FactProvenance, number> = {
  evidence_verified: 0,
  external_public_data: 1,
  user_document: 2,
  founder_provided: 3,
  ai_inferred: 4,
};

function moreAuthoritative(a: BusinessMetric, b: BusinessMetric): BusinessMetric {
  const ra = PROVENANCE_RANK[a.provenance];
  const rb = PROVENANCE_RANK[b.provenance];
  if (ra !== rb) return ra < rb ? a : b;
  // Same authority → most recent wins (as_of_date, else created_at).
  const da = a.as_of_date ?? a.created_at;
  const dbb = b.as_of_date ?? b.created_at;
  return da >= dbb ? a : b;
}

/**
 * Compute a goal's progress from the business's metrics.
 *
 * Returns nulls (not zeros) when progress cannot be computed — no target, no
 * matching metric — so the UI can say "not yet measured" rather than implying
 * 0%.
 */
export function computeGoalProgress(
  goal: Pick<BusinessGoal, 'id' | 'target_metric_key' | 'target_value'>,
  metrics: readonly BusinessMetric[],
): GoalProgress {
  const targetValue = goal.target_value === null ? null : Number(goal.target_value);

  if (!goal.target_metric_key) {
    return {
      goalId: goal.id,
      targetValue,
      currentValue: null,
      percent: null,
      currentValueProvenance: null,
    };
  }

  const matching = metrics.filter((m) => m.metric_key === goal.target_metric_key);
  if (matching.length === 0) {
    return {
      goalId: goal.id,
      targetValue,
      currentValue: null,
      percent: null,
      currentValueProvenance: null,
    };
  }

  const best = matching.reduce(moreAuthoritative);
  const currentValue = Number(best.value);
  const percent =
    targetValue !== null && targetValue !== 0
      ? Math.round((currentValue / targetValue) * 100)
      : null;

  return {
    goalId: goal.id,
    targetValue,
    currentValue,
    percent,
    currentValueProvenance: best.provenance,
  };
}

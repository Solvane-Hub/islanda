import type { BusinessMetricKey } from '@/types/business-intelligence';
import type { EvidenceRef, IntelligenceContext } from '@/lib/intelligence/types';

/**
 * Deterministic financial answering — the LLM bypass.
 *
 * Answers factual, comparison and derived-metric questions straight from the
 * assembled context, with NO model call. It only ever reports figures that are
 * present (recorded or derived) and their provenance; a missing figure is
 * reported as missing, never guessed. Returns `null` when the question is not a
 * recognisable financial fact lookup, so the caller can degrade gracefully.
 *
 * This is where the "if deterministic logic can answer, don't invoke an LLM"
 * rule is realised for the financial category.
 */

export interface DeterministicFinancialAnswer {
  answer: string;
  evidence: EvidenceRef[];
  unknowns: string[];
}

const METRIC_KEYWORDS: readonly { key: BusinessMetricKey; test: RegExp }[] = [
  { key: 'gross_margin', test: /\bmargin\b/ },
  { key: 'net_profit', test: /\b(net profit|profit|earnings|bottom line)\b/ },
  { key: 'cash_flow', test: /\bcash\s?flow\b/ },
  { key: 'expenses', test: /\b(expense|expenses|costs?|spend|spending|outgoings)\b/ },
  { key: 'sales_count', test: /\b(how many sales|sales count|units sold|number of sales)\b/ },
  { key: 'customer_count', test: /\b(how many customers|customer count|number of customers)\b/ },
  {
    key: 'revenue',
    test: /\b(revenue|turnover|income|sales|how much did (i|we) (make|earn)|top line)\b/,
  },
];

const GROWTH =
  /\b(grow|growth|grew|increase[d]?|decrease[d]?|change[d]?|compare|vs|versus|trend|q[1-4]\s*(to|vs)\s*q[1-4])\b/;

function evidenceForMetric(
  context: IntelligenceContext,
  key: BusinessMetricKey,
  basis: 'recorded' | 'derived',
): EvidenceRef[] {
  const id = `metric:${key}:${basis}`;
  return context.evidence.filter((e) => e.id === id);
}

export function answerFinancialDeterministically(
  question: string,
  context: IntelligenceContext,
): DeterministicFinancialAnswer | null {
  const q = question.toLowerCase();
  const perf = context.performance;

  if (!perf || perf.metrics.length === 0) {
    return {
      answer:
        'I don’t have any financial figures recorded for your business yet. Record a figure ' +
        'or add a financial statement, and I can start answering questions about your performance.',
      evidence: [],
      unknowns: ['No financial figures are recorded yet.'],
    };
  }

  const periodLabel = perf.periodLabel ?? 'the current period';

  // ── Growth / comparison ───────────────────────────────────────────────────
  if (GROWTH.test(q) && /\b(revenue|turnover|income|sales|business|overall)\b/.test(q)) {
    const c = perf.revenueChange;
    if (c && c.changePercent !== null) {
      const pct = c.changePercent;
      const direction = pct >= 0 ? 'up' : 'down';
      return {
        answer:
          `Revenue is ${direction} ${pct >= 0 ? '+' : ''}${pct}% — from ` +
          `${c.previousDisplay} in ${c.previousPeriodLabel} to ${c.currentDisplay} in ${c.currentPeriodLabel}.`,
        evidence: [
          ...evidenceForMetric(context, 'revenue', 'recorded'),
          {
            id: 'calc:revenue_growth',
            type: 'calculation',
            source: `${c.previousPeriodLabel} → ${c.currentPeriodLabel}`,
            provenance: 'CALCULATION',
          },
        ],
        unknowns: [],
      };
    }
    return {
      answer:
        'I only have one period of revenue recorded, so I can’t compare periods yet. Record ' +
        'another period and I can show the change.',
      evidence: evidenceForMetric(context, 'revenue', 'recorded'),
      unknowns: ['A second period of revenue is needed to compute growth.'],
    };
  }

  // ── A single metric level ─────────────────────────────────────────────────
  const matched = METRIC_KEYWORDS.find((m) => m.test.test(q));
  if (matched) {
    const recorded = perf.metrics.find((m) => m.key === matched.key && m.basis === 'recorded');
    const derived = perf.metrics.find((m) => m.key === matched.key && m.basis === 'derived');
    const metric = recorded ?? derived;
    if (metric) {
      const derivedNote = metric.basis === 'derived' ? ' (derived from your recorded figures)' : '';
      return {
        answer: `Your ${metric.label.toLowerCase()} for ${periodLabel} is ${metric.display}${derivedNote}.`,
        evidence: evidenceForMetric(context, matched.key, metric.basis),
        unknowns: [],
      };
    }
    return {
      answer: `I don’t have your ${matched.key.replace(/_/g, ' ')} recorded for ${periodLabel} yet.`,
      evidence: [],
      unknowns: [`${matched.key.replace(/_/g, ' ')} has not been recorded.`],
    };
  }

  // Not a recognisable financial fact lookup.
  return null;
}

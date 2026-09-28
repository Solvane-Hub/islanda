import type { FactProvenance } from '@/types/business';
import type {
  BusinessFinancialPeriod,
  BusinessMetric,
  BusinessMetricKey,
} from '@/types/business-intelligence';

/**
 * Financial performance — pure, deterministic derivation. No I/O.
 *
 * Turns recorded metrics + periods into a performance view: the current period's
 * recorded figures (each with provenance), deterministically DERIVED figures
 * (profit, margin) clearly marked as derived, and a period-over-period revenue
 * comparison when two periods genuinely have data.
 *
 * ## The rules that keep it honest
 *  • Only recorded figures that actually exist are shown — never a fabricated $0.
 *  • Derived figures are computed ONLY when their inputs exist and the maths is
 *    valid (no divide-by-zero), and are labelled derived — never founder-provided.
 *  • A recorded value always wins over a derived one (if net profit was entered,
 *    it is not re-derived).
 *  • Comparison appears only when both periods hold the metric.
 *
 * This same structure is what a future Nova financial context consumes
 * (`toNovaPerformanceContext`), so evidence/provenance stays explicit end to end.
 */

const HEADLINE_ORDER: readonly BusinessMetricKey[] = [
  'revenue',
  'expenses',
  'net_profit',
  'gross_margin',
  'cash_flow',
  'sales_count',
  'customer_count',
  'other',
];

export const METRIC_KEY_LABELS: Record<BusinessMetricKey, string> = {
  revenue: 'Revenue',
  expenses: 'Expenses',
  net_profit: 'Net profit',
  gross_margin: 'Gross margin',
  cash_flow: 'Cash flow',
  sales_count: 'Sales',
  customer_count: 'Customers',
  other: 'Metric',
};

const KEY_LABELS = METRIC_KEY_LABELS;

/**
 * The storage shape for a recorded figure — decided by the metric, never typed
 * by the founder. Monetary keys take the business currency; margin is a percent;
 * counts are unitless; a figure linked to a document is `user_document`, else
 * `founder_provided`. A figure is never `verified` (a DB CHECK also enforces it).
 */
export function resolveMetricEntry(
  key: BusinessMetricKey,
  businessCurrency: string | null,
  hasSupportingDocument: boolean,
): { currency: string | null; unit: string | null; provenance: FactProvenance } {
  const isPercent = key === 'gross_margin';
  const isCount = key === 'sales_count' || key === 'customer_count';
  return {
    currency: isPercent || isCount ? null : businessCurrency,
    unit: isPercent ? 'percent' : isCount ? 'count' : null,
    provenance: hasSupportingDocument ? 'user_document' : 'founder_provided',
  };
}

export function formatMetricValue(
  value: number,
  currency: string | null,
  unit: string | null,
): string {
  if (unit === 'percent') return `${value.toLocaleString()}%`;
  if (currency) return `${currency} ${value.toLocaleString()}`;
  return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
}

/** A recorded metric, projected for display. */
export interface MetricView {
  /** The underlying `business_metrics.id` — the row this figure came from. */
  id: string;
  key: BusinessMetricKey;
  label: string;
  value: number;
  display: string;
  provenance: FactProvenance;
  sourceDocumentId: string | null;
  periodLabel: string | null;
}

/** A deterministically derived figure. Never stored, always labelled derived. */
export interface DerivedMetricView {
  key: 'net_profit' | 'gross_margin';
  label: string;
  value: number;
  display: string;
  note: string;
}

export interface PerformanceComparison {
  metricKey: BusinessMetricKey;
  metricLabel: string;
  currentPeriodLabel: string;
  currentValue: number;
  currentDisplay: string;
  previousPeriodLabel: string;
  previousValue: number;
  previousDisplay: string;
  /** Signed percentage change, one decimal. Null when the previous value is 0. */
  changePercent: number | null;
}

export interface PerformanceView {
  currentPeriodId: string | null;
  currentPeriodLabel: string | null;
  recorded: MetricView[];
  derived: DerivedMetricView[];
  comparisons: PerformanceComparison[];
  hasData: boolean;
}

function num(value: BusinessMetric['value']): number {
  return Number(value);
}

/** First (most recent) metric per key. Repository returns newest-first. */
function latestByKey(metrics: readonly BusinessMetric[]): Map<BusinessMetricKey, BusinessMetric> {
  const map = new Map<BusinessMetricKey, BusinessMetric>();
  for (const m of metrics) if (!map.has(m.metric_key)) map.set(m.metric_key, m);
  return map;
}

function toMetricView(metric: BusinessMetric, periodLabel: string | null): MetricView {
  return {
    id: metric.id,
    key: metric.metric_key,
    label: KEY_LABELS[metric.metric_key],
    value: num(metric.value),
    display: formatMetricValue(num(metric.value), metric.currency, metric.unit),
    provenance: metric.provenance,
    sourceDocumentId: metric.source_document_id,
    periodLabel,
  };
}

function deriveFor(
  latest: Map<BusinessMetricKey, BusinessMetric>,
  currency: string | null,
): DerivedMetricView[] {
  const derived: DerivedMetricView[] = [];
  const revenue = latest.get('revenue');
  const expenses = latest.get('expenses');
  const recordedNetProfit = latest.get('net_profit');

  // Net profit = revenue − expenses, only when both exist and it wasn't recorded.
  let netProfitValue: number | null = recordedNetProfit ? num(recordedNetProfit.value) : null;
  if (netProfitValue === null && revenue && expenses) {
    netProfitValue = num(revenue.value) - num(expenses.value);
    derived.push({
      key: 'net_profit',
      label: 'Net profit',
      value: netProfitValue,
      display: formatMetricValue(netProfitValue, currency, null),
      note: 'Derived from recorded revenue and expenses',
    });
  }

  // Margin = net profit ÷ revenue, only when revenue is non-zero and margin
  // wasn't recorded.
  if (netProfitValue !== null && revenue && !latest.get('gross_margin')) {
    const revenueValue = num(revenue.value);
    if (revenueValue !== 0) {
      const margin = Math.round((netProfitValue / revenueValue) * 1000) / 10;
      derived.push({
        key: 'gross_margin',
        label: 'Margin',
        value: margin,
        display: `${margin}%`,
        note: 'Derived from net profit and revenue',
      });
    }
  }

  return derived;
}

export function buildPerformanceView(
  periods: readonly BusinessFinancialPeriod[],
  metrics: readonly BusinessMetric[],
): PerformanceView {
  const empty: PerformanceView = {
    currentPeriodId: null,
    currentPeriodLabel: null,
    recorded: [],
    derived: [],
    comparisons: [],
    hasData: false,
  };
  if (metrics.length === 0) return empty;

  // Periods newest-first (repository already sorts, but be explicit).
  const ordered = [...periods].sort((a, b) => (a.period_start < b.period_start ? 1 : -1));
  const metricsByPeriod = new Map<string, BusinessMetric[]>();
  for (const m of metrics) {
    if (!m.financial_period_id) continue;
    const list = metricsByPeriod.get(m.financial_period_id) ?? [];
    list.push(m);
    metricsByPeriod.set(m.financial_period_id, list);
  }

  const currentPeriod = ordered.find((p) => (metricsByPeriod.get(p.id)?.length ?? 0) > 0) ?? null;

  // The metric set to display: the current period's, else period-less metrics.
  const activeMetrics = currentPeriod
    ? (metricsByPeriod.get(currentPeriod.id) ?? [])
    : metrics.filter((m) => !m.financial_period_id);

  if (activeMetrics.length === 0) return empty;

  const latest = latestByKey(activeMetrics);
  const curLabel = currentPeriod ? (currentPeriod.label ?? currentPeriod.period_start) : null;

  const recorded: MetricView[] = HEADLINE_ORDER.filter((k) => latest.has(k)).map((k) =>
    toMetricView(latest.get(k)!, curLabel),
  );

  const derived = deriveFor(latest, latest.get('revenue')?.currency ?? null);

  // Revenue comparison to the previous period that holds revenue.
  const comparisons: PerformanceComparison[] = [];
  if (currentPeriod) {
    const currentRevenue = latest.get('revenue');
    if (currentRevenue) {
      const currentIdx = ordered.findIndex((p) => p.id === currentPeriod.id);
      const previousPeriod = ordered
        .slice(currentIdx + 1)
        .find((p) => latestByKey(metricsByPeriod.get(p.id) ?? []).has('revenue'));
      const previousRevenue = previousPeriod
        ? latestByKey(metricsByPeriod.get(previousPeriod.id) ?? []).get('revenue')
        : undefined;
      if (previousPeriod && previousRevenue) {
        const cur = num(currentRevenue.value);
        const prev = num(previousRevenue.value);
        comparisons.push({
          metricKey: 'revenue',
          metricLabel: 'Revenue',
          currentPeriodLabel: curLabel ?? '',
          currentValue: cur,
          currentDisplay: formatMetricValue(cur, currentRevenue.currency, currentRevenue.unit),
          previousPeriodLabel: previousPeriod.label ?? previousPeriod.period_start,
          previousValue: prev,
          previousDisplay: formatMetricValue(prev, previousRevenue.currency, previousRevenue.unit),
          changePercent: prev !== 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
        });
      }
    }
  }

  return {
    currentPeriodId: currentPeriod?.id ?? null,
    currentPeriodLabel: curLabel,
    recorded,
    derived,
    comparisons,
    hasData: recorded.length > 0,
  };
}

/**
 * A structured, provenance-aware performance context for a future Nova financial
 * capability (product Part 10/11). Nova does NOT consume this yet — it is the
 * honest, evidence-tagged shape a financial answer would be built from, kept
 * here so the data path is ready and testable. It carries no advice and no
 * generated prose.
 */
export interface NovaPerformanceContext {
  periodLabel: string | null;
  metrics: {
    key: BusinessMetricKey;
    label: string;
    display: string;
    basis: 'recorded' | 'derived';
    provenance: FactProvenance | null;
    supportingDocumentId: string | null;
  }[];
  revenueChange: {
    currentPeriodLabel: string;
    previousPeriodLabel: string;
    currentDisplay: string;
    previousDisplay: string;
    changePercent: number | null;
  } | null;
}

export function toNovaPerformanceContext(view: PerformanceView): NovaPerformanceContext {
  const recorded = view.recorded.map((m) => ({
    key: m.key,
    label: m.label,
    display: m.display,
    basis: 'recorded' as const,
    provenance: m.provenance,
    supportingDocumentId: m.sourceDocumentId,
  }));
  const derived = view.derived.map((d) => ({
    key: d.key,
    label: d.label,
    display: d.display,
    basis: 'derived' as const,
    provenance: null,
    supportingDocumentId: null,
  }));
  const cmp = view.comparisons.find((c) => c.metricKey === 'revenue') ?? null;
  return {
    periodLabel: view.currentPeriodLabel,
    metrics: [...recorded, ...derived],
    revenueChange: cmp
      ? {
          currentPeriodLabel: cmp.currentPeriodLabel,
          previousPeriodLabel: cmp.previousPeriodLabel,
          currentDisplay: cmp.currentDisplay,
          previousDisplay: cmp.previousDisplay,
          changePercent: cmp.changePercent,
        }
      : null,
  };
}

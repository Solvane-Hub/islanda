import { TrendingUp } from 'lucide-react';
import type { BusinessMetric, BusinessMetricKey } from '@/types/business-intelligence';
import { ProvenanceBadge, provenanceKindFor } from '@/components/ui/provenance-badge';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';

/**
 * Financial performance — restrained, and honest about absence.
 *
 * Shows the most recent value for each headline metric that ACTUALLY exists,
 * with its provenance. It never shows `$0` for a missing figure — with no data
 * it says so plainly. This is not an accounting dashboard; it is the business
 * understanding its own numbers, with their origins visible.
 */

const HEADLINE_KEYS: readonly BusinessMetricKey[] = [
  'revenue',
  'expenses',
  'net_profit',
  'gross_margin',
  'cash_flow',
];

const KEY_LABELS: Record<BusinessMetricKey, string> = {
  revenue: 'Revenue',
  expenses: 'Expenses',
  net_profit: 'Net profit',
  gross_margin: 'Gross margin',
  cash_flow: 'Cash flow',
  sales_count: 'Sales',
  customer_count: 'Customers',
  other: 'Metric',
};

function formatValue(metric: BusinessMetric): string {
  const n = Number(metric.value);
  if (metric.unit === 'percent') return `${n.toLocaleString()}%`;
  if (metric.currency) return `${metric.currency} ${n.toLocaleString()}`;
  return `${n.toLocaleString()}${metric.unit ? ` ${metric.unit}` : ''}`;
}

/** Most recent metric per key (metrics arrive newest-first from the repository). */
function latestByKey(metrics: readonly BusinessMetric[]): Map<BusinessMetricKey, BusinessMetric> {
  const map = new Map<BusinessMetricKey, BusinessMetric>();
  for (const m of metrics) if (!map.has(m.metric_key)) map.set(m.metric_key, m);
  return map;
}

export function PerformanceModule({
  metrics,
  periodLabels,
}: {
  metrics: readonly BusinessMetric[];
  periodLabels: Map<string, string>;
}) {
  const latest = latestByKey(metrics);
  const present = HEADLINE_KEYS.filter((k) => latest.has(k));

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <TrendingUp aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
        <SurfaceLabel as="h2">Performance</SurfaceLabel>
      </div>

      {present.length === 0 ? (
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Not enough data yet. Once you record a figure or add a financial statement, your revenue,
          expenses and profit will appear here — each shown with where it came from.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
          {present.map((key) => {
            const metric = latest.get(key)!;
            const periodLabel = metric.financial_period_id
              ? periodLabels.get(metric.financial_period_id)
              : null;
            return (
              <div key={key} className="flex min-w-0 flex-col gap-1.5">
                <dt className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                  {KEY_LABELS[key]}
                </dt>
                <dd className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="text-on-ink text-lg font-semibold tracking-[-0.01em]"
                    data-numeric
                  >
                    {formatValue(metric)}
                  </span>
                  {periodLabel ? (
                    <span className="text-on-glass-subtle text-2xs">{periodLabel}</span>
                  ) : null}
                  <ProvenanceBadge
                    kind={provenanceKindFor(metric.provenance, metric.verification_state)}
                  />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </WorkspaceSurface>
  );
}

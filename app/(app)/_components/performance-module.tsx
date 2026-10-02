import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import type { PerformanceView } from '@/lib/business-intelligence/performance';
import { ProvenanceBadge, provenanceKindFor } from '@/components/ui/provenance-badge';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { RecordFigure } from './record-figure';
import { AddEvidence, type MetricEvidenceItem } from './add-evidence';

/**
 * Financial performance — recorded figures, deterministically derived figures,
 * and a restrained period comparison. Real data only: never a fabricated $0,
 * derived values clearly marked, provenance always visible. A lightweight
 * "record a figure" affordance is always available, so the first figure can be
 * added right here.
 */
export function PerformanceModule({
  view,
  periods,
  documents,
  evidenceByMetricId = {},
}: {
  view: PerformanceView;
  periods: { id: string; label: string }[];
  documents: { id: string; title: string }[];
  /** Evidence already attached to a recorded metric, keyed by its row id. */
  evidenceByMetricId?: Record<string, MetricEvidenceItem[]>;
}) {
  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
          <SurfaceLabel as="h2">Performance</SurfaceLabel>
        </div>
        {view.currentPeriodLabel ? (
          <span className="text-on-glass-subtle text-2xs tracking-[0.1em] uppercase">
            {view.currentPeriodLabel}
          </span>
        ) : null}
      </div>

      {!view.hasData ? (
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Not enough data yet. Record a figure or link one to a document you&apos;ve added, and your
          revenue, expenses and profit will appear here — each with where it came from.
        </p>
      ) : (
        <div className="flex flex-col gap-7">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {view.recorded.map((m) => (
              <div key={m.key} className="flex min-w-0 flex-col gap-1.5">
                <dt className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                  {m.label}
                </dt>
                <dd className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="text-on-ink text-lg font-semibold tracking-[-0.01em]"
                    data-numeric
                  >
                    {m.display}
                  </span>
                  <ProvenanceBadge kind={provenanceKindFor(m.provenance, 'unverified')} />
                  <AddEvidence
                    metricId={m.id}
                    documents={documents}
                    evidence={evidenceByMetricId[m.id] ?? []}
                  />
                </dd>
              </div>
            ))}

            {view.derived.map((d) => (
              <div key={d.key} className="flex min-w-0 flex-col gap-1.5">
                <dt className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                  {d.label}
                </dt>
                <dd className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="text-on-ink text-lg font-semibold tracking-[-0.01em]"
                    data-numeric
                  >
                    {d.display}
                  </span>
                  <span className="text-2xs text-champagne-dim tracking-[0.08em] uppercase">
                    Derived
                  </span>
                  <span className="text-on-glass-subtle text-2xs text-pretty">{d.note}</span>
                </dd>
              </div>
            ))}
          </dl>

          {view.comparisons.map((c) => {
            const up = (c.changePercent ?? 0) >= 0;
            return (
              <div
                key={c.metricKey}
                className="border-border-control flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-white/[0.02] px-4 py-3"
              >
                <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                  {c.metricLabel} trend
                </span>
                <span className="text-on-ink-muted text-sm">
                  {c.previousPeriodLabel} {c.previousDisplay}
                  <span aria-hidden="true" className="text-on-glass-subtle mx-2">
                    →
                  </span>
                  {c.currentPeriodLabel}{' '}
                  <span className="text-on-ink font-medium">{c.currentDisplay}</span>
                </span>
                {c.changePercent !== null ? (
                  <span
                    className={`ml-auto inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-bahama-turquoise' : 'text-on-ink-muted'}`}
                    data-numeric
                  >
                    {up ? (
                      <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
                    ) : (
                      <ArrowDownRight aria-hidden="true" className="size-4" strokeWidth={2} />
                    )}
                    {up ? '+' : ''}
                    {c.changePercent}%
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <RecordFigure periods={periods} documents={documents} />
    </WorkspaceSurface>
  );
}

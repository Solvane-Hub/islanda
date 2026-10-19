import { cn } from '@/lib/utils/cn';

/**
 * Small, dependency-free charts for the admin portal. Server-rendered SVG and
 * CSS — no client JavaScript. Every chart has a visible title, values a
 * screen reader can reach (an accessible table or list), and a hover tooltip
 * (`<title>`) for each mark.
 */

const nf = new Intl.NumberFormat('en-US');

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  className,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  /** % change vs the previous period; null shows nothing. */
  delta?: number | null | undefined;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-2xl border border-white/12 p-4', className)}>
      <p className="text-foreground-muted text-xs font-medium">{label}</p>
      <p className="text-on-ink text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      {delta !== null && delta !== undefined && Number.isFinite(delta) ? (
        <p
          className={cn(
            'text-xs tabular-nums',
            delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-foreground-muted',
          )}
        >
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(delta).toFixed(1)}% vs previous period
        </p>
      ) : null}
      {hint ? <p className="text-foreground-subtle text-xs text-pretty">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string | undefined;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-2xl border border-white/12 p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-on-ink text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="text-foreground-muted max-w-prose text-xs text-pretty">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function NoData({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground-muted text-sm text-pretty">{children}</p>;
}

/** Horizontal bars. Accessible as a list: "label: value". */
export function BarList({
  items,
  unit,
  emptyText = 'No data in this range.',
}: {
  items: { label: string; value: number; secondary?: string | undefined }[];
  unit: string;
  emptyText?: string;
}) {
  if (items.length === 0) return <NoData>{emptyText}</NoData>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-foreground min-w-0 truncate" title={item.label}>
              {item.label}
            </span>
            <span className="text-on-ink shrink-0 tabular-nums">
              {formatNumber(item.value)}
              <span className="sr-only"> {unit}</span>
              {item.secondary ? (
                <span className="text-foreground-muted"> · {item.secondary}</span>
              ) : null}
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="bg-bahama-turquoise/80 h-full rounded-full"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SERIES_COLORS = ['var(--color-bahama-turquoise, #2ec4c4)', '#f5b942', '#8fa8ff'];

/**
 * Daily trend as grouped columns. The SVG is decorative to assistive tech;
 * the same numbers are in a visually hidden table.
 */
export function TrendChart({
  title,
  days,
  series,
}: {
  title: string;
  days: { day: string; values: Record<string, number> }[];
  series: { key: string; label: string }[];
}) {
  if (days.length === 0) return <NoData>No data in this range.</NoData>;
  const max = Math.max(1, ...days.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const width = 720;
  const height = 180;
  const pad = { top: 8, bottom: 22, left: 32, right: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const groupW = plotW / days.length;
  const barW = Math.max(1, Math.min(14, (groupW - 2) / series.length));
  const ticks = [0, Math.ceil(max / 2), max];
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3 text-xs" aria-hidden="true">
        {series.map((s, i) => (
          <span key={s.key} className="text-foreground-muted inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}. The same figures are in the table that follows.`}
      >
        {ticks.map((t) => {
          const y = pad.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="rgba(255,255,255,0.5)"
              >
                {t}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const x0 = pad.left + i * groupW + (groupW - barW * series.length) / 2;
          return (
            <g key={d.day}>
              {series.map((s, j) => {
                const v = d.values[s.key] ?? 0;
                const h = (v / max) * plotH;
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * barW}
                    y={pad.top + plotH - h}
                    width={Math.max(1, barW - 1)}
                    height={Math.max(v > 0 ? 1 : 0, h)}
                    rx={1}
                    fill={SERIES_COLORS[j]}
                  >
                    <title>{`${d.day} · ${s.label}: ${v}`}</title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 ? (
                <text
                  x={pad.left + i * groupW + groupW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(255,255,255,0.5)"
                >
                  {d.day.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day (UTC)</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              {series.map((s) => (
                <td key={s.key}>{d.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A funnel as stepped bars with the step-to-step and overall conversion. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0]?.value ?? 0;
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const fromPrev = prev ? (step.value / prev) * 100 : null;
        const fromTop = top ? (step.value / top) * 100 : null;
        return (
          <li key={step.label} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-foreground">
                {i + 1}. {step.label}
              </span>
              <span className="text-on-ink tabular-nums">
                {formatNumber(step.value)}
                {i > 0 ? (
                  <span className="text-foreground-muted">
                    {' '}
                    · {formatPercent(fromPrev)} of previous · {formatPercent(fromTop)} of step 1
                  </span>
                ) : null}
              </span>
            </div>
            <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="bg-bahama-turquoise/80 h-full rounded-full"
                style={{ width: `${Math.max(1, (step.value / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Simple accessible data table for admin lists. */
export function DataTable({
  caption,
  headers,
  rows,
  minWidth = '40rem',
}: {
  caption: string;
  headers: string[];
  rows: React.ReactNode[][];
  minWidth?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-white/12 focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none"
    >
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="text-foreground-muted text-xs">
          <tr className="border-b border-white/12">
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/8 last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

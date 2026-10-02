import { ArrowUpRight, Check, FileCheck2, Landmark, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * The Islanda workspace, treated as an object rather than a screenshot.
 *
 * This is the hero's second subject. It sits inside the photograph, so it is
 * built to survive being looked at closely: real hierarchy, real states, no
 * lorem, no invented metrics.
 *
 * Every value is illustrative and labelled as such. The stages, statuses and
 * copy mirror what `buildJourney()` actually produces for a business partway
 * through intake — nothing here claims a capability the product lacks. The two
 * roadmap rows are explicitly marked, because implying Compliance and Funding
 * are live would be the one lie this page cannot afford.
 */

/** `meta` is optional: the first row would otherwise repeat the business name
 *  already shown in the panel header, which reads as a bug rather than detail. */
const ROUTE: { label: string; state: 'done' | 'active' | 'next'; meta?: string }[] = [
  { label: 'Business created', state: 'done' },
  { label: 'Founder intake', state: 'active', meta: '3 of 5 answered' },
  { label: 'Requirements identified', state: 'next', meta: 'Awaiting intake' },
];

const SIGNALS = [
  { icon: Landmark, label: 'Formation', value: 'In progress', tone: 'active' as const },
  { icon: ShieldCheck, label: 'Compliance', value: 'On the roadmap', tone: 'idle' as const },
  { icon: FileCheck2, label: 'Funding', value: 'On the roadmap', tone: 'idle' as const },
];

export function WorkspacePanel({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Depth: a second plate offset behind the panel. One layer, not a stack —
          it reads as an object with thickness rather than a pile of cards. */}
      <div
        aria-hidden="true"
        className="border-on-ink/8 bg-ink/40 absolute -top-3 -right-3 hidden h-full w-full rounded-2xl border backdrop-blur-[2px] sm:block"
      />

      <div className="border-on-ink/10 bg-ink/92 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md">
        {/* Chrome */}
        <div className="border-on-ink/8 flex items-center gap-3 border-b px-5 py-3.5">
          <span className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
            Islanda workspace
          </span>
          <span className="border-on-ink/15 text-on-ink-subtle text-2xs ml-auto rounded-full border px-2 py-0.5 font-medium">
            Example
          </span>
        </div>

        <div className="flex flex-col gap-7 p-5 sm:p-6">
          {/* Identity + progress */}
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-on-ink truncate text-lg font-semibold tracking-[-0.015em]">
                Conch &amp; Coast Ltd.
              </p>
              <p className="text-on-ink-muted mt-1 text-sm">Nassau · Food service</p>
            </div>
            <Dial percent={40} />
          </div>

          {/* The route */}
          <ol className="flex flex-col">
            {ROUTE.map((step, i) => (
              <li key={step.label} className="relative flex gap-3.5 pb-5 last:pb-0">
                {i < ROUTE.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-5 bottom-0 left-[7px] w-px',
                      step.state === 'done' ? 'bg-bahama-cyan/40' : 'bg-on-ink/12',
                    )}
                  />
                ) : null}

                <span
                  aria-hidden="true"
                  className={cn(
                    'relative z-10 mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full border',
                    step.state === 'done' && 'border-bahama-cyan bg-bahama-cyan text-ink',
                    step.state === 'active' &&
                      'border-bahama-turquoise bg-bahama-turquoise/20 ring-bahama-turquoise/20 ring-4',
                    step.state === 'next' && 'border-on-ink/25 bg-transparent',
                  )}
                >
                  {step.state === 'done' ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
                </span>

                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'text-sm',
                      step.state === 'next' ? 'text-on-ink-subtle' : 'text-on-ink font-medium',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.meta ? (
                    <span className="text-on-ink-subtle shrink-0 text-xs">{step.meta}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {/* Signals */}
          <div className="border-on-ink/8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border">
            {SIGNALS.map(({ icon: Icon, label, value, tone }) => (
              <div key={label} className="bg-on-ink/[0.03] flex flex-col gap-2 px-3 py-3.5">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    tone === 'active' ? 'text-bahama-turquoise' : 'text-on-ink-subtle',
                  )}
                  strokeWidth={1.75}
                />
                <span className="text-on-ink-muted text-2xs font-medium tracking-wide uppercase">
                  {label}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    tone === 'active' ? 'text-on-ink font-medium' : 'text-on-ink-subtle',
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Next action — the panel's single point of focus */}
          <div className="border-on-ink/10 bg-on-ink/[0.04] flex items-center gap-4 rounded-xl border p-4">
            <div className="min-w-0 flex-1">
              <p className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                Next
              </p>
              <p className="text-on-ink mt-1 text-sm font-medium">
                Finish intake to see your requirements
              </p>
            </div>
            <span
              aria-hidden="true"
              className="bg-on-ink text-ink flex size-8 shrink-0 items-center justify-center rounded-full"
            >
              <ArrowUpRight className="size-4" strokeWidth={2.25} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Progress dial. An SVG ring rather than a bar: at this size a bar would read
 * as UI furniture, and the ring gives the panel a focal point that survives
 * being seen at a glance from across the composition.
 */
function Dial({ percent }: { percent: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0">
      <svg
        viewBox="0 0 56 56"
        className="size-14 -rotate-90"
        role="img"
        aria-label={`Setup ${percent} percent complete`}
      >
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-on-ink/12"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="text-bahama-turquoise"
        />
      </svg>
      <span
        aria-hidden="true"
        data-numeric
        className="text-on-ink absolute inset-0 flex items-center justify-center text-xs font-semibold"
      >
        {percent}%
      </span>
    </div>
  );
}

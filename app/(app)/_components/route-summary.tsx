import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Milestone } from '@/services/progress';

/**
 * The route, as a rail.
 *
 * A second renderer of the same `Milestone[]` contract as `Journey`, which is
 * deliberate rather than accidental duplication: `Journey` is the editorial
 * version the landing page ships and must keep rendering byte-identically, and
 * this is the operational one — the whole route read left to right in one
 * glance, with the current position marked.
 *
 * The stages that depend on capabilities which do not exist collapse into a
 * single terminal cell. Three near-identical dead ends laid out as three equal
 * nodes would imply three separate pieces of pending work; one cell naming all
 * three says what is true — the route continues, and none of it is waiting on
 * the founder. Blocked stays blocked; nothing is promoted.
 *
 * Horizontal from `lg`, vertical below it. Same rail, and only the connector
 * geometry changes: each node draws the segment that leaves it, so the line
 * always ends at the last dot instead of running off into the padding.
 */
export function RouteSummary({ milestones }: { milestones: Milestone[] }) {
  const actionable = milestones.filter((m) => m.state !== 'blocked');
  const blocked = milestones.filter((m) => m.state === 'blocked');
  const cells = actionable.length + (blocked.length > 0 ? 1 : 0);

  return (
    <ol className="grid gap-y-7 lg:auto-cols-fr lg:grid-flow-col lg:gap-x-6 lg:gap-y-0">
      {actionable.map((m, i) => {
        const complete = m.state === 'complete';
        const current = m.state === 'current';
        return (
          <li key={m.key} className="relative flex gap-3.5 lg:flex-col lg:gap-0">
            <Connector last={i === cells - 1} />

            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-3.5 shrink-0 items-center justify-center rounded-full',
                complete && 'bg-bahama-turquoise/70 text-abyss',
                current &&
                  'bg-bahama-turquoise ring-bahama-turquoise/20 shadow-[0_0_14px_rgba(18,200,213,0.55)] ring-4',
                m.state === 'upcoming' && 'bg-abyss ring-1 ring-white/40',
              )}
            >
              {complete ? <Check className="size-2" strokeWidth={4.5} /> : null}
            </span>

            <div className="min-w-0 lg:mt-4">
              {/* State is text as well as shape and colour — SC 1.4.1. */}
              <p
                className={cn(
                  'text-2xs font-medium tracking-[0.14em] uppercase',
                  current ? 'text-bahama-turquoise' : 'text-on-glass-subtle',
                )}
              >
                {complete ? 'Done' : current ? 'Now' : 'Next'}
              </p>
              <h3
                className={cn(
                  'text-on-ink mt-1.5 text-sm text-pretty',
                  current ? 'font-semibold' : 'font-medium',
                )}
              >
                {m.title}
              </h3>
              <p className="text-on-ink-muted mt-1 text-xs text-pretty">{m.description}</p>
            </div>
          </li>
        );
      })}

      {blocked.length > 0 ? (
        <li className="relative flex gap-3.5 lg:flex-col lg:gap-0">
          <span
            aria-hidden="true"
            className="bg-abyss relative z-10 size-3.5 shrink-0 rounded-full ring-1 ring-white/44"
          />
          <div className="min-w-0 lg:mt-4">
            <p className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
              In development
            </p>
            <h3 className="text-on-ink-muted mt-1.5 text-sm font-medium">
              <span data-numeric>{blocked.length}</span> further stages, in development
            </h3>
            <p className="text-on-ink-muted mt-1 text-xs text-pretty">
              {blocked.map((m) => m.title).join(' · ')}
            </p>
            <Link
              href="/timeline"
              className="text-bahama-turquoise hover:text-on-ink mt-2.5 inline-flex items-center gap-1 rounded-sm text-xs underline underline-offset-4 transition-colors duration-150"
            >
              See what they depend on
              <ArrowRight aria-hidden="true" className="size-3" strokeWidth={2} />
            </Link>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

/**
 * The segment leaving a node. Decorative: every state it implies is also
 * written out beside the node it belongs to.
 */
function Connector({ last }: { last: boolean }) {
  if (last) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute top-4 -bottom-7 left-[0.40625rem] w-px bg-gradient-to-b from-white/20 to-white/5 lg:hidden"
      />
      <span
        aria-hidden="true"
        className="absolute top-[0.40625rem] -right-6 left-4 hidden h-px bg-gradient-to-r from-white/20 to-white/5 lg:block"
      />
    </>
  );
}

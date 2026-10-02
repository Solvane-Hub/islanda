import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';
import { cn } from '@/lib/utils/cn';
import type { Milestone } from '@/services/progress';

/**
 * What requires attention.
 *
 * The left module of the workspace — the reference's "Tasks" panel, in
 * Islanda terms. ⚠ It invents nothing: every item is real state the founder
 * can act on — the next move `buildJourney()` computed, and the intake slots
 * that are genuinely unanswered, each linking to the route that resolves it.
 * When there is nothing outstanding it says so and points at Nova, rather than
 * manufacturing a task to fill the space.
 */
export interface PriorityItem {
  label: string;
  href: string;
}

export function DashboardPriorities({
  nextMove,
  openItems,
  className,
}: {
  /** The single next move from the journey, or null when up to date. */
  nextMove: Milestone | null;
  /** Intake slots that are not yet established. Real, each with its edit route. */
  openItems: readonly PriorityItem[];
  className?: string;
}) {
  const count = (nextMove ? 1 : 0) + openItems.length;

  return (
    <WorkspaceSurface
      as="section"
      tone="inset"
      aria-labelledby="priorities-heading"
      className={cn('flex flex-col gap-4 p-5 sm:p-6', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SurfaceLabel id="priorities-heading">Priorities</SurfaceLabel>
        {count > 0 ? (
          <span data-numeric className="text-2xs text-on-glass-subtle tracking-[0.08em]">
            {count} open
          </span>
        ) : null}
      </div>

      {count === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-1 py-2">
          <p className="text-on-ink text-sm font-medium">Nothing waiting on you.</p>
          <Link
            href="/assistant"
            className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 rounded-sm text-xs transition-colors duration-150"
          >
            Investigate with Nova
            <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {nextMove ? (
            <li>
              <Link
                href={nextMove.href ?? '/intake'}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/5"
              >
                <span
                  aria-hidden="true"
                  className="bg-bahama-turquoise ring-bahama-turquoise/25 mt-1 size-2 shrink-0 rounded-full ring-4"
                />
                <span className="min-w-0">
                  <span className="text-on-ink block truncate text-sm font-medium">
                    {nextMove.title}
                  </span>
                  <span className="text-2xs text-bahama-turquoise block font-medium tracking-[0.12em] uppercase">
                    Next move
                  </span>
                  {nextMove.description ? (
                    <span className="text-on-ink-muted mt-1 block text-xs text-pretty">
                      {nextMove.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ) : null}

          {openItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/5"
              >
                <span
                  aria-hidden="true"
                  className="mt-1 size-2 shrink-0 rounded-full ring-1 ring-white/40"
                />
                <span className="min-w-0">
                  <span className="text-on-ink block truncate text-sm">{item.label}</span>
                  <span className="text-2xs text-on-glass-subtle block tracking-[0.12em] uppercase">
                    Needs your answer
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceSurface>
  );
}

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';
import { cn } from '@/lib/utils/cn';
import type { Milestone } from '@/services/progress';

/**
 * What to do next — the dashboard's first answer.
 *
 * One primary action, as a real button, then the questions that still need an
 * answer. ⚠ It invents nothing: the primary action is the move
 * `buildJourney()` (or the dashboard's fixed foundational cascade) computed,
 * and each "still to answer" item is an intake slot that is genuinely
 * unanswered, linking to the step that resolves it. With nothing outstanding
 * it says so and offers one optional thing to try, rather than manufacturing
 * a task to fill the space.
 */
export interface PriorityItem {
  label: string;
  href: string;
}

export function DashboardPriorities({
  nextMove,
  openItems,
  canAsk,
  className,
}: {
  /** The single next move, or null when nothing is outstanding. */
  nextMove: Milestone | null;
  /** Intake slots that are not yet answered. Real, each with its edit route. */
  openItems: readonly PriorityItem[];
  /** Whether Nova is released here; when not, the "ask a question" suggestion is left out. */
  canAsk: boolean;
  className?: string;
}) {
  // The next move often IS "answer the remaining questions"; listing those
  // questions again underneath it is the same item twice (they are also listed,
  // one by one, in "Your business information" just below).
  const others = nextMove?.href?.startsWith('/intake') ? [] : openItems;

  return (
    <WorkspaceSurface
      as="section"
      tone="shell"
      aria-labelledby="next-step-heading"
      className={cn('flex flex-col gap-5 p-6 sm:p-8', className)}
    >
      <SurfaceLabel as="h2" id="next-step-heading">
        What to do next
      </SurfaceLabel>

      {nextMove ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-on-ink text-xl font-semibold tracking-[-0.015em] text-balance">
              {nextMove.title}
            </p>
            {nextMove.description ? (
              <p className="text-on-ink-muted max-w-xl text-sm text-pretty">
                {nextMove.description}
              </p>
            ) : null}
          </div>
          <Link
            href={nextMove.href ?? '/intake'}
            className={cn(buttonVariants({ size: 'lg' }), 'w-fit rounded-full pr-4 pl-5')}
          >
            {nextMove.actionLabel ?? 'Start'}
            <ArrowRight aria-hidden="true" strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-on-ink text-base font-medium">You&apos;re up to date.</p>
          <p className="text-on-ink-muted max-w-xl text-sm text-pretty">
            {canAsk
              ? 'There’s nothing waiting on you. You can keep your figures and documents current, or ask a question about your business.'
              : 'There’s nothing waiting on you. You can keep your figures and documents current.'}
          </p>
          {canAsk ? (
            <Link
              href="/assistant"
              className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm font-medium transition-colors duration-150"
            >
              Ask a question
              <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      )}

      {others.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <p className="text-on-ink-muted text-sm">Still to answer:</p>
          <ul className="-mx-2 flex flex-wrap gap-1">
            {others.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-on-ink inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors duration-150 hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full ring-1 ring-white/40"
                  />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WorkspaceSurface>
  );
}

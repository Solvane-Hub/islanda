import { cn } from '@/lib/utils/cn';

/**
 * The Nova workspace canvas.
 *
 * ## Why this exists
 *
 * The previous composition was a column: header, composer, banner, finding,
 * finding, finding. That is the shape of a document, and it is why the surface
 * read as a research database no matter how the individual pieces were styled.
 * The problem was never the cards — it was that everything was the same width,
 * stacked, in one reading order.
 *
 * The reference dashboards share one structural idea, and it is not
 * glassmorphism: a **focal area with contextual modules arranged around it**.
 * The property dashboard puts the building at the centre with borrower, LTV and
 * DSCR panels orbiting it. The management dashboard puts the timeline at the
 * centre with files, team and projects around it. Not one of them is a column.
 *
 * Translated for Nova:
 *
 *     FOCUS    what Nova said, and the passages behind it
 *     CONTEXT  what Nova searched, what supports it, where to go next
 *
 * The focus column is where a founder reads. The context rail is where they
 * check. Keeping them side by side is what makes evidence feel like it supports
 * the conversation rather than replacing it — on a stack, the evidence simply
 * buries the answer.
 *
 * ## Why the rail is sticky
 *
 * A founder scrolling through five passages should not lose the constellation
 * or the source index. The rail holds them in view for the whole read, which is
 * the practical version of "evidence remains visible".
 *
 * ## Collapse
 *
 * Below `lg` the rail moves BELOW the focus rather than beside it, and keeps
 * its order: knowledge, then sources, then next steps. The conversation stays
 * primary on every width — the one thing that must never be pushed below the
 * fold is what Nova said.
 *
 * Layout only. No state, no data, no opinion about what goes in either slot.
 */

export function NovaCanvas({
  focus,
  rail,
  className,
}: {
  /** The conversation and the passages behind it. Always primary. */
  focus: React.ReactNode;
  /** Contextual modules. Sticky beside the focus on wide screens. */
  rail?: React.ReactNode;
  className?: string;
}) {
  if (!rail) {
    return <div className={cn('min-w-0', className)}>{focus}</div>;
  }

  return (
    <div
      className={cn(
        'grid min-w-0 gap-6 lg:gap-8',
        // Asymmetric, deliberately. An even split would make the rail compete
        // with the answer; ~1.7:1 keeps the conversation dominant while leaving
        // the rail wide enough for a document title to breathe.
        'lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,1fr)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">{focus}</div>

      <aside
        aria-label="Investigation context"
        className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start"
      >
        {rail}
      </aside>
    </div>
  );
}

/**
 * A module in the context rail.
 *
 * Deliberately lighter than `WorkspaceSurface`: hairline, no shadow, no blur.
 * The rail sits beside the focal area and must recede from it — three fully
 * elevated panels next to the answer would read as four competing cards, which
 * is the composition this canvas exists to break.
 */
export function RailModule({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bg-abyss/35 flex min-w-0 flex-col gap-3 rounded-xl border border-white/8 p-4',
        className,
      )}
    >
      {label}
      {children}
    </section>
  );
}

import { cn } from '@/lib/utils/cn';

/**
 * The Islanda system window — an environment, not a card.
 *
 * Two things make it read as software rather than as a marketing panel:
 *
 *  1. Its interior (`abyss`) is DARKER than the surface it sits in (`marine`),
 *     so it reads as inset — you look into the system rather than at a card
 *     floating above it. There is no drop shadow anywhere in this component.
 *  2. A 1px inner highlight along the top edge, which is what a recess catches
 *     from light falling from above. That single line does the work an entire
 *     shadow stack usually fails to do.
 *
 * The stage header is part of the chrome: the window always shows where the
 * reader is in the sequence, so progress is legible even mid-section.
 */
export interface WindowStage {
  index: string;
  label: string;
}

export function AppWindow({
  stages,
  active,
  children,
  className,
}: {
  stages: readonly WindowStage[];
  active: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-marine-line/80 bg-abyss relative overflow-hidden rounded-2xl border',
        className,
      )}
    >
      {/* Light catching the top lip of the recess. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
      />

      {/* Stage header */}
      <div className="border-marine-line/60 flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-5 py-3.5 sm:px-7">
        <span className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
          Islanda workspace
        </span>

        <ol className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {stages.map((stage, i) => (
            <li key={stage.index} className="flex items-center gap-2">
              <span
                data-numeric
                className={cn(
                  'text-2xs font-medium tabular-nums transition-colors duration-500',
                  i <= active ? 'text-bahama-turquoise' : 'text-on-ink-subtle',
                )}
              >
                {stage.index}
              </span>
              <span
                className={cn(
                  'text-2xs font-medium tracking-wide uppercase transition-colors duration-500',
                  i === active
                    ? 'text-on-ink'
                    : i < active
                      ? 'text-on-ink-muted'
                      : 'text-on-ink-subtle',
                )}
              >
                {stage.label}
              </span>
            </li>
          ))}
        </ol>

        <span className="border-marine-line/80 text-on-ink-subtle text-2xs ml-auto rounded-full border px-2 py-0.5 font-medium">
          Example
        </span>
      </div>

      <div className="px-5 py-7 sm:px-7 sm:py-9">{children}</div>
    </div>
  );
}

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * What Islanda knows, and where you are in establishing it.
 *
 * The rail used to be five anonymous segments — a position indicator. Naming
 * the slots turns it into a statement about the business profile: a founder can
 * see at a glance which of the five things Islanda holds, which one is in
 * front of them, and what is still missing. That is the same information the
 * dashboard dial and the review screen report, in the same vocabulary.
 *
 * A slot already established is a LINK back to it. Unresolved slots stay as
 * status indicators; their dedicated actions live in dashboard and review.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * `role="progressbar"` stays, with its original label and value semantics, but
 * it now sits on the numeric readout rather than wrapping the slots: a
 * progressbar is a leaf widget, and wrapping five links in one would hide them.
 * The slots are an ordered list inside a labelled `nav`, with `aria-current`
 * on the step being shown. Each slot states its condition in words — "known",
 * "current", "not yet" — so nothing depends on the dot's colour.
 *
 * ── Nova ────────────────────────────────────────────────────────────────────
 *
 * `state` comes straight from `readKnowledge()`. When a slot can be
 * `needs_confirmation`, it becomes a third dot and a third word here; no
 * restructure, and no caller changes.
 */
export interface RailSlot {
  step: number;
  /** Short form for the rail — the question itself is the page's headline. */
  label: string;
  known: boolean;
}

export function IntakeProgress({
  completed,
  total,
  current,
  title,
  slots,
}: {
  /** Slots Islanda holds, from `intakeProgress()`. */
  completed: number;
  total: number;
  /** The step being shown, which may be one ahead of what is known. */
  current: number;
  /** The step's own title, from `INTAKE_STEPS`. */
  title: string;
  slots: readonly RailSlot[];
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p
          role="progressbar"
          aria-label="Intake progress"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${completed} of ${total} known`}
          className="flex shrink-0 items-baseline gap-1.5"
        >
          <span data-numeric className="text-on-ink text-sm font-semibold tracking-[-0.01em]">
            {pad(completed)}
          </span>
          <span data-numeric className="text-on-glass-subtle text-2xs tracking-[0.08em]">
            / {pad(total)}
          </span>
          <span className="text-champagne text-2xs ml-1.5 font-medium tracking-[0.14em] uppercase">
            known
          </span>
        </p>

        <p className="text-on-ink-muted text-xs">
          Now: <span className="text-on-ink">{title}</span>
        </p>
      </div>

      <nav aria-label="Intake sections">
        <ol className="grid grid-cols-5 gap-x-1 gap-y-1.5 sm:flex sm:flex-nowrap">
          {slots.map((slot) => (
            <li key={slot.step} className="min-w-0 sm:flex-1 sm:basis-[5.5rem]">
              <Slot slot={slot} current={slot.step === current} />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

function Slot({ slot, current }: { slot: RailSlot; current: boolean }) {
  // Words, not just the dot — SC 1.4.1.
  const condition = slot.known ? 'known' : current ? 'current, not yet answered' : 'not yet known';

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-1 w-full rounded-full transition-colors duration-150',
          slot.known ? 'bg-bahama-turquoise' : current ? 'bg-bahama-turquoise/60' : 'bg-white/12',
        )}
      />
      <span className="flex min-w-0 items-center gap-1">
        {slot.known ? (
          <Check
            aria-hidden="true"
            className="text-bahama-turquoise size-2.5 shrink-0"
            strokeWidth={4}
          />
        ) : null}
        <span
          className={cn(
            'text-2xs min-w-0 truncate font-medium tracking-[0.1em] uppercase',
            current ? 'text-on-ink' : slot.known ? 'text-on-ink-muted' : 'text-on-glass-subtle',
          )}
        >
          {slot.label}
        </span>
      </span>
      <span className="sr-only">{condition}</span>
    </>
  );

  const shell = 'flex w-full flex-col gap-2 rounded-md pt-1 pb-0.5';

  // Only what is already established is reachable from the progress rail.
  if (slot.known && !current) {
    return (
      <Link href={`/intake?step=${slot.step}`} className={cn(shell, 'group')}>
        {body}
      </Link>
    );
  }

  return (
    <span className={shell} aria-current={current ? 'step' : undefined}>
      {body}
    </span>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

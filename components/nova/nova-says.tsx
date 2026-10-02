'use client';

import { NovaMark } from '@/components/ui/nova-mark';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import type { NovaNarration } from '@/lib/nova/narration';
import type { NovaState } from '@/components/ui/nova-mark';

/**
 * Nova speaking.
 *
 * ## Conversational without being a chat
 *
 * This is the human-readable layer the evidence supports. It is written in the
 * first person and reads as speech — but there are no bubbles, no avatar, no
 * left/right alternation and no transcript, because none of those describe what
 * is happening. Nova is not exchanging messages; it performed a search and is
 * telling you what it did.
 *
 * The mark sits beside the words as the speaker's identity, at the size where
 * its convergence is legible. That is the whole visual signature: no portrait,
 * no orb.
 *
 * ## ⚠ What these words are, and are not
 *
 * Every sentence describes NOVA'S SEARCH — how many passages, across how many
 * documents, where the closest match sits, what could not be established.
 * None interprets a provision. `lib/nova/narration.ts` holds that line and
 * explains why; this component only renders what it produces.
 *
 * The lead is rendered at reading size rather than as a caption, because it is
 * the answer to "what happened" and a founder should get it before deciding
 * whether to read four passages of statute.
 */

export function NovaSays({
  narration,
  state,
  question,
  onContinue,
}: {
  narration: NovaNarration;
  state: NovaState;
  /** Shown above, so the founder can see what was actually asked. */
  question: string;
  /**
   * Runs a new investigation. Omitted where nothing can be run — the panel then
   * renders Nova's account of the search without the offer to continue.
   */
  onContinue?: (question: string) => void;
}) {
  // Bound once so the handler closes over a value TypeScript has already
  // narrowed — no non-null assertion inside the callback.
  const continuation = narration.continuation;

  return (
    <section aria-labelledby="nova-says-heading" className="flex flex-col gap-5">
      {/*
        The question, restated. Not a chat bubble — a quiet restatement, so a
        founder returning to the screen knows what this answer belongs to.
      */}
      <div className="flex flex-col gap-1.5 px-1">
        <SurfaceLabel as="p" className="text-on-glass-subtle">
          You asked
        </SurfaceLabel>
        <p className="text-on-ink-muted text-sm text-pretty">{question}</p>
      </div>

      <div className="flex items-start gap-4 sm:gap-5">
        <NovaMark state={state} size={40} className="mt-0.5 shrink-0" />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 id="nova-says-heading" className="sr-only">
            What Nova found
          </h2>

          {/*
            The acknowledgement.

            Deliberately subordinate to the lead — smaller and quieter — because
            it carries no information. It exists so the exchange opens like an
            investigation rather than a query returning, and giving it the same
            weight as the sentence that reports what was actually found would
            invert their importance.
          */}
          <p className="text-on-glass-subtle text-sm">{narration.opener}</p>

          {/* Reading size. This is the answer to "what happened". */}
          <p className="text-on-ink text-base leading-relaxed text-pretty sm:text-lg">
            {narration.lead}
          </p>

          {narration.detail ? (
            <p className="text-on-ink-muted text-sm leading-relaxed text-pretty sm:text-base">
              {narration.detail}
            </p>
          ) : null}

          {/*
            The caveat is champagne, not amber. An unestablished position is the
            system working correctly — it is not a warning, and styling it as
            one would teach founders to skim past the most important sentence on
            the screen.
          */}
          {narration.caveat ? (
            <p className="text-champagne border-champagne/30 border-l-2 pl-4 text-sm leading-relaxed text-pretty">
              {narration.caveat}
            </p>
          ) : null}

          {narration.invitation ? (
            <p className="text-on-glass-subtle text-xs text-pretty">{narration.invitation}</p>
          ) : null}

          {/*
            Nova offering the next thread.

            ## ⚠ Why this is a question and not a chip

            A row of chips is a menu: the product decided what you might want and
            laid out the options. A question is an investigator noticing
            something and asking whether to follow it. Same click, different
            relationship — and this one is honest, because the thing Nova offers
            to trace is a document THIS answer already cites, named from its own
            metadata.

            The exact question is printed underneath. Nothing is hidden behind a
            friendly phrase: the founder sees the words that will be searched
            before pressing anything, and pressing it runs a complete fresh
            retrieval, exactly as typing them would.
          */}
          {continuation && onContinue ? (
            <div className="mt-1 flex flex-col items-start gap-2 border-l-2 border-white/10 pl-4">
              <p className="text-on-ink-muted text-sm text-pretty">{continuation.prompt}</p>

              <button
                type="button"
                onClick={() => onContinue(continuation.question)}
                className="text-bahama-turquoise hover:border-bahama-turquoise/60 focus-visible:ring-bahama-turquoise/60 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-white/5 focus-visible:ring-2 focus-visible:outline-none"
              >
                Yes — trace that
              </button>

              <p className="text-on-glass-subtle text-2xs text-pretty">
                Nova will search for: &ldquo;{continuation.question}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

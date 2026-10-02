'use client';

import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NovaMark } from '@/components/ui/nova-mark';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import { settledNovaState } from '@/components/nova/nova-activity';
import { summariseEntry, type NovaThread as Thread } from '@/lib/nova/thread';

/**
 * Prior investigations in this session.
 *
 * ## ⚠ Why this is not a chat transcript
 *
 * Visually it would be trivial to render these as messages — question above,
 * answer below, alternating. That is precisely what must not happen, because
 * it would say Nova remembers, and Nova does not (ADR-0017). Every entry here
 * was a complete, independent retrieval run; Nova did not know the earlier ones
 * existed when it answered the later ones.
 *
 * So the treatment is a **record of work**, not a conversation:
 *
 *   • Collapsed to one line each. A transcript shows full turns; a log shows
 *     what was done.
 *   • Each row carries a re-run affordance, because re-running is the only
 *     thing you can actually do with a past investigation.
 *   • The section states plainly that each was answered independently. That
 *     sentence is the difference between a feature and a false promise, and a
 *     test asserts it is present.
 *   • No left/right alignment, no bubbles, no avatars, no "you said".
 *
 * The summary is counts only. "3 passages · 1 left open" is a fact about the
 * run; "found the licensing requirement" would be an interpretation nothing
 * computed.
 */

export function NovaThread({
  entries,
  onRerun,
  disabled,
  className,
}: {
  /** Prior investigations, oldest first. The current one is rendered separately. */
  entries: Thread;
  onRerun: (question: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="nova-thread-heading" className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
        <SurfaceLabel as="h2" id="nova-thread-heading" className="text-on-glass-subtle">
          Earlier in this session
        </SurfaceLabel>
        <p className="text-on-glass-subtle text-2xs">
          Each was answered independently. Nova keeps no memory between them.
        </p>
      </div>

      <ol className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.id} className="border-t border-white/8 first:border-t-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRerun(entry.question)}
              className="group flex w-full min-w-0 items-center gap-3.5 rounded-lg px-2 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {/*
                The mark, at the state that investigation settled in. A row that
                ended in a refusal shows a contracted field — so the log is
                scannable for "what did I actually establish" without opening
                anything.
              */}
              <NovaMark
                state={settledNovaState(entry.answer)}
                size={20}
                label={`Result: ${summariseEntry(entry)}`}
              />

              <span className="min-w-0 flex-1">
                <span className="text-on-ink-muted group-hover:text-on-ink block truncate text-sm transition-colors duration-150">
                  {entry.question}
                </span>
                <span className="text-on-glass-subtle text-2xs mt-0.5 block" data-numeric>
                  {summariseEntry(entry)}
                </span>
              </span>

              <RotateCw
                aria-hidden="true"
                className="text-on-glass-subtle group-hover:text-bahama-turquoise size-3.5 shrink-0 transition-colors duration-150"
                strokeWidth={2}
              />
              <span className="sr-only">— run this investigation again</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { KnowledgeState } from '@/services/intake';

/**
 * What Islanda knows about the business.
 *
 * A typeset operating profile, not a form summary and not a table of rows:
 * each value gets a cell, the label sits above it in small caps and the value
 * is set large enough to be read as a fact rather than as a field. That is the
 * difference between a definition list and an instrument panel, and it is what
 * lets the five pieces of business knowledge carry a section on their own.
 *
 * Empty values remain visible with their actual state. A row of dashes is a
 * database record wearing a design; a clear request for the founder's answer
 * is the honest version.
 *
 * Editing reuses routes that already exist — Settings for the business record,
 * `/intake?step=n` for each answer. No new persistence, no new contract.
 */
export interface SnapshotRow {
  label: string;
  value?: string;
  /** Where this value is edited. Existing routes only. */
  href: string;
  /** Defaults to known for the existing component contract. */
  state?: KnowledgeState;
}

const STATE_COPY: Record<KnowledgeState, { label: string; action: string; fallback: string }> = {
  known: { label: 'Known', action: 'Edit', fallback: 'Recorded' },
  declined: { label: 'Open question', action: 'Review', fallback: 'No figure yet' },
  needs_confirmation: {
    label: 'Needs confirmation',
    action: 'Review and confirm',
    fallback: 'Review this detail',
  },
  unknown: { label: 'Needs your answer', action: 'Answer', fallback: 'Not answered yet' },
};

export function BusinessSnapshot({
  rows,
  unanswered,
  className,
}: {
  rows: readonly SnapshotRow[];
  /** How many intake questions remain, for the honest footnote. */
  unanswered: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 sm:gap-x-8 xl:grid-cols-5">
        {rows.map((row) => {
          const state = row.state ?? 'known';
          const copy = STATE_COPY[state];
          return (
            <div key={row.label} className="group flex min-w-0 flex-col gap-1.5">
              <dt className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                {row.label}
              </dt>
              <dd className="flex min-w-0 flex-col gap-1.5">
                <span className="text-on-ink min-w-0 text-base font-medium tracking-[-0.01em] text-pretty">
                  {row.value ?? copy.fallback}
                </span>
                <span className="text-2xs text-on-glass-subtle tracking-[0.08em] uppercase">
                  {copy.label}
                </span>
                <Link
                  href={row.href}
                  aria-label={`${copy.action} ${row.label.toLowerCase()}`}
                  className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm text-xs font-medium transition-colors duration-150"
                >
                  {copy.action}
                  <Pencil aria-hidden="true" className="size-3" strokeWidth={1.75} />
                </Link>
              </dd>
            </div>
          );
        })}
      </dl>

      {unanswered > 0 ? (
        <p className="text-on-ink-muted mt-7 text-sm">
          <span className="text-on-ink font-medium">Needs your attention:</span>{' '}
          <span data-numeric>{unanswered}</span>{' '}
          {unanswered === 1
            ? 'part of your profile needs review.'
            : 'parts of your profile need review.'}{' '}
          <Link
            href="/intake"
            className="text-bahama-turquoise hover:text-on-ink underline underline-offset-4 transition-colors duration-150"
          >
            Continue intake
          </Link>
        </p>
      ) : null}
    </div>
  );
}

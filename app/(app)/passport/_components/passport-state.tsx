import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { BusinessPassport } from '@/services/passport';
import { PassportEntry, PassportSectionHead } from './passport-field';
import { PassportPage } from './passport-page';
import { nextAction } from './passport-cover-data';

/**
 * Page 04 — the standing of the business, entered as record lines.
 *
 * Regulatory is deliberately absent: the catalog and every business's
 * requirement rows are genuinely empty, and an empty "Regulatory" entry on a
 * record page would read as "nothing required" rather than the true "not
 * evaluated yet". A document that prints a clean line it cannot stand behind
 * is worse than one that stays silent.
 */
export function PassportState({
  passport,
  totalPages,
  reference,
}: {
  passport: BusinessPassport;
  totalPages: number;
  reference: string;
}) {
  const { financials, goals, documents, completeness } = passport;
  const next = nextAction(passport);

  return (
    <PassportPage
      title="State"
      subtitle="Current business state"
      pageNumber={4}
      totalPages={totalPages}
      reference={reference}
    >
      <section>
        <PassportSectionHead index={1} label="Financials" />
        {financials.hasData ? (
          <>
            {financials.currentPeriodLabel ? (
              <p className="text-passport-ink-muted text-3xs mt-2 tracking-[0.12em] uppercase">
                Period · {financials.currentPeriodLabel}
              </p>
            ) : null}
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {[...financials.recorded, ...financials.derived].map((m) => (
                <div key={m.key} className="border-passport-line/60 min-w-0 border-b pb-2">
                  <dt className="text-passport-accent/90 text-4xs font-medium tracking-[0.18em] uppercase">
                    {m.label}
                  </dt>
                  <dd
                    className="text-passport-ink mt-1 font-mono text-[0.8125rem] font-medium"
                    data-numeric
                  >
                    {m.display}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-passport-ink-muted/80 mt-2 text-[0.8125rem] italic">
            — no financial figures recorded
          </p>
        )}
      </section>

      <section className="mt-5">
        <PassportSectionHead index={2} label="Goals" />
        {goals.length > 0 ? (
          <div className="mt-1">
            {goals.map(({ goal, progress }) => (
              <PassportEntry
                key={goal.id}
                label={goal.title}
                value={progress.percent !== null ? `${progress.percent}%` : 'not measured'}
                muted={progress.percent === null}
              />
            ))}
          </div>
        ) : (
          <p className="text-passport-ink-muted/80 mt-2 text-[0.8125rem] italic">— no goals set</p>
        )}
      </section>

      <section className="mt-5">
        <PassportSectionHead index={3} label="Record" />
        <div className="mt-1">
          <PassportEntry
            label="Documents held"
            value={documents.length > 0 ? `${documents.length}` : 'none'}
            muted={documents.length === 0}
          />
          <PassportEntry
            label="Profile completeness"
            value={
              completeness.intake.isComplete
                ? 'complete'
                : `${completeness.intake.percent}% · ${completeness.intake.completed} of ${completeness.intake.total}`
            }
            muted={!completeness.intake.isComplete}
          />
        </div>
      </section>

      <section className="mt-5">
        <PassportSectionHead index={4} label="Next action" />
        <Link
          href={next.href}
          className="border-passport-line/80 bg-passport-paper-raised/60 hover:border-passport-accent/50 mt-2.5 flex items-center justify-between gap-3 border px-3.5 py-3 transition-colors duration-150"
        >
          <span className="text-passport-ink text-[0.8125rem] font-medium">{next.label}</span>
          <ChevronRight
            aria-hidden="true"
            className="text-passport-accent size-4 shrink-0"
            strokeWidth={2}
          />
        </Link>
      </section>
    </PassportPage>
  );
}

import Link from 'next/link';
import { ChevronRight, FileText, Landmark, Target, UserRound } from 'lucide-react';
import type { BusinessPassport } from '@/services/passport';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import { PassportMonogram } from './passport-monogram';
import { PassportPage } from './passport-page';
import { businessStateRows, nextAction, passportReference } from './passport-cover-data';

const ROW_ICONS = [Landmark, Target, FileText, UserRound] as const;

/**
 * Page 01 — the living snapshot printed opposite the cover.
 *
 * Every figure here is a real Passport field; an absent one prints as its
 * honest absence ("not started", "none yet") rather than a zero. Each entry
 * is also the doorway into the module that actually owns that data, which is
 * the whole division of labour: the Passport states, the modules work.
 */
export function PassportOverview({
  passport,
  totalPages,
}: {
  passport: BusinessPassport;
  totalPages: number;
}) {
  const { identity } = passport;
  const primaryName = identity.tradingName ?? identity.legalName;
  const stageLabel = identity.stage
    ? (BUSINESS_STAGE_LABELS[identity.stage as BusinessStage] ?? identity.stage)
    : null;
  const jurisdiction = identity.jurisdictionName ?? identity.countryCode;
  const reference = passportReference(passport.businessId);
  const rows = businessStateRows(passport);
  const next = nextAction(passport);

  const summary = [jurisdiction, identity.operatingStatus, stageLabel].filter(Boolean).join(' · ');

  return (
    <PassportPage
      title="Business Overview"
      subtitle="Live business snapshot"
      pageNumber={1}
      totalPages={totalPages}
      reference={reference}
    >
      {/* Bearer block — the mark, the name, the standing. */}
      <div className="flex items-start gap-4">
        <PassportMonogram name={primaryName} logoUrl={passport.logoUrl} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-passport-ink text-base leading-tight font-semibold text-pretty">
            {primaryName ?? 'Unnamed business'}
          </p>
          {summary ? (
            <p className="text-passport-ink-muted text-3xs mt-1.5 tracking-[0.1em] uppercase">
              {summary}
            </p>
          ) : null}
          <p className="text-passport-accent/85 text-4xs mt-3 font-medium tracking-[0.22em] uppercase">
            Passport ref.
          </p>
          <p className="text-passport-ink text-3xs mt-0.5 font-mono tracking-[0.14em]">
            {reference}
          </p>
        </div>
      </div>

      <section className="mt-6">
        <div className="flex items-baseline gap-2.5">
          <span className="text-passport-ink text-3xs font-semibold tracking-[0.2em] uppercase">
            Business State
          </span>
          <span aria-hidden="true" className="bg-passport-line/70 h-px flex-1" />
        </div>

        <ul className="mt-1">
          {rows.map((row, i) => {
            const Icon = ROW_ICONS[i] ?? FileText;
            const recorded = !/^(not started|none yet)$/i.test(row.value);
            return (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="border-passport-line/60 group flex items-center justify-between gap-4 border-b py-2.5"
                >
                  <span className="text-passport-ink-muted group-hover:text-passport-ink flex min-w-0 items-center gap-2.5 text-[0.8125rem] transition-colors duration-150">
                    <Icon
                      aria-hidden="true"
                      className="text-passport-accent/70 size-3.5 shrink-0"
                      strokeWidth={1.75}
                    />
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={
                        recorded
                          ? 'bg-passport-accent size-1.5 rounded-full'
                          : 'ring-passport-ink-muted/50 size-1.5 rounded-full ring-1'
                      }
                    />
                    <span className="text-passport-ink text-3xs font-medium tracking-[0.12em] uppercase">
                      {row.value}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="text-passport-ink-muted/70 size-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline gap-2.5">
          <span className="text-passport-ink text-3xs font-semibold tracking-[0.2em] uppercase">
            Next
          </span>
          <span aria-hidden="true" className="bg-passport-line/70 h-px flex-1" />
        </div>
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

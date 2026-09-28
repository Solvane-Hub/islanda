import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import type { BusinessPassport } from '@/services/passport';
import { PassportFieldList, type PassportFieldItem } from './passport-field';
import { PassportMonogram } from './passport-monogram';
import { PassportPage } from './passport-page';

/**
 * Page 02 — the identity page, laid out the way a bio-data page is: the
 * bearer's mark set in a ruled window on one side, the struck fields beside
 * and beneath it.
 *
 * `passport.identity`, verbatim. Country code and jurisdiction are printed
 * as the two distinct values the record actually holds — the stored code and
 * its resolved name — rather than collapsed into one.
 */
export function PassportIdentity({
  passport,
  totalPages,
  reference,
}: {
  passport: BusinessPassport;
  totalPages: number;
  reference: string;
}) {
  const { identity } = passport;
  const primaryName = identity.tradingName ?? identity.legalName;
  const stageLabel = identity.stage
    ? (BUSINESS_STAGE_LABELS[identity.stage as BusinessStage] ?? identity.stage)
    : null;

  const primaryFields: PassportFieldItem[] = [
    { label: 'Legal name', value: identity.legalName },
    { label: 'Trading name', value: identity.tradingName },
  ];

  const secondaryFields: PassportFieldItem[] = [
    { label: 'Business type', value: identity.businessType },
    { label: 'Industry', value: identity.industry },
    { label: 'Country code', value: identity.countryCode, mono: true },
    { label: 'Jurisdiction', value: identity.jurisdictionName },
    { label: 'Stage', value: stageLabel },
    { label: 'Operating status', value: identity.operatingStatus },
  ];

  return (
    <PassportPage
      title="Identity"
      subtitle="Who the business is"
      pageNumber={2}
      totalPages={totalPages}
      reference={reference}
    >
      <div className="flex gap-5">
        {/* The identity window — ruled corners around the mark, the way a
            photograph is framed on a bio-data page. */}
        <div className="relative shrink-0">
          <div className="border-passport-line/80 border p-1.5">
            <PassportMonogram name={primaryName} logoUrl={passport.logoUrl} size={88} />
          </div>
          {(
            [
              'left-0 top-0 border-l border-t',
              'right-0 top-0 border-r border-t',
              'left-0 bottom-0 border-l border-b',
              'right-0 bottom-0 border-r border-b',
            ] as const
          ).map((corner) => (
            <span
              key={corner}
              aria-hidden="true"
              className={`border-passport-accent/60 absolute size-2.5 ${corner}`}
            />
          ))}
          <p className="text-passport-ink-muted/70 text-4xs mt-2 text-center font-medium tracking-[0.18em] uppercase">
            Identity mark
          </p>
        </div>

        <dl className="grid min-w-0 flex-1 grid-cols-1 gap-y-4">
          {primaryFields.map((field) => (
            <div key={field.label} className="min-w-0">
              <PassportFieldList fields={[field]} className="sm:grid-cols-1" />
            </div>
          ))}
        </dl>
      </div>

      <PassportFieldList fields={secondaryFields} className="mt-5" />
    </PassportPage>
  );
}

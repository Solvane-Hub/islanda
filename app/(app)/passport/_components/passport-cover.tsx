import { LogoMark } from '@/components/brand/logo-mark';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import { cn } from '@/lib/utils/cn';
import type { BusinessPassport } from '@/services/passport';
import { PassportLogo } from './passport-logo';
import { PassportRose, PassportSwell } from './passport-ornament';
import { passportReference } from './passport-cover-data';

/**
 * The cover board.
 *
 * Carries only what is struck into a cover: issuer, document title, the
 * business's identity mark, its name, where it operates, and the document's
 * own reference. No business statistics — a cover states what the document
 * IS, and the living state of the business belongs on the pages inside.
 *
 * On desktop this is permanently the left leaf of the open spread; on mobile
 * it is page 01. Identical rendering in both, because it is the same object.
 */
export function PassportCover({
  passport,
  gutter = true,
  className,
}: {
  passport: BusinessPassport;
  /** Inner-edge shading — on only when this board is the left leaf of an open spread. */
  gutter?: boolean;
  className?: string;
}) {
  const { identity } = passport;
  const primaryName = identity.tradingName ?? identity.legalName;
  const stageLabel = identity.stage
    ? (BUSINESS_STAGE_LABELS[identity.stage as BusinessStage] ?? identity.stage)
    : null;
  const jurisdiction = identity.jurisdictionName ?? identity.countryCode;
  const reference = passportReference(passport.businessId);

  return (
    <div
      className={cn(
        'passport-cover-material relative flex min-h-full flex-col items-center overflow-hidden px-6 py-8 text-center sm:px-8 sm:py-10',
        className,
      )}
    >
      {/* Struck border — a double keyline inset from the board's edge, the
          way a cover is blocked before anything is printed on it. */}
      <div
        aria-hidden="true"
        className="ring-passport-foil/15 pointer-events-none absolute inset-3 rounded-[2px] ring-1 sm:inset-4"
      />
      <div
        aria-hidden="true"
        className="ring-passport-foil/8 pointer-events-none absolute inset-[18px] rounded-[1px] ring-1 sm:inset-[22px]"
      />
      <div
        aria-hidden="true"
        className="passport-guilloche text-passport-foil pointer-events-none absolute inset-x-0 top-[26%] h-[46%]"
      />
      {gutter ? (
        <div
          aria-hidden="true"
          className="passport-gutter-inner-right pointer-events-none absolute inset-y-0 right-0 w-24"
        />
      ) : null}

      {/* Issuer */}
      <div className="relative flex items-center gap-2">
        <LogoMark height={13} />
        <span className="passport-foil text-2xs font-semibold tracking-[0.32em] uppercase">
          Islanda
        </span>
      </div>

      {/* Document title */}
      <div className="relative mt-5">
        <h1 className="passport-foil text-base leading-tight font-semibold tracking-[0.2em] uppercase sm:text-lg">
          Business Passport
        </h1>
        <p className="text-passport-foil-dim/70 text-3xs passport-deboss mt-2 font-medium tracking-[0.34em] uppercase">
          Digital Business Record
        </p>
      </div>

      {/* Identity mark, mounted over the engraved rose. */}
      <div className="relative mt-auto mb-auto flex items-center justify-center py-6">
        <PassportRose
          className="text-passport-foil/25 pointer-events-none absolute size-[15rem] max-w-none"
          aria-hidden="true"
        />
        <PassportLogo name={primaryName} logoUrl={passport.logoUrl} size={96} />
      </div>

      {/* Bearer */}
      <div className="relative flex flex-col items-center gap-2">
        <h2 className="passport-foil max-w-[15rem] text-sm font-semibold tracking-[0.16em] text-balance uppercase sm:text-base">
          {primaryName ?? 'Unnamed business'}
        </h2>
        <div className="text-passport-foil-dim/80 text-3xs passport-deboss flex flex-col items-center gap-1 font-medium tracking-[0.22em] uppercase">
          {jurisdiction ? <span>{jurisdiction}</span> : null}
          {identity.operatingStatus ? <span>{identity.operatingStatus}</span> : null}
          {stageLabel ? <span className="opacity-70">{stageLabel}</span> : null}
        </div>
      </div>

      {/* Document metadata — struck into the foot of the board. Only fields
          the record actually holds: there is no issue date in this product,
          so none is printed. */}
      <div className="border-passport-foil/15 relative mt-6 flex w-full items-end justify-between gap-6 border-t pt-4">
        <div className="text-left">
          <p className="text-passport-foil-dim/60 text-4xs font-medium tracking-[0.24em] uppercase">
            Passport ref.
          </p>
          <p className="text-passport-foil-dim text-2xs mt-1 font-mono tracking-[0.14em]">
            {reference}
          </p>
        </div>
        <div className="text-right">
          <p className="text-passport-foil-dim/60 text-4xs font-medium tracking-[0.24em] uppercase">
            Record type
          </p>
          <p className="text-passport-foil-dim text-2xs mt-1 font-mono tracking-[0.14em] uppercase">
            {passport.mode}
          </p>
        </div>
      </div>

      <PassportSwell
        className="text-passport-foil/20 relative mt-4 h-5 w-full max-w-[16rem]"
        aria-hidden="true"
      />
    </div>
  );
}

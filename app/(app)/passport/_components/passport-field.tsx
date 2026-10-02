import { cn } from '@/lib/utils/cn';

/**
 * A field printed into a page — small struck label above, value below, a
 * hairline closing it.
 *
 * Deliberately NOT a card: no background, no border box, no radius. A data
 * field on a document is defined by its rule and its label, and that is the
 * whole visual vocabulary available here. Absent values print as an em-rule
 * plus "not recorded" rather than being hidden, because a blank line on a
 * record and a line that was never filled in are different facts.
 */
export interface PassportFieldItem {
  label: string;
  value: string | null;
  /** Codes and references are set in mono, the way a document prints them. */
  mono?: boolean;
  /** Long prose fields take the full width of the page. */
  wide?: boolean;
}

export function PassportField({ field }: { field: PassportFieldItem }) {
  const has = typeof field.value === 'string' && field.value.trim().length > 0;

  return (
    <div className="border-passport-line/65 min-w-0 border-b pb-2.5">
      <dt className="text-passport-accent/90 text-3xs font-medium tracking-[0.2em] uppercase">
        {field.label}
      </dt>
      <dd
        className={cn(
          'mt-1.5 text-[0.8125rem] leading-snug text-pretty',
          field.mono && 'font-mono tracking-[0.06em]',
          has ? 'text-passport-ink' : 'text-passport-ink-muted/80 italic',
        )}
      >
        {has ? field.value : '— not recorded'}
      </dd>
    </div>
  );
}

export function PassportFieldList({
  fields,
  className,
}: {
  fields: readonly PassportFieldItem[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2', className)}>
      {fields.map((field) => (
        <div key={field.label} className={cn('min-w-0', field.wide && 'sm:col-span-2')}>
          <PassportField field={field} />
        </div>
      ))}
    </dl>
  );
}

/**
 * A numbered section head — "01 ACTIVITIES" — with the rule that carries it.
 * Sections on a document are numbered because the numbering is part of how
 * the document is referenced, not because numbers look tidy.
 */
export function PassportSectionHead({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-passport-accent text-3xs font-mono tabular-nums">
        {String(index).padStart(2, '0')}
      </span>
      <span className="text-passport-ink text-3xs font-semibold tracking-[0.2em] uppercase">
        {label}
      </span>
      <span aria-hidden="true" className="bg-passport-line/70 h-px flex-1" />
    </div>
  );
}

/**
 * A ruled entry line — label left, value right — for record pages where the
 * pairing matters more than the prose.
 */
export function PassportEntry({
  label,
  value,
  muted,
  icon,
}: {
  label: string;
  value: string;
  /** `true` when the value is an absence ("none yet") rather than a reading. */
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-passport-line/60 flex items-baseline justify-between gap-4 border-b py-2.5">
      <span className="text-passport-ink-muted flex min-w-0 items-center gap-2 text-[0.8125rem]">
        {icon ? (
          <span aria-hidden="true" className="text-passport-accent/70 shrink-0">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          'text-3xs shrink-0 font-medium tracking-[0.12em] uppercase',
          muted ? 'text-passport-ink-muted/80' : 'text-passport-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

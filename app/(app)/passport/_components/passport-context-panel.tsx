import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BusinessPassport } from '@/services/passport';
import type { PassportPageId } from './passport-navigation';

const NOTES: Record<PassportPageId, { heading: string; body: string }> = {
  cover: {
    heading: 'The cover',
    body: 'States what this document is and who holds it. Business figures live on the pages inside, never on the board.',
  },
  overview: {
    heading: 'Overview',
    body: 'A live snapshot assembled from your records each time the page loads. Every line links to the module that owns it.',
  },
  identity: {
    heading: 'Identity',
    body: 'Who the business is on the record — taken verbatim from your business profile. Edit it in Settings.',
  },
  business: {
    heading: 'Business',
    body: 'What the business does, in your own words from intake. Blank sections are shown as blank rather than filled in for you.',
  },
  state: {
    heading: 'State',
    body: 'Where the business stands right now. Regulatory standing is not printed here: nothing has been evaluated yet, and a clean line would be misleading.',
  },
  records: {
    heading: 'Records',
    body: 'Documents held, figures recorded, and which documents are linked to which figures. A link states provenance, not verification.',
  },
};

/**
 * The quiet column beside the document — an explanatory margin, not a second
 * dashboard. It renders only where there is genuine room left over
 * (`2xl` and up), so it can never squeeze the spread itself.
 */
export function PassportContextPanel({
  passport,
  active,
  className,
}: {
  passport: BusinessPassport;
  active: PassportPageId;
  className?: string;
}) {
  const note = NOTES[active];

  return (
    <aside className={cn('flex w-56 shrink-0 flex-col gap-6 pt-1', className)}>
      <div>
        <p className="text-3xs text-on-glass-subtle/60 font-medium tracking-[0.22em] uppercase">
          {note.heading}
        </p>
        <p className="text-on-ink-muted mt-2 text-xs leading-relaxed text-pretty">{note.body}</p>
      </div>

      <div className="border-t border-white/8 pt-5">
        <p className="text-3xs text-on-glass-subtle/60 font-medium tracking-[0.22em] uppercase">
          About this record
        </p>
        <p className="text-on-ink-muted mt-2 text-xs leading-relaxed text-pretty">
          The Passport is a reading of your business data, not a second place to enter it. It holds{' '}
          <span className="text-on-ink">
            {passport.documents.length === 1
              ? '1 document'
              : `${passport.documents.length} documents`}
          </span>{' '}
          and{' '}
          <span className="text-on-ink">
            {passport.goals.length === 1 ? '1 goal' : `${passport.goals.length} goals`}
          </span>
          .
        </p>
        <Link
          href="/settings"
          className="text-on-ink-muted hover:text-on-ink text-3xs mt-4 inline-flex items-center gap-1.5 font-medium tracking-[0.14em] uppercase transition-colors duration-150"
        >
          Edit business information
          <ArrowUpRight aria-hidden="true" className="size-3" strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}

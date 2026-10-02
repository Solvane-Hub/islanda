import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type PassportPageId = 'cover' | 'overview' | 'identity' | 'business' | 'state' | 'records';

/**
 * The document's own order. `cover` is the board; the five numbered entries
 * after it are the interior pages, which is why the folio counts from the
 * first interior page rather than from the cover.
 */
export const PASSPORT_PAGES: readonly { id: PassportPageId; label: string }[] = [
  { id: 'cover', label: 'Cover' },
  { id: 'overview', label: 'Overview' },
  { id: 'identity', label: 'Identity' },
  { id: 'business', label: 'Business' },
  { id: 'state', label: 'State' },
  { id: 'records', label: 'Records' },
];

/** Interior pages only — the cover carries no folio. */
export const PASSPORT_INTERIOR_PAGES = PASSPORT_PAGES.filter((p) => p.id !== 'cover');
export const PASSPORT_TOTAL_PAGES = PASSPORT_INTERIOR_PAGES.length;

/** Folio for an interior page id; `null` for the cover. */
export function interiorPageNumber(id: PassportPageId): number | null {
  const index = PASSPORT_INTERIOR_PAGES.findIndex((p) => p.id === id);
  return index === -1 ? null : index + 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Index tabs — the thumb tabs on the fore-edge of a physical document.
 *
 * These are deliberately NOT app navigation: they are part of the object,
 * sitting proud of the book's right edge on the same board material as the
 * cover, with the active tab pulled further out and struck in foil. They are
 * real `<button>`s at a full 44px touch height, so they are also a genuine
 * direct-jump control, not decoration.
 */
export function PassportIndexTabs({
  active,
  onChange,
  className,
}: {
  active: PassportPageId;
  onChange: (page: PassportPageId) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Passport index" className={cn('flex flex-col gap-1.5 pt-16', className)}>
      {PASSPORT_INTERIOR_PAGES.map((page, index) => {
        const isActive = page.id === active;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onChange(page.id)}
            aria-current={isActive ? 'page' : undefined}
            title={page.label}
            className={cn(
              'passport-cover-material relative flex h-11 w-9 items-center justify-center rounded-r-[3px] border-y border-r transition-[width,color] duration-200 ease-out',
              isActive
                ? 'border-passport-foil/40 text-passport-foil w-11'
                : 'border-passport-foil/15 text-passport-foil-dim/60 hover:text-passport-foil-dim hover:w-10',
            )}
          >
            <span className="text-3xs font-mono font-semibold tracking-[0.06em] tabular-nums">
              {pad(index + 1)}
            </span>
            {isActive ? (
              <span
                aria-hidden="true"
                className="bg-passport-foil/60 absolute inset-y-1.5 left-0 w-px"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The contents list — a document's own table of contents, set outside the
 * book on the desktop rail. Quiet by construction: no boxes, no fills, no
 * icons, a hairline rule marking the active entry. It must not read as a
 * second `SidebarNav`; the app's real navigation is the shell rail, and the
 * Passport is the object being read.
 *
 * The horizontal variant is not that list on its side. Narrow viewports have
 * no rail, and six spelled-out entries do not fit across a 375px document
 * without clipping or a scrollbar through the middle of the object — so there
 * the index becomes the same thumb tabs the desktop object carries, run along
 * the head of the document and struck with the folio alone. The page's own
 * masthead names the page in full; each tab still carries its name for
 * assistive technology and as a tooltip.
 */
export function PassportPageIndex({
  active,
  onChange,
  variant,
  className,
}: {
  active: PassportPageId;
  onChange: (page: PassportPageId) => void;
  variant: 'vertical' | 'horizontal';
  className?: string;
}) {
  if (variant === 'horizontal') {
    return (
      <nav aria-label="Passport pages" className={cn('flex gap-1', className)}>
        {PASSPORT_PAGES.map((page) => {
          const isActive = page.id === active;
          const folio = interiorPageNumber(page.id);
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onChange(page.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={page.label}
              title={page.label}
              className={cn(
                'passport-cover-material flex h-9 flex-1 items-center justify-center rounded-t-[3px] border-x border-t transition-colors duration-200',
                isActive
                  ? 'border-passport-foil/40 text-passport-foil'
                  : 'border-passport-foil/15 text-passport-foil-dim/55 hover:text-passport-foil-dim',
              )}
            >
              <span
                aria-hidden="true"
                className="text-3xs font-mono font-semibold tracking-[0.06em] tabular-nums"
              >
                {folio !== null ? pad(folio) : 'CVR'}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Passport pages" className={cn('flex w-36 shrink-0 flex-col', className)}>
      <p className="text-3xs text-on-glass-subtle/60 mb-3 font-medium tracking-[0.22em] uppercase">
        Contents
      </p>
      {PASSPORT_PAGES.map((page) => {
        const isActive = page.id === active;
        const folio = interiorPageNumber(page.id);
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onChange(page.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex items-baseline gap-2.5 py-1 text-left text-xs transition-colors duration-150',
              isActive ? 'text-champagne' : 'text-on-ink-muted hover:text-on-ink',
            )}
          >
            <span aria-hidden="true" className="font-mono text-[0.625rem] tabular-nums opacity-55">
              {folio !== null ? pad(folio) : '—'}
            </span>
            <span className="tracking-[0.02em]">{page.label}</span>
            <span
              aria-hidden="true"
              className={cn(
                'h-px flex-1 transition-colors duration-150',
                isActive ? 'bg-champagne/40' : 'bg-white/8',
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}

const QUICK_LINKS = [
  { label: 'Financials', href: '/dashboard#financials', icon: TrendingUp },
  { label: 'Goals', href: '/dashboard#goals', icon: Target },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Nova', href: '/assistant', icon: Sparkles },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

/**
 * Doorways into the modules the Passport summarises — "Passport states, the
 * modules work." The quietest element on the rail on purpose.
 */
export function PassportQuickLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Quick links" className={cn('flex w-36 shrink-0 flex-col gap-1.5', className)}>
      <p className="text-3xs text-on-glass-subtle/60 mb-1 font-medium tracking-[0.22em] uppercase">
        Open in Islanda
      </p>
      {QUICK_LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="text-on-glass-subtle hover:text-on-ink-muted flex items-center gap-2 text-xs transition-colors duration-150"
          >
            <Icon aria-hidden="true" className="size-3 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Previous / Next with the folio between them — the second always-visible,
 * always-tappable way to move, in plain normal flow beneath the document.
 * Real `<button>`s with native `disabled` at the ends, `min-h-11` (≈44px)
 * targets, and no dependence on a gesture being recognised.
 */
export function PassportPagerControls({
  active,
  onChange,
  className,
}: {
  active: PassportPageId;
  onChange: (page: PassportPageId) => void;
  className?: string;
}) {
  const index = PASSPORT_PAGES.findIndex((p) => p.id === active);
  const atStart = index <= 0;
  const atEnd = index >= PASSPORT_PAGES.length - 1;
  const folio = interiorPageNumber(active);

  return (
    <div className={cn('flex w-full items-center justify-between gap-3', className)}>
      <button
        type="button"
        onClick={() => !atStart && onChange(PASSPORT_PAGES[index - 1]!.id)}
        disabled={atStart}
        className="text-on-ink-muted hover:text-on-ink -ml-3 inline-flex min-h-11 items-center gap-1.5 px-3 text-xs font-medium tracking-[0.08em] uppercase transition-colors duration-150 disabled:pointer-events-none disabled:opacity-25"
      >
        <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
        Previous
      </button>

      <span className="text-3xs text-on-glass-subtle font-mono tracking-[0.16em] tabular-nums">
        {folio !== null ? `${pad(folio)} / ${pad(PASSPORT_TOTAL_PAGES)}` : 'COVER'}
      </span>

      <button
        type="button"
        onClick={() => !atEnd && onChange(PASSPORT_PAGES[index + 1]!.id)}
        disabled={atEnd}
        className="text-on-ink-muted hover:text-on-ink -mr-3 inline-flex min-h-11 items-center gap-1.5 px-3 text-xs font-medium tracking-[0.08em] uppercase transition-colors duration-150 disabled:pointer-events-none disabled:opacity-25"
      >
        Next
        <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

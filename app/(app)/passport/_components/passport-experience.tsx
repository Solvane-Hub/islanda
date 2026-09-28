'use client';

import { useRef, useState } from 'react';
import type { BusinessPassport } from '@/services/passport';
import { cn } from '@/lib/utils/cn';
import {
  PASSPORT_PAGES,
  PASSPORT_TOTAL_PAGES,
  PassportIndexTabs,
  PassportPageIndex,
  PassportPagerControls,
  PassportQuickLinks,
  type PassportPageId,
} from './passport-navigation';
import { PassportCover } from './passport-cover';
import { PassportOverview } from './passport-overview';
import { PassportIdentity } from './passport-identity';
import { PassportBusiness } from './passport-business';
import { PassportState } from './passport-state';
import { PassportRecords } from './passport-records';
import { PassportContextPanel } from './passport-context-panel';
import { passportReference } from './passport-cover-data';

const PAGE_ORDER = PASSPORT_PAGES.map((p) => p.id);
const SWIPE_THRESHOLD_PX = 48;

/**
 * The Business Passport — a rendering of a physical document, not a themed
 * card. Three things carry that, and all three are structural rather than
 * decorative:
 *
 * 1. THE OBJECT HAS TWO STATES. Closed, it is a single cover board at
 *    document proportions, centred, with nothing else competing with it.
 *    Opened — the moment any interior page is chosen — it becomes a two-leaf
 *    spread with the cover permanently on the left and a printed page on the
 *    right, joined by a real spine. Selecting a page is opening a book, not
 *    swapping a tab panel.
 * 2. THE INDEX TABS SIT OUTSIDE THE BOOK. They protrude past the fore-edge on
 *    the same board material as the cover, the way thumb tabs do, which is
 *    only possible because they live outside the clipped spread.
 * 3. THE MOBILE VIEWER IS THE WHOLE SCREEN. Below `xl` the Passport fills the
 *    available height as a fixed-height column: document above, pager below,
 *    both in normal flow. `MobileBottomNav` suppresses itself on this route,
 *    so nothing of the application frames the object.
 *
 * The spread activates at `xl` (1280px), not `lg` — at 1024px the app's own
 * 208px rail plus the Passport's contents column leave too little room for
 * two readable leaves, and text clipped against the right edge when this was
 * first tried there. The explanatory margin waits until 1700px for the same
 * reason: it must never be the thing that squeezes the document.
 *
 * Previous/Next reliability is structural, not a positioning trick. Both
 * `sticky` and `fixed` pager bars were tried and both still collided with
 * page content, because different pages are genuinely different heights on a
 * viewport that scrolls as a whole. Here the document is a fixed-height,
 * internally-scrolling box and the pager sits in plain flow beneath it, so it
 * occupies the identical screen position on every page. Swipe is layered on
 * top as a third way to move — never the only one.
 */
export function PassportExperience({ passport }: { passport: BusinessPassport }) {
  const [active, setActive] = useState<PassportPageId>('cover');
  const [enterFromX, setEnterFromX] = useState(14);
  const touchStartX = useRef<number | null>(null);

  const reference = passportReference(passport.businessId);
  const isCover = active === 'cover';

  function goTo(next: PassportPageId) {
    if (next === active) return;
    const currentIndex = PAGE_ORDER.indexOf(active);
    const nextIndex = PAGE_ORDER.indexOf(next);
    setEnterFromX(nextIndex > currentIndex ? 14 : -14);
    setActive(next);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;

    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    const currentIndex = PAGE_ORDER.indexOf(active);

    if (dx <= -SWIPE_THRESHOLD_PX && currentIndex < PAGE_ORDER.length - 1) {
      goTo(PAGE_ORDER[currentIndex + 1]!);
    } else if (dx >= SWIPE_THRESHOLD_PX && currentIndex > 0) {
      goTo(PAGE_ORDER[currentIndex - 1]!);
    }
  }

  /** The printed leaf for whichever interior page is open. */
  function interiorLeaf() {
    switch (active) {
      case 'overview':
        return <PassportOverview passport={passport} totalPages={PASSPORT_TOTAL_PAGES} />;
      case 'identity':
        return (
          <PassportIdentity
            passport={passport}
            totalPages={PASSPORT_TOTAL_PAGES}
            reference={reference}
          />
        );
      case 'business':
        return (
          <PassportBusiness
            passport={passport}
            totalPages={PASSPORT_TOTAL_PAGES}
            reference={reference}
          />
        );
      case 'state':
        return (
          <PassportState
            passport={passport}
            totalPages={PASSPORT_TOTAL_PAGES}
            reference={reference}
          />
        );
      case 'records':
        return (
          <PassportRecords
            passport={passport}
            totalPages={PASSPORT_TOTAL_PAGES}
            reference={reference}
          />
        );
      default:
        return null;
    }
  }

  const enterStyle = { '--passport-enter-x': `${enterFromX}px` } as React.CSSProperties;

  /** Board edge + grounded shadow: the same physical treatment at both sizes. */
  const bookEdge =
    'relative overflow-hidden rounded-[3px] border border-black/70 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_30px_70px_-28px_rgba(0,0,0,0.85),0_6px_14px_-8px_rgba(0,0,0,0.6)]';

  return (
    <div className="workspace-env flex flex-col min-[1700px]:gap-10 xl:flex-row xl:items-start xl:justify-center xl:gap-8">
      {/* Contents + module doorways — outside the object, deliberately quiet. */}
      <div className="hidden xl:flex xl:flex-col xl:gap-8 xl:pt-2">
        <PassportPageIndex active={active} onChange={goTo} variant="vertical" />
        <PassportQuickLinks />
      </div>

      {/* ── THE OBJECT, below xl: a full-height viewer, nothing else. ── */}
      {/* The height subtracts exactly what the app frame takes above and below
          this column at each breakpoint — the outer frame padding (0 / 24 /
          32 per side), the 56px header, and `main`'s own vertical padding
          (20 / 28 / 32 per side). Guessing one number for all three left the
          pager below the fold at 1024px, which is the precise failure the
          fixed-height column exists to prevent. The leaf is also capped at
          document proportions: a full-bleed 676px-wide board is a panel, not
          a passport. */}
      <div className="mx-auto flex h-[calc(100dvh-6rem)] min-h-[26rem] w-full max-w-[26rem] flex-col justify-center gap-3 sm:h-[calc(100dvh-10.5rem)] lg:h-[calc(100dvh-12rem)] xl:hidden">
        <PassportPageIndex
          active={active}
          onChange={goTo}
          variant="horizontal"
          /* Negative margin so the tabs meet the head of the board instead of
             floating above it as a separate control. */
          className="-mb-3 shrink-0 px-2"
        />

        {/* Passport proportions (88×125mm) rather than "whatever height is
            left": on a tall tablet the board otherwise stretched into a slab
            no document has ever had. It only loses the ratio when the screen
            is genuinely too short, where it clamps instead of overflowing. */}
        <div className={cn(bookEdge, 'aspect-[88/125] max-h-[calc(100%-5.5rem)] min-h-0 w-full')}>
          <div
            className="passport-leaf-scroll h-full overflow-y-auto"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* `h-full` (not `min-h-full`) gives `PassportPage` the definite
                height its fixed masthead/footer frame needs; the cover inside
                is `min-h-full`, so it can still grow and scroll the leaf. */}
            <div key={active} className="passport-page-in h-full" style={enterStyle}>
              {isCover ? <PassportCover passport={passport} gutter={false} /> : interiorLeaf()}
            </div>
          </div>
        </div>

        <PassportPagerControls active={active} onChange={goTo} className="shrink-0" />
      </div>

      {/* ── THE OBJECT, xl and up: closed board, or an open spread. ── */}
      {/* No `items-center` on this column: an auto cross-size would make the
          book's own `w-full` resolve against its content instead of the
          available width, and the spread collapsed to two clipped strips. The
          column stretches; the row inside it does the centring. */}
      <div className="hidden xl:flex xl:min-w-0 xl:flex-1 xl:flex-col xl:gap-5">
        <div className="flex w-full items-start justify-center">
          <div
            className={cn(
              bookEdge,
              // The object is sized to the window it is held up to, within
              // believable document limits, rather than to a fixed pixel box.
              'flex h-[clamp(26rem,calc(100dvh-16rem),40rem)] w-full transition-[max-width] duration-300 ease-out',
              isCover ? 'max-w-[23rem]' : 'max-w-[44rem]',
            )}
          >
            {/* LEFT LEAF — the cover board. It is the same object whether the
                book is shut or open; opening only reveals what is beside it. */}
            <div className={cn('h-full overflow-hidden', isCover ? 'w-full' : 'flex-1 basis-0')}>
              <PassportCover passport={passport} gutter={!isCover} className="h-full" />
            </div>

            {/* THE SPINE — a bound gutter with real depth, not a divider. */}
            {!isCover ? (
              <div aria-hidden="true" className="passport-spine relative z-10 w-3.5 shrink-0" />
            ) : null}

            {/* RIGHT LEAF — the printed page, scrolling within the board so
                the book's dimensions never change from page to page. */}
            {!isCover ? (
              <div className="passport-leaf-scroll h-full flex-1 basis-0 overflow-y-auto">
                <div key={active} className="passport-page-in h-full" style={enterStyle}>
                  {interiorLeaf()}
                </div>
              </div>
            ) : null}
          </div>

          {/* Thumb tabs, proud of the fore-edge — outside the clipped board. */}
          <PassportIndexTabs active={active} onChange={goTo} className="-ml-px shrink-0" />
        </div>

        <PassportPagerControls active={active} onChange={goTo} className="mx-auto max-w-[26rem]" />
      </div>

      {/* The explanatory margin — only where there is room to spare. */}
      <PassportContextPanel
        passport={passport}
        active={active}
        className="hidden min-[1700px]:flex"
      />
    </div>
  );
}

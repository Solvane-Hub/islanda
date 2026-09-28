'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS, NAV_SECTORS } from './nav-items';
import { NavSectorList } from './sidebar-nav';

/**
 * Mobile primary navigation — a compact tab bar, not the desktop rail copied
 * into a drawer.
 *
 * Four destinations get a permanent, one-tap slot: the two the founder reaches
 * most (Overview, Nova) plus the two remaining Business-sector routes that
 * already exist as their own pages (Business, Documents). Everything else —
 * Financials and Goals (both anchors into Overview), the roadmap stubs, and
 * Settings — lives one tap away in "More", grouped by the exact same sectors
 * as the desktop rail (`NavSectorList`), so the two surfaces present one
 * hierarchy, never two.
 */
const BOTTOM_HREFS = ['/dashboard', '/assistant', '/intake', '/documents'] as const;

const BOTTOM_ITEMS = BOTTOM_HREFS.map((href) => {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`Mobile bottom nav expected a nav item for ${href}`);
  return item;
});

/** The desktop rail, minus whatever already has a permanent bottom-bar slot. */
const MORE_SECTORS = NAV_SECTORS.map((sector) => ({
  ...sector,
  items: sector.items.filter(
    (item) => !BOTTOM_HREFS.includes(item.href as (typeof BOTTOM_HREFS)[number]),
  ),
})).filter((sector) => sector.items.length > 0);

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // A link tap inside the sheet already closes it via `onNavigate`; this only
  // covers browser back/forward, where no click fires. Reset during render
  // (React's documented pattern for state derived from a changing prop)
  // rather than in an effect, which the sheet's own open/close doesn't need
  // to re-run for and would otherwise cost an extra commit on every route
  // change.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const isRouteActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = !BOTTOM_ITEMS.some((item) => isRouteActive(item.href));

  // The Passport is a full-screen document viewer on small screens: the object
  // is meant to be the entire surface, and its own pager sits where a tab bar
  // would. Application navigation is a tap away via the header and the back
  // gesture; a bar under the document would make it a panel again.
  if (isRouteActive('/passport')) return null;

  return (
    <div className="relative shrink-0 border-t border-white/8 md:hidden">
      {moreOpen ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMoreOpen(false)}
            className="bg-abyss/70 fixed inset-0 z-20 backdrop-blur-sm"
          />
          <div
            id="mobile-more-sheet"
            className="workspace-env bg-glass-deep/92 shadow-glass absolute inset-x-0 bottom-full z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/10 px-4 pt-5 pb-3 backdrop-blur-xl"
          >
            <NavSectorList sectors={MORE_SECTORS} onNavigate={() => setMoreOpen(false)} />
          </div>
        </>
      ) : null}

      <nav
        aria-label="Primary"
        className="bg-abyss/40 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
      >
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isRouteActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'text-2xs flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 font-medium transition-colors duration-150',
                active ? 'text-on-ink' : 'text-on-ink-muted hover:text-on-ink',
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn('size-5', active && 'text-bahama-turquoise')}
                strokeWidth={1.75}
              />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
          className={cn(
            'text-2xs flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 font-medium transition-colors duration-150',
            moreOpen || moreActive ? 'text-on-ink' : 'text-on-ink-muted hover:text-on-ink',
          )}
        >
          <MoreHorizontal
            aria-hidden="true"
            className={cn('size-5', (moreOpen || moreActive) && 'text-bahama-turquoise')}
            strokeWidth={1.75}
          />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

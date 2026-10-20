'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { isNavItemActive, navSectorsFor, type NavSector } from './nav-items';

/**
 * Shared sector-grouped nav list — the desktop rail (`SidebarNav`) and the
 * mobile "More" sheet (`mobile-bottom-nav.tsx`) render the same markup over a
 * different slice of `NAV_SECTORS`, so the two surfaces can never drift into
 * two different hierarchies for the same product.
 *
 * Turquoise is the system's active signal here exactly as it is on the landing
 * page — it marks where you are, and nothing else in the rail uses it. The
 * active row gets a filled surface AND a leading bar AND a coloured icon, so
 * state is never carried by colour alone.
 *
 * The sectors are filtered for release (`navSectorsFor`) from a boolean the
 * server decides: a user never sees an unreleased item. In an internal
 * environment those items are present and carry a "Preview" tag, so a
 * developer can tell what users will not see.
 *
 * Rows are 40px rather than 44px now that the rail is a panel with its own
 * padding — the touch target on mobile comes from the sheet, which keeps the
 * larger rhythm.
 */
export function NavSectorList({
  sectors,
  onNavigate,
}: {
  sectors: readonly NavSector[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6">
      {sectors.map((sector, si) => (
        <div
          key={sector.label ?? `sector-${si}`}
          className={cn('flex flex-col gap-0.5', si === sectors.length - 1 && 'mt-auto')}
        >
          {sector.label ? (
            <h2 className="text-2xs text-on-glass-subtle mb-1.5 px-3 font-medium tracking-[0.14em] uppercase">
              {sector.label}
            </h2>
          ) : null}

          {sector.items.map((item) => {
            const Icon = item.icon;
            // A hash-anchor href (goals, money) never highlights as active —
            // `usePathname()` never includes a hash. The page it scrolls into
            // (Home) carries that state instead.
            const active = isNavItemActive(item, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors duration-150',
                  active
                    ? 'text-on-ink bg-white/8 font-medium'
                    : 'text-on-ink-muted hover:text-on-ink hover:bg-white/5',
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="bg-bahama-turquoise absolute top-2.5 bottom-2.5 -left-0.5 w-0.5 rounded-full"
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', active && 'text-bahama-turquoise')}
                  strokeWidth={1.75}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.preview ? (
                  <span className="text-2xs text-on-glass-subtle font-medium tracking-wide uppercase">
                    Preview<span className="sr-only">, internal environments only</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** The desktop rail — every sector this person may see, in order. */
export function SidebarNav({
  showUnreleased,
  onNavigate,
}: {
  /** From the server (`unreleasedVisible()`); true only in internal environments. */
  showUnreleased: boolean;
  onNavigate?: () => void;
}) {
  return <NavSectorList sectors={navSectorsFor(showUnreleased)} onNavigate={onNavigate} />;
}

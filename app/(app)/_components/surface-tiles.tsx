import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { WorkspaceSurface } from '@/components/ui/workspace-surface';
import { NAV_SECTORS } from './nav-items';

/**
 * The rooms that are coming online.
 *
 * Every surface Islanda will have, shown as a place rather than as a greyed
 * menu item — with the one thing it is actually waiting for, and whether that
 * thing exists yet. `intakeComplete` is real application state, so the tiles
 * change as the founder works. Nothing else is claimed about them.
 *
 * The list is derived from `NAV_SECTORS` rather than restated, so a route
 * added to the rail cannot silently go missing here.
 *
 * "Beautiful" is not "available". These read as doors, and the copy never
 * implies anything behind them is built.
 */
export function SurfaceTiles({ intakeComplete }: { intakeComplete: boolean }) {
  const upcoming = NAV_SECTORS.flatMap((g) => g.items).filter((i) => !i.available);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {upcoming.map((item) => {
        const Icon = item.icon;
        return (
          <WorkspaceSurface
            as="li"
            tone="shell"
            interactive
            key={item.href}
            className="min-w-0 transition duration-200 ease-out hover:-translate-y-0.5"
          >
            <Link
              href={item.href}
              className="flex h-full min-w-0 flex-col gap-3 rounded-[inherit] p-4 sm:gap-4 sm:p-5"
            >
              <span className="flex items-start justify-between gap-2">
                <Icon
                  aria-hidden="true"
                  className="text-champagne size-4 shrink-0"
                  strokeWidth={1.75}
                />
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-on-glass-subtle size-3.5 shrink-0"
                  strokeWidth={2}
                />
              </span>

              <span className="min-w-0">
                <span className="text-on-ink block truncate text-sm font-medium">{item.label}</span>
                <span className="text-2xs text-on-glass-subtle mt-1.5 block font-medium tracking-[0.14em] uppercase">
                  In development
                </span>
              </span>

              <span className="mt-auto flex items-center gap-2 pt-1">
                <span
                  aria-hidden="true"
                  className={
                    intakeComplete
                      ? 'bg-bahama-turquoise size-1.5 shrink-0 rounded-full'
                      : 'size-1.5 shrink-0 rounded-full ring-1 ring-white/44'
                  }
                />
                <span className="text-on-ink-muted min-w-0 text-xs text-pretty">
                  {intakeComplete ? 'Your intake is ready' : 'Needs your completed intake'}
                </span>
              </span>
            </Link>
          </WorkspaceSurface>
        );
      })}
    </ul>
  );
}

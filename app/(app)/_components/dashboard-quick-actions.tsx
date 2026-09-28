import Link from 'next/link';
import { ArrowUpRight, ListChecks, Plus, Sparkles } from 'lucide-react';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';
import { cn } from '@/lib/utils/cn';

/**
 * The floating quick-action module.
 *
 * The reference's defining depth move is one panel that floats over the
 * composition. This is Islanda's — a small launcher that, on wide screens,
 * overlaps the right edge of the journey surface so it reads as sitting ABOVE
 * the workspace rather than in the flow. Below `lg` it becomes an ordinary
 * stacked module, in priority order.
 *
 * ⚠ Every entry is a real navigation to an existing route — no invented tasks,
 *   no fabricated state. It is a doorway, not a to-do list.
 */
export function DashboardQuickActions({
  intakeComplete,
  className,
}: {
  intakeComplete: boolean;
  className?: string;
}) {
  const actions = [
    intakeComplete
      ? { href: '/intake/review', label: 'Review intake', icon: ListChecks }
      : { href: '/intake', label: 'Continue intake', icon: ListChecks },
    { href: '/assistant', label: 'Investigate with Nova', icon: Sparkles },
    { href: '/businesses/new', label: 'Add a business', icon: Plus },
  ];

  return (
    <aside aria-label="Quick actions" className={cn('z-20', className)}>
      <WorkspaceSurface
        tone="shell"
        className={cn(
          'flex flex-col gap-3 p-4',
          // Foreground layer: a wider, softer shadow and a brighter inner
          // top-edge highlight lift it closer to the viewer than the workspace
          // behind it; a small hover rise makes it feel physically present.
          'bg-glass/72 shadow-[0_28px_64px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]',
          'transition-[transform,box-shadow] duration-200 ease-out',
          'hover:-translate-y-0.5 hover:shadow-[0_34px_72px_-24px_rgba(0,0,0,0.92)]',
        )}
      >
        <SurfaceLabel as="p">Jump back in</SurfaceLabel>
        <ul className="-mx-1.5 flex flex-col">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="text-on-ink-muted hover:text-on-ink group flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-sm transition-colors duration-150 hover:bg-white/5"
                >
                  <Icon
                    aria-hidden="true"
                    className="text-champagne size-4 shrink-0"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-on-glass-subtle group-hover:text-bahama-turquoise size-3.5 shrink-0 transition-colors duration-150"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </WorkspaceSurface>
    </aside>
  );
}

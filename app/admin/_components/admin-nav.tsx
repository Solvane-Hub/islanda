'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  ClipboardList,
  FileDown,
  Gauge,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Portal navigation. A sidebar on wide screens, a horizontally scrolling row
 * on phones. Showing or hiding a link is presentation only — every page and
 * every query enforces administrator access on the server and in Postgres.
 */
export const ADMIN_SECTIONS = [
  { href: '/admin', label: 'Overview', icon: Gauge },
  { href: '/admin/analytics', label: 'Website Analytics', icon: BarChart3 },
  { href: '/admin/waitlist', label: 'Waitlist', icon: ClipboardList },
  { href: '/admin/questionnaire', label: 'Questionnaire Responses', icon: ListChecks },
  { href: '/admin/users', label: 'Users & Business Profiles', icon: Users },
  { href: '/admin/usage', label: 'Product Usage', icon: Activity },
  { href: '/admin/recruitment', label: 'Pilot Recruitment & Feedback', icon: UsersRound },
  { href: '/admin/reports', label: 'Reports & Exports', icon: FileDown },
  { href: '/admin/security', label: 'Security & Audit Logs', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Admin Settings', icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Admin sections">
      <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
        {ADMIN_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'text-on-ink bg-white/[0.09] font-medium'
                    : 'text-foreground-muted hover:text-foreground hover:bg-white/[0.05]',
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

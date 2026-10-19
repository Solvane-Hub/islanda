import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { signOutAction } from '../../(auth)/actions';

/**
 * Server Component: no interactivity beyond a form submit, so it stays off the
 * client bundle (Frontend Architecture — server-first).
 *
 * Sits on the ink header. The accessible name stays "Sign out" at every size —
 * the e2e suite and a screen reader both depend on it.
 */
export function UserMenu({
  email,
  fullName,
  showAdminLink = false,
}: {
  email: string | null;
  fullName: string | null;
  /** Shown to the two administrator emails only. A convenience link — the portal enforces access itself. */
  showAdminLink?: boolean;
}) {
  const label = fullName ?? email ?? null;
  const initials = fullName
    ? fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : (email?.[0]?.toUpperCase() ?? '?');

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="text-on-ink-muted flex size-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-xs font-semibold"
        >
          {initials}
        </span>
        {label ? (
          <span className="text-on-ink hidden max-w-[14rem] truncate text-sm font-medium lg:block">
            {label}
          </span>
        ) : null}
      </div>

      {showAdminLink ? (
        <Link
          href="/admin"
          className="text-on-ink-muted hover:text-on-ink flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors duration-150 hover:bg-white/8 sm:px-3"
        >
          <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span className="sr-only sm:not-sr-only">Admin portal</span>
        </Link>
      ) : null}

      <form action={signOutAction}>
        <button
          type="submit"
          className="text-on-ink-muted hover:text-on-ink flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors duration-150 hover:bg-white/8 sm:px-3"
        >
          <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span className="sr-only sm:not-sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}

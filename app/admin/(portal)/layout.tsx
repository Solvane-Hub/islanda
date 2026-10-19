import Link from 'next/link';
import { Logo } from '@/components/brand/logo-mark';
import { buttonVariants } from '@/components/ui/button';
import { staffSignOutAction } from '../actions';
import { AdminNav } from '../_components/admin-nav';
import { requireAdminPage } from '../_lib/guard';

/**
 * The admin portal shell: identity, navigation and sign-out.
 *
 * Checks access too (a signed-out or non-admin visitor never sees the shell),
 * but every page also checks — layouts are not re-rendered on client
 * navigation — and Postgres refuses the data to anyone but an administrator
 * on an MFA session.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage('/admin');

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
          <Link
            href="/admin"
            className="text-on-ink inline-flex w-fit"
            aria-label="Islanda admin overview"
          >
            <Logo height={20} />
          </Link>
          <p className="text-foreground-muted text-xs lg:mt-1">
            Admin · <span className="text-foreground">{admin.displayName}</span>
          </p>
        </div>
        <AdminNav />
        <form action={staffSignOutAction} className="hidden lg:block">
          <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
      <form action={staffSignOutAction} className="lg:hidden">
        <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          Sign out
        </button>
      </form>
    </div>
  );
}

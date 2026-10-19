import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { verifiedFactors } from '@/services/admin/auth';
import { signOutEverywhereAction, staffSignOutAction } from '../../actions';
import { Panel } from '../../_components/charts';
import { ChangePasswordForm } from '../../_components/password-forms';
import { PageHeading } from '../../_components/page-heading';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Admin settings' };

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage('/admin/settings');
  const db = await createClient();
  const verified = await verifiedFactors(db);

  return (
    <>
      <PageHeading
        title="Admin Settings"
        description="Your own account security. Platform-wide settings — who may be an administrator, analytics configuration — are not editable here: they live in reviewed code and server configuration."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Your administrator identity">
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Name</dt>
            <dd>{admin.displayName}</dd>
            <dt className="text-foreground-muted">Email</dt>
            <dd className="break-all">{admin.email}</dd>
            <dt className="text-foreground-muted">Access</dt>
            <dd>Platform administrator (owner allowlist)</dd>
          </dl>
          <p className="text-foreground-muted text-xs text-pretty">
            Changing your email address in any other screen removes administrator access until it is
            re-provisioned — a safeguard, not a fault.
          </p>
        </Panel>

        <Panel title="Two-step verification">
          {verified.length > 0 ? (
            <p className="text-sm">
              <span className="text-success font-medium">On.</span> {verified.length} authenticator
              {verified.length === 1 ? '' : 's'} set up
              {verified[0]?.createdAt ? ` (since ${verified[0].createdAt.slice(0, 10)})` : ''}.
              Every admin session requires a code.
            </p>
          ) : (
            <p className="text-warning text-sm">No authenticator found.</p>
          )}
          <p className="text-foreground-muted text-xs text-pretty">
            Lost your phone? Sign out, then ask the other administrator to remove your authenticator
            in the Supabase dashboard (Authentication → Users → MFA factors) after confirming it is
            really you; you will be asked to set up a new one at your next sign-in.
          </p>
        </Panel>

        <Panel
          title="Change password"
          description="You need your current password. Use at least 12 characters."
        >
          <ChangePasswordForm />
          <p className="text-foreground-muted text-xs">
            Forgotten it?{' '}
            <Link href="/admin/forgot-password" className="underline underline-offset-2">
              Reset it by email
            </Link>
            .
          </p>
        </Panel>

        <Panel title="Sessions">
          <p className="text-foreground-muted text-xs text-pretty">
            Sign out here, or sign out on every device and browser where your account is signed in
            (for example after using a shared computer).
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={staffSignOutAction}>
              <button
                type="submit"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Sign out
              </button>
            </form>
            <form action={signOutEverywhereAction}>
              <button type="submit" className={buttonVariants({ variant: 'danger', size: 'sm' })}>
                Sign out everywhere
              </button>
            </form>
          </div>
        </Panel>
      </div>

      <Panel title="Security guidance">
        <ul className="text-foreground-muted flex list-disc flex-col gap-1.5 pl-5 text-xs text-pretty">
          <li>Use a password you use nowhere else, kept in a password manager.</li>
          <li>
            Never share a sign-in code or a password reset link — nobody at Solvane Hub will ask for
            one.
          </li>
          <li>
            Exports with contact details are personal data: keep them out of shared folders and
            delete them when done.
          </li>
          <li>
            Review the Security &amp; Audit Logs page regularly for sign-ins you do not recognise.
          </li>
        </ul>
      </Panel>
    </>
  );
}

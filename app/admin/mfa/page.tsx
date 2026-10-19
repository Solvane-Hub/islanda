import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { getAdminAccess, recordAdminPageDenied } from '@/services/admin/access';
import { staffSignOutAction } from '../actions';
import { AuthCard } from '../_components/auth-card';
import { MfaEnrollPanel, MfaVerifyForm } from '../_components/mfa-forms';
import { safeAdminNext } from '../_lib/guard';

export const metadata: Metadata = { title: 'Two-step verification' };

/**
 * Two-step verification for administrators. Reachable only by an allowlisted,
 * provisioned administrator whose password is already verified; everyone else
 * is sent to sign in or gets a 404.
 */
export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeAdminNext(next);
  const access = await getAdminAccess(await createClient());

  switch (access.kind) {
    case 'signed_out':
      redirect(`/admin/login?next=${encodeURIComponent(target)}`);
    case 'denied':
      await recordAdminPageDenied(access.userId, '/admin/mfa');
      notFound();
    case 'admin':
      redirect(target);
    case 'password_change':
      redirect('/admin/account/password');
    default:
      break;
  }

  return (
    <AuthCard
      title={access.kind === 'mfa_enroll' ? 'Set up two-step verification' : 'Enter your code'}
      description={
        access.kind === 'mfa_enroll'
          ? 'The admin portal holds personal data, so every administrator session needs a code from an authenticator app as well as your password. This is a one-time setup.'
          : 'Open your authenticator app and enter the current 6-digit code for Islanda admin.'
      }
    >
      {access.kind === 'mfa_enroll' ? (
        <MfaEnrollPanel next={target} />
      ) : (
        <MfaVerifyForm factorId={access.factorId} next={target} />
      )}
      <form action={staffSignOutAction}>
        <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Cancel and sign out
        </button>
      </form>
    </AuthCard>
  );
}

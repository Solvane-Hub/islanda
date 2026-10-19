import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { getAdminAccess, recordAdminPageDenied } from '@/services/admin/access';
import { staffSignOutAction } from '../../actions';
import { AuthCard } from '../../_components/auth-card';
import { ChangePasswordForm } from '../../_components/password-forms';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * The required first-sign-in change for an administrator account created
 * with a temporary password. Until it is done, no other admin page renders.
 */
export default async function ForcedPasswordChangePage() {
  const access = await getAdminAccess(await createClient());
  if (access.kind === 'signed_out') redirect('/admin/login');
  if (access.kind === 'denied') {
    await recordAdminPageDenied(access.userId, '/admin/account/password');
    notFound();
  }
  if (access.kind !== 'password_change') redirect('/admin/settings');

  return (
    <AuthCard
      title="Choose your own password"
      description="Your account was set up with a temporary password. Replace it now — you will then set up two-step verification."
    >
      <ChangePasswordForm onDoneHref="/admin/mfa" />
      <form action={staffSignOutAction}>
        <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminAccess, recordAdminPageDenied } from '@/services/admin/access';
import { AuthCard } from '../_components/auth-card';
import { AdminResetPasswordForm } from '../_components/password-forms';

export const metadata: Metadata = { title: 'Set a new admin password' };

/**
 * Landing page for the emailed recovery link (via /auth/callback). The
 * service additionally requires the session to come from that link within
 * the last 30 minutes. An administrator with an authenticator verifies it
 * first — Supabase refuses a password change below aal2 when MFA is set up.
 */
export default async function AdminResetPasswordPage() {
  const access = await getAdminAccess(await createClient());
  if (access.kind === 'signed_out') redirect('/admin/login?error=invalid_link');
  if (access.kind === 'denied') {
    await recordAdminPageDenied(access.userId, '/admin/reset-password');
    notFound();
  }
  if (access.kind === 'mfa_verify') redirect('/admin/mfa?next=/admin/reset-password');

  return (
    <AuthCard
      title="Set a new password"
      description="Use at least 12 characters, and a password you use nowhere else."
    >
      <AdminResetPasswordForm />
      <Link
        href="/admin/login"
        className="text-foreground-muted w-fit text-xs underline underline-offset-2"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}

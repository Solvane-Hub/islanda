import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/server';
import { getAdminAccess } from '@/services/admin/access';
import { AuthCard } from '../_components/auth-card';
import { StaffSignInForm } from '../_components/staff-sign-in-form';
import { safeAdminNext } from '../_lib/guard';

export const metadata: Metadata = { title: 'Admin sign in' };

/**
 * Administrator entrance. Works whether or not WAITLIST_ONLY_MODE is on. A
 * successful password sign-in by anyone who is not a provisioned
 * administrator is signed straight back out with the same message as a wrong
 * password, so this page never reveals who the administrators are.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeAdminNext(next);

  const access = await getAdminAccess(await createClient());
  if (access.kind === 'admin') redirect(target);
  if (access.kind === 'mfa_enroll' || access.kind === 'mfa_verify') {
    redirect(`/admin/mfa?next=${encodeURIComponent(target)}`);
  }
  if (access.kind === 'password_change') redirect('/admin/account/password');

  return (
    <AuthCard
      title="Admin sign in"
      description="For the Islanda administrators only. Founders do not sign in here."
    >
      {error === 'invalid_link' ? (
        <Alert tone="error">
          <p>That link has expired or was already used. Request a new one.</p>
        </Alert>
      ) : error === 'missing_code' ? (
        <Alert tone="info">
          <p>
            If you just confirmed your email address, it is confirmed — sign in below. If you were
            resetting your password, request a new reset link.
          </p>
        </Alert>
      ) : null}
      <StaffSignInForm next={target} />
      <Link
        href="/admin/forgot-password"
        className="text-foreground-muted w-fit text-xs underline underline-offset-2"
      >
        Forgot your password?
      </Link>
    </AuthCard>
  );
}

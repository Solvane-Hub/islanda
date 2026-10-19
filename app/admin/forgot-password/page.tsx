import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '../_components/auth-card';
import { AdminForgotPasswordForm } from '../_components/password-forms';

export const metadata: Metadata = { title: 'Reset admin password' };

export default function AdminForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your administrator email. If it belongs to an administrator, we will email a one-time reset link."
    >
      <AdminForgotPasswordForm />
      <Link
        href="/admin/login"
        className="text-foreground-muted w-fit text-xs underline underline-offset-2"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}

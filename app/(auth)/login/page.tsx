import Link from 'next/link';
import type { Metadata } from 'next';
import { SignInForm } from '../_components/sign-in-form';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (serverEnv.WAITLIST_ONLY_MODE) redirect('/?access=waitlist');
  const { next } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-on-ink text-[1.75rem] font-semibold tracking-[-0.02em] text-balance">
          Sign in
        </h1>
        <p className="text-foreground-muted text-sm">Welcome back.</p>
      </div>

      <SignInForm {...(next ? { next } : {})} />

      <div className="text-foreground-muted flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot your password?
        </Link>
        <p>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand underline underline-offset-4">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

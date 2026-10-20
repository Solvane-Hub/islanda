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
        <p className="text-foreground-muted text-sm text-pretty">
          Use the email address and password you created your Islanda account with.
        </p>
      </div>

      <SignInForm {...(next ? { next } : {})} />

      <div className="text-foreground-muted flex flex-col gap-1 text-sm">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
        >
          Forgot your password?
        </Link>
        <p>
          New to Islanda?{' '}
          <Link
            href="/signup"
            className="text-brand inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
        <p className="text-pretty">
          Islanda is in early access.{' '}
          <Link href="/" className="underline underline-offset-4">
            See what you can do in Islanda
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { SignUpForm } from '../_components/sign-up-form';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  if (serverEnv.WAITLIST_ONLY_MODE) redirect('/?access=waitlist');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-on-ink text-[1.75rem] font-semibold tracking-[-0.02em] text-balance">
          Create your account
        </h1>
        <p className="text-foreground-muted text-sm">
          Start turning your business idea into a plan.
        </p>
      </div>

      <SignUpForm />

      <p className="text-foreground-muted text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-brand underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

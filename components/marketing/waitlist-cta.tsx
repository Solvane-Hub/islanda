import Link from 'next/link';
import { ACCESS_COPY, type AccessMode } from '@/lib/product/availability';
import { WaitlistForm } from './waitlist-form';

/**
 * Section F — early access. The page's one conversion point.
 *
 * Says what joining means before asking for anything: what we keep, what the
 * visitor receives, and that it is not an account. Deliberately makes no claim
 * about queue position, signup count, timing or existing customers.
 *
 * In open mode an account can be created today, so that path is named — once,
 * quietly, beneath the form — rather than hidden behind the waitlist.
 */
export function WaitlistCta({ mode }: { mode: AccessMode }) {
  const open = ACCESS_COPY[mode].signUpAvailable;
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl">
        Join the early-access waitlist
      </h2>
      <p className="text-on-ink-muted max-w-lg text-base text-pretty sm:text-lg">
        Leave your name and email (a phone number is optional). We will send a confirmation now and
        email you again when early access opens. Joining does not create an account.
      </p>
      <div className="mt-2 flex w-full justify-center">
        <WaitlistForm />
      </div>
      {open ? (
        <p className="text-on-ink-muted text-sm">
          Want to try it now?{' '}
          <Link
            href="/signup"
            className="text-on-ink inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}

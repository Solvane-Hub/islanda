import { WaitlistForm } from './waitlist-form';

/**
 * Section 08 — the waitlist. The primary conversion point for a visitor who
 * isn't ready to create an account today. Deliberately makes no claim about
 * queue position, signup count, or existing customers — only what is true:
 * an early-access list a real founder can join with an email address.
 */
export function WaitlistCta() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl">
        Be among the first.
      </h2>
      <p className="text-on-ink-muted max-w-lg text-base text-pretty sm:text-lg">
        Get early access and be among the first businesses to experience Islanda.
      </p>
      <div className="mt-2 flex justify-center">
        <WaitlistForm />
      </div>
    </div>
  );
}

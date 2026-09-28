'use client';

import { useActionState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { joinWaitlistAction, type JoinWaitlistResult } from '@/app/waitlist-actions';
import type { Result } from '@/lib/errors';

/**
 * The real waitlist form — a genuine server-side write, not a form that only
 * displays a success message. Deliberately minimal: email is the only
 * required field, a first name is optional. No manufactured queue position,
 * no fabricated signup count — the confirmation copy names only what is true.
 */
export function WaitlistForm() {
  const [state, formAction, pending] = useActionState<Result<JoinWaitlistResult> | null, FormData>(
    joinWaitlistAction,
    null,
  );

  const joined = state?.ok;
  const fieldError = state && !state.ok ? state.fieldErrors?.email?.[0] : undefined;
  const formError = state && !state.ok && !state.fieldErrors ? state.message : undefined;

  if (joined) {
    return (
      <div className="border-bahama-turquoise/30 bg-bahama-turquoise/10 flex items-start gap-3 rounded-2xl border px-6 py-5 text-left">
        <CheckCircle2
          aria-hidden="true"
          className="text-bahama-turquoise mt-0.5 size-5 shrink-0"
          strokeWidth={2}
        />
        <div>
          <p className="text-on-ink text-base font-semibold">You&apos;re on the list.</p>
          <p className="text-on-ink-muted mt-1 text-sm text-pretty">
            Welcome to Islanda — we&apos;ll be in touch when early access opens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          placeholder="you@yourbusiness.com"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? 'waitlist-email-error' : undefined}
          className="text-on-ink placeholder:text-on-ink-subtle h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40 aria-[invalid=true]:border-red-400/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-ink inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? 'Joining…' : 'Join the waitlist'}
          {!pending ? <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} /> : null}
        </button>
      </div>

      <label htmlFor="waitlist-first-name" className="sr-only">
        First name (optional)
      </label>
      <input
        id="waitlist-first-name"
        name="firstName"
        type="text"
        placeholder="First name (optional)"
        className="text-on-ink placeholder:text-on-ink-subtle h-11 w-full max-w-xs rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40"
      />

      {fieldError ? (
        <p id="waitlist-email-error" role="alert" className="text-sm font-medium text-red-300">
          {fieldError}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm font-medium text-red-300">
          {formError}
        </p>
      ) : null}

      <p className="text-on-ink-subtle text-xs">
        No spam. One email when early access opens for your business.
      </p>
    </form>
  );
}

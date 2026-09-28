'use client';

import { useActionState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { joinWaitlistAction, type JoinWaitlistResult } from '@/app/waitlist-actions';
import type { Result } from '@/lib/errors';

/**
 * Public Islanda waitlist form.
 *
 * Required fields:
 * - First name
 * - Last name
 * - Email address
 *
 * The form writes to the real waitlist database through the server action.
 */
export function WaitlistForm() {
  const [state, formAction, pending] = useActionState<Result<JoinWaitlistResult> | null, FormData>(
    joinWaitlistAction,
    null,
  );

  const joined = state?.ok;

  const firstNameError = state && !state.ok ? state.fieldErrors?.firstName?.[0] : undefined;

  const lastNameError = state && !state.ok ? state.fieldErrors?.lastName?.[0] : undefined;

  const emailError = state && !state.ok ? state.fieldErrors?.email?.[0] : undefined;

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="waitlist-first-name" className="text-on-ink-muted text-xs font-medium">
            First name
          </label>

          <input
            id="waitlist-first-name"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder="First name"
            aria-invalid={Boolean(firstNameError)}
            aria-describedby={firstNameError ? 'waitlist-first-name-error' : undefined}
            className="text-on-ink placeholder:text-on-ink-subtle h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40 aria-[invalid=true]:border-red-400/60"
          />

          {firstNameError ? (
            <p
              id="waitlist-first-name-error"
              role="alert"
              className="text-xs font-medium text-red-300"
            >
              {firstNameError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="waitlist-last-name" className="text-on-ink-muted text-xs font-medium">
            Last name
          </label>

          <input
            id="waitlist-last-name"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            placeholder="Last name"
            aria-invalid={Boolean(lastNameError)}
            aria-describedby={lastNameError ? 'waitlist-last-name-error' : undefined}
            className="text-on-ink placeholder:text-on-ink-subtle h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40 aria-[invalid=true]:border-red-400/60"
          />

          {lastNameError ? (
            <p
              id="waitlist-last-name-error"
              role="alert"
              className="text-xs font-medium text-red-300"
            >
              {lastNameError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="waitlist-email" className="text-on-ink-muted text-xs font-medium">
          Email address
        </label>

        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? 'waitlist-email-error' : undefined}
          className="text-on-ink placeholder:text-on-ink-subtle h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40 aria-[invalid=true]:border-red-400/60"
        />

        {emailError ? (
          <p id="waitlist-email-error" role="alert" className="text-xs font-medium text-red-300">
            {emailError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="text-ink mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? 'Joining…' : 'Join the waitlist'}

        {!pending ? <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} /> : null}
      </button>

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

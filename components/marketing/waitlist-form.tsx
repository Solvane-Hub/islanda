'use client';

import { useActionState, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { joinWaitlistAction, type JoinWaitlistResult } from '@/app/waitlist-actions';
import type { Result } from '@/lib/errors';
import { WaitlistSurvey } from './waitlist-survey';
import { storeSurvey, useStoredSurvey } from './waitlist-survey-token';
import { track } from '@/lib/analytics/client';

/**
 * Public Islanda waitlist form.
 *
 * Required fields:
 * - First name
 * - Last name
 * - Email address
 *
 * Optional: phone number.
 *
 * The form writes to the real waitlist database through the server action.
 * Only after the signup has actually succeeded does a second, optional step
 * appear (`WaitlistSurvey`). Skipping it, failing it or closing the tab never
 * undoes the signup. The questionnaire token is kept on this device for 30
 * days (waitlist-survey-token.ts), so the visitor can come back to finish or
 * update their answers.
 */
export function WaitlistForm() {
  const [state, formAction, pending] = useActionState<Result<JoinWaitlistResult> | null, FormData>(
    joinWaitlistAction,
    null,
  );
  const stored = useStoredSurvey();
  const [surveyOutcome, setSurveyOutcome] = useState<'answered' | 'skipped' | null>(null);
  const [updating, setUpdating] = useState(false);
  const [formStarted, setFormStarted] = useState(false);

  const joined = state?.ok;
  const joinedNow = state?.ok === true && state.data.status === 'joined';
  const issuedToken = state?.ok && state.data.status === 'joined' ? state.data.surveyToken : null;
  // An unfinished questionnaire from earlier (refresh, or a return visit) resumes.
  const pendingToken = !stored?.finished ? (stored?.token ?? null) : null;
  const surveyToken = issuedToken ?? pendingToken ?? (updating ? (stored?.token ?? null) : null);
  const resuming = !issuedToken;

  useEffect(() => {
    if (issuedToken) storeSurvey({ token: issuedToken, finished: false });
  }, [issuedToken]);

  function finishSurvey(outcome: 'answered' | 'skipped') {
    if (surveyToken) storeSurvey({ token: surveyToken, finished: true });
    setUpdating(false);
    setSurveyOutcome(outcome);
  }

  const firstNameError = state && !state.ok ? state.fieldErrors?.firstName?.[0] : undefined;

  const lastNameError = state && !state.ok ? state.fieldErrors?.lastName?.[0] : undefined;

  const emailError = state && !state.ok ? state.fieldErrors?.email?.[0] : undefined;

  const phoneError = state && !state.ok ? state.fieldErrors?.phone?.[0] : undefined;

  const formError = state && !state.ok && !state.fieldErrors ? state.message : undefined;

  if (joinedNow || surveyToken || surveyOutcome) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-5">
        {joinedNow ? <JoinedConfirmation /> : <ReturningConfirmation />}

        {surveyOutcome && !updating ? (
          <SurveyFinished
            outcome={surveyOutcome}
            onUpdate={
              stored?.token
                ? () => {
                    setSurveyOutcome(null);
                    setUpdating(true);
                  }
                : undefined
            }
          />
        ) : surveyToken ? (
          <WaitlistSurvey token={surveyToken} resuming={resuming} onFinished={finishSurvey} />
        ) : null}
      </div>
    );
  }

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
    <form
      action={formAction}
      onFocus={() => {
        if (formStarted) return;
        setFormStarted(true);
        track('waitlist_form_started');
      }}
      className="flex w-full max-w-md flex-col gap-3 text-left"
    >
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="waitlist-phone" className="text-on-ink-muted text-xs font-medium">
            Phone number
          </label>
          <span className="text-on-ink-subtle text-xs">Optional</span>
        </div>

        <input
          id="waitlist-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          placeholder="(242) 555-0123"
          aria-invalid={Boolean(phoneError)}
          aria-describedby={phoneError ? 'waitlist-phone-error' : undefined}
          className="text-on-ink placeholder:text-on-ink-subtle h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm backdrop-blur-md transition-colors outline-none focus-visible:border-white/40 aria-[invalid=true]:border-red-400/60"
        />

        {phoneError ? (
          <p id="waitlist-phone-error" role="alert" className="text-xs font-medium text-red-300">
            {phoneError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="text-ink mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? 'Joining…' : 'Join the Waitlist'}

        {!pending ? <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} /> : null}
      </button>

      {formError ? (
        <p role="alert" className="text-sm font-medium text-red-300">
          {formError}
        </p>
      ) : null}

      <p className="text-on-ink-subtle text-xs">We only email you about Islanda early access.</p>

      {stored?.finished ? (
        <button
          type="button"
          onClick={() => setUpdating(true)}
          className="text-on-ink-muted hover:text-on-ink w-fit text-xs underline underline-offset-2"
        >
          Already joined? Update your questionnaire answers
        </button>
      ) : null}
    </form>
  );
}

function JoinedConfirmation() {
  return (
    <div
      role="status"
      className="border-bahama-turquoise/30 bg-bahama-turquoise/10 flex w-full items-start gap-4 rounded-2xl border px-5 py-6 text-left sm:px-6"
    >
      <CheckCircle2
        aria-hidden="true"
        className="text-bahama-turquoise mt-0.5 size-6 shrink-0"
        strokeWidth={2}
      />

      <div>
        <p className="text-on-ink text-lg font-semibold">You&apos;re on the list!</p>

        <p className="text-on-ink-muted mt-2 text-sm text-pretty">
          Thanks for joining the Islanda waitlist. A confirmation email is on its way to you.
        </p>

        <p className="text-on-ink-muted mt-3 text-sm text-pretty">
          Don&apos;t see it? Check your Spam or Junk folder and add{' '}
          <a
            href="mailto:waitlist@solvanehub.us"
            className="text-on-ink font-medium break-all underline underline-offset-2"
          >
            waitlist@solvanehub.us
          </a>{' '}
          to your contacts so you don&apos;t miss future updates.
        </p>
      </div>
    </div>
  );
}

/** After a refresh mid-survey: the signup succeeded earlier in this tab. */
function ReturningConfirmation() {
  return (
    <div
      role="status"
      className="border-bahama-turquoise/30 bg-bahama-turquoise/10 flex w-full items-start gap-3 rounded-2xl border px-5 py-5 text-left sm:px-6"
    >
      <CheckCircle2
        aria-hidden="true"
        className="text-bahama-turquoise mt-0.5 size-5 shrink-0"
        strokeWidth={2}
      />
      <p className="text-on-ink text-base font-semibold">You&apos;re on the list.</p>
    </div>
  );
}

function SurveyFinished({
  outcome,
  onUpdate,
}: {
  outcome: 'answered' | 'skipped';
  onUpdate?: (() => void) | undefined;
}) {
  return (
    <div className="text-on-ink-muted flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-5 text-left text-sm sm:px-6">
      <p role="status" className="text-pretty">
        {outcome === 'answered'
          ? 'Thank you — your answers are saved. They help us understand what entrepreneurs need and shape our first testing group.'
          : 'No problem. You are still on the waitlist, and we will email you when early access opens.'}
      </p>
      {onUpdate ? (
        <button
          type="button"
          onClick={onUpdate}
          className="text-on-ink w-fit text-xs font-medium underline underline-offset-2"
        >
          {outcome === 'answered' ? 'Update my answers' : 'Answer the questions now'}
        </button>
      ) : null}
    </div>
  );
}

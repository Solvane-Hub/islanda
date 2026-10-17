'use client';

import { startTransition, useActionState, useState } from 'react';
import {
  submitWaitlistSurveyAction,
  type SubmitWaitlistSurveyResult,
} from '@/app/waitlist-actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard } from '@/components/ui/choice';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Result } from '@/lib/errors';
import {
  BUSINESS_STAGE_OPTIONS,
  CHALLENGE_OPTIONS,
  SURVEY_LIMITS,
  TESTING_INTEREST_OPTIONS,
} from '@/lib/waitlist/options';

/**
 * The optional questions shown after a successful waitlist signup.
 *
 * Every question may be left blank, and "Skip for Now" never touches the
 * server: the signup already succeeded and stays that way whatever happens
 * here. Answers are written to the visitor's existing signup through the
 * token issued at signup — this form has no way to create a second one.
 *
 * Submitted through `onSubmit` + `startTransition` rather than `<form action>`
 * on purpose: React resets an action form after every submission, which would
 * wipe the visitor's answers on a failed attempt and make "try again" mean
 * "start again".
 */
export function WaitlistSurvey({
  token,
  onFinished,
}: {
  token: string;
  onFinished: (outcome: 'answered' | 'skipped') => void;
}) {
  const [state, action, pending] = useActionState<
    Result<SubmitWaitlistSurveyResult> | null,
    FormData
  >(async (previous, formData) => {
    const result = await submitWaitlistSurveyAction(previous, formData);
    if (result.ok) onFinished(result.data.status === 'saved' ? 'answered' : 'skipped');
    return result;
  }, null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const failure = state && !state.ok ? state : null;
  const fieldError = (name: string) => failure?.fieldErrors?.[name]?.[0];

  return (
    <section
      aria-labelledby="waitlist-survey-heading"
      className="workspace-env flex w-full flex-col gap-6 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-6 text-left sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <h3 id="waitlist-survey-heading" className="text-on-ink text-lg font-semibold text-balance">
          Help Us Build Something Useful for You
        </h3>
        <p className="text-on-ink-muted text-sm text-pretty">
          Tell us a little about yourself and what&apos;s holding you back. Your answers will help
          us make Islanda more useful.
        </p>
        <p className="text-on-ink-muted text-xs">Every question is optional.</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => action(formData));
        }}
        className="flex flex-col gap-7"
        noValidate
      >
        <input type="hidden" name="token" value={token} />

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="text-on-ink mb-3 text-base font-medium">Where are you located?</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="waitlist-survey-country" label="Country" error={fieldError('country')}>
              {(aria) => (
                <Input
                  {...aria}
                  name="country"
                  autoComplete="country-name"
                  placeholder="e.g. The Bahamas"
                  maxLength={SURVEY_LIMITS.country}
                  className="h-11"
                />
              )}
            </Field>
            <Field
              id="waitlist-survey-city-island"
              label="City or island"
              error={fieldError('cityIsland')}
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="cityIsland"
                  autoComplete="address-level2"
                  placeholder="e.g. Nassau or Exuma"
                  maxLength={SURVEY_LIMITS.cityIsland}
                  className="h-11"
                />
              )}
            </Field>
          </div>
        </fieldset>

        <Question legend="Where are you in your business journey?">
          {BUSINESS_STAGE_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              name="businessStage"
              value={option.value}
              label={option.label}
            />
          ))}
        </Question>

        <div
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            if (target.name === 'biggestChallenge') setChallenge(target.value);
          }}
          className="flex flex-col gap-3"
        >
          <Question legend="What's your biggest challenge?">
            {CHALLENGE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="biggestChallenge"
                value={option.value}
                label={option.label}
              />
            ))}
          </Question>

          {challenge === 'other' ? (
            <Field
              id="waitlist-survey-challenge-other"
              label="Tell us about your challenge"
              optional
              error={fieldError('challengeOther')}
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="challengeOther"
                  maxLength={SURVEY_LIMITS.challengeOther}
                  className="h-11"
                />
              )}
            </Field>
          ) : null}
        </div>

        <Question legend="Interested in trying Islanda before launch?" columns={3}>
          {TESTING_INTEREST_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              name="testingInterest"
              value={option.value}
              label={option.label}
            />
          ))}
        </Question>

        {failure && !failure.fieldErrors ? (
          <Alert tone="error">
            <p>{failure.message}</p>
            {failure.code === 'NOT_FOUND' ? null : (
              <p className="mt-1">Your answers are still here, so you can try again.</p>
            )}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" loading={pending} className="sm:flex-1">
            Submit Answers
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => onFinished('skipped')}
            className="sm:flex-1"
          >
            Skip for Now
          </Button>
        </div>
      </form>
    </section>
  );
}

function Question({
  legend,
  columns = 2,
  children,
}: {
  legend: string;
  columns?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="text-on-ink mb-3 text-base font-medium">{legend}</legend>
      <div
        className={
          columns === 3
            ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-3'
            : 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
        }
      >
        {children}
      </div>
    </fieldset>
  );
}

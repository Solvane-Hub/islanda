'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Result } from '@/lib/errors';
import { saveIntakeStepAction } from '../actions';
import { StepFields, type IntakeValues, type StageOption } from './step-fields';

/**
 * One intake step.
 *
 * Each submit persists immediately, so closing the browser mid-flow loses
 * nothing (acceptance criteria C3/C4). Advancing is a client-side route change
 * only after the server confirms the save.
 *
 * The saved state is derived, never asserted: `answered` is
 * `step <= last_completed_step`, computed by the page from the profile row. So
 * "Saved" appears only where a row genuinely holds this answer, and the step a
 * founder has not submitted yet says so instead. Nothing here invents a
 * save event or a timestamp the application does not have.
 *
 * The fields are rendered by `StepFields` rather than handed in as a render
 * prop. A function cannot cross a Server Component boundary, and the page is a
 * Server Component — the previous shape threw at render and was swallowed by
 * the segment's error boundary. Everything this component receives is a plain
 * value.
 */
export function StepForm({
  step,
  totalSteps,
  isLastStep,
  answered,
  values,
  stages,
  currency,
}: {
  step: number;
  totalSteps: number;
  isLastStep: boolean;
  /** Whether this step's answer is already stored. Derived from the profile. */
  answered: boolean;
  values: IntakeValues;
  stages: readonly StageOption[];
  currency: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    Result<{ nextStep: number }> | null,
    FormData
  >(saveIntakeStepAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(isLastStep ? '/intake/review' : `/intake?step=${state.data.nextStep}`);
    }
  }, [state, router, isLastStep]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const formError = state && !state.ok && !state.fieldErrors ? state : null;

  return (
    <form action={formAction} className="flex flex-col" noValidate>
      <input type="hidden" name="step" value={step} />

      <div className="flex flex-col gap-7 px-5 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        {formError ? (
          <Alert tone="error">
            <p>{formError.message}</p>
            <p className="mt-1 text-xs opacity-70">
              Reference: {formError.correlationId.slice(0, 8)}
            </p>
          </Alert>
        ) : null}

        <StepFields
          step={step}
          values={values}
          stages={stages}
          currency={currency}
          fieldErrors={fieldErrors}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 border-t border-white/8 px-5 py-5 sm:px-9 lg:px-12">
        <Button type="submit" size="lg" loading={pending} className="rounded-full pr-4 pl-5">
          {isLastStep ? 'Save and review' : 'Save and continue'}
          <ArrowRight aria-hidden="true" strokeWidth={2} />
        </Button>

        {step > 1 ? (
          <a
            href={`/intake?step=${step - 1}`}
            className="text-on-ink-muted hover:text-on-ink inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm transition-colors duration-150"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Back
          </a>
        ) : null}

        <p className="text-on-ink-muted flex w-full items-center gap-2 text-xs sm:ml-auto sm:w-auto">
          {answered ? (
            <>
              <Check
                aria-hidden="true"
                className="text-bahama-turquoise size-3.5"
                strokeWidth={2.5}
              />
              Saved. You can close this and come back.
            </>
          ) : (
            <>
              Question <span data-numeric>{step}</span> of <span data-numeric>{totalSteps}</span> ·
              saved when you continue
            </>
          )}
        </p>
      </div>
    </form>
  );
}

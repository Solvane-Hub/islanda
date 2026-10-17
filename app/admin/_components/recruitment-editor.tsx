'use client';

import { startTransition, useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Result } from '@/lib/errors';
import {
  RECRUITMENT_STATUS_OPTIONS,
  SURVEY_LIMITS,
  type RecruitmentStatus,
} from '@/lib/waitlist/options';
import type { RecruitmentUpdateResult } from '@/services/waitlist/recruitment';
import { updateRecruitmentAction } from '../actions';

/**
 * One row's recruitment status and internal notes.
 *
 * Submitted via `onSubmit` + `startTransition`, not `<form action>`: React
 * resets an action form after submitting, which would snap the select back to
 * its original value and make a saved change look unsaved.
 */
export function RecruitmentEditor({
  signupId,
  personName,
  status,
  notes,
}: {
  signupId: string;
  personName: string;
  status: RecruitmentStatus;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState<Result<RecruitmentUpdateResult> | null, FormData>(
    updateRecruitmentAction,
    null,
  );
  const id = useId();
  const who = personName || 'this person';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex min-w-[13rem] flex-col gap-2"
    >
      <input type="hidden" name="signupId" value={signupId} />

      <label htmlFor={`${id}-status`} className="sr-only">
        Recruitment status for {who}
      </label>
      <Select
        id={`${id}-status`}
        name="recruitmentStatus"
        defaultValue={status}
        className="h-9 text-xs"
      >
        {RECRUITMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <details className="group">
        <summary className="text-foreground-muted hover:text-foreground inline-flex min-h-8 cursor-pointer items-center text-xs underline underline-offset-2">
          {notes ? 'Edit internal notes' : 'Add internal notes'}
        </summary>
        <label htmlFor={`${id}-notes`} className="sr-only">
          Internal notes for {who}
        </label>
        <Textarea
          id={`${id}-notes`}
          name="recruitmentNotes"
          defaultValue={notes ?? ''}
          maxLength={SURVEY_LIMITS.recruitmentNotes}
          rows={3}
          className="mt-1.5 text-xs"
        />
      </details>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Save
        </Button>
        <p role="status" aria-live="polite" className="text-xs">
          {state?.ok ? <span className="text-success">Saved</span> : null}
          {state && !state.ok ? <span className="text-danger">{state.message}</span> : null}
        </p>
      </div>
    </form>
  );
}

'use client';

import { startTransition, useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
 * One signup's recruitment record. The compact form (table rows) edits
 * status and internal notes; the full form (detail page) also edits the
 * contact / confirmation / test dates and the feedback summary.
 *
 * Nothing here changes the person's own answers, and nothing is sent to the
 * person: recording "Contacted" is a note about what the team did.
 *
 * Submitted via `onSubmit` + `startTransition`, not `<form action>`: React
 * resets an action form after submitting, which would snap fields back and
 * make a saved change look unsaved.
 */
export function RecruitmentEditor({
  signupId,
  personName,
  status,
  notes,
  full,
}: {
  signupId: string;
  personName: string;
  status: RecruitmentStatus;
  notes: string | null;
  full?: {
    contactedOn: string | null;
    confirmedOn: string | null;
    testedOn: string | null;
    feedbackSummary: string | null;
    feedbackLink: string | null;
  };
}) {
  const [state, action, pending] = useActionState<Result<RecruitmentUpdateResult> | null, FormData>(
    updateRecruitmentAction,
    null,
  );
  const id = useId();
  const who = personName || 'this person';
  const fieldError = (name: string) =>
    state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className={full ? 'flex flex-col gap-4' : 'flex min-w-[13rem] flex-col gap-2'}
    >
      <input type="hidden" name="signupId" value={signupId} />
      {full ? <input type="hidden" name="editor" value="full" /> : null}

      {full ? (
        <Field id={`${id}-status`} label="Recruitment status">
          {(aria) => (
            <Select {...aria} name="recruitmentStatus" defaultValue={status}>
              {RECRUITMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <>
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
        </>
      )}

      {full ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              id={`${id}-contacted`}
              label="Contacted on"
              optional
              error={fieldError('contactedOn')}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="date"
                  name="contactedOn"
                  defaultValue={full.contactedOn ?? ''}
                />
              )}
            </Field>
            <Field
              id={`${id}-confirmed`}
              label="Pilot confirmed on"
              optional
              error={fieldError('confirmedOn')}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="date"
                  name="confirmedOn"
                  defaultValue={full.confirmedOn ?? ''}
                />
              )}
            </Field>
            <Field
              id={`${id}-tested`}
              label="Testing completed on"
              optional
              error={fieldError('testedOn')}
            >
              {(aria) => (
                <Input {...aria} type="date" name="testedOn" defaultValue={full.testedOn ?? ''} />
              )}
            </Field>
          </div>
          <Field
            id={`${id}-feedback`}
            label="Feedback summary"
            optional
            description="What they told us after testing. Internal only."
            error={fieldError('feedbackSummary')}
          >
            {(aria) => (
              <Textarea
                {...aria}
                name="feedbackSummary"
                rows={4}
                maxLength={SURVEY_LIMITS.feedbackSummary}
                defaultValue={full.feedbackSummary ?? ''}
              />
            )}
          </Field>
          <Field
            id={`${id}-feedback-link`}
            label="Link to feedback record"
            optional
            description="e.g. interview notes in Drive. https:// links only."
            error={fieldError('feedbackLink')}
          >
            {(aria) => (
              <Input
                {...aria}
                type="url"
                name="feedbackLink"
                maxLength={SURVEY_LIMITS.feedbackLink}
                defaultValue={full.feedbackLink ?? ''}
              />
            )}
          </Field>
          <Field
            id={`${id}-notes`}
            label="Internal notes"
            optional
            error={fieldError('recruitmentNotes')}
          >
            {(aria) => (
              <Textarea
                {...aria}
                name="recruitmentNotes"
                rows={4}
                maxLength={SURVEY_LIMITS.recruitmentNotes}
                defaultValue={notes ?? ''}
              />
            )}
          </Field>
        </>
      ) : (
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
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={full ? 'primary' : 'secondary'} loading={pending}>
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

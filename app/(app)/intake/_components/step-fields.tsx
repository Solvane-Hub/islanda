'use client';

import { Check } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceSurface } from '@/components/ui/workspace-surface';
import { TeamSize } from './team-size';

/**
 * The question on screen.
 *
 * This lives on the CLIENT side of the boundary deliberately. The fields need
 * `fieldErrors`, which is `useActionState` state inside `StepForm`, and the
 * previous shape passed a render prop down from the page to get at it — a
 * function crossing a Server Component into a Client Component, which React
 * refuses to serialise. Everything the fields need is a plain value now, so
 * the page hands over data and this module builds the tree.
 *
 * `stages` arrives as data rather than being imported from
 * `lib/validation/intake`, which keeps Zod out of the client bundle. The
 * vocabulary still has exactly one definition; it is read on the server.
 */
export interface IntakeValues {
  description: string;
  businessStage: string;
  location: string;
  employeeCount: number;
  /** Empty string when unanswered — an optional field, not a zero. */
  fundingAmount: string;
  /** The founder was asked and said they do not know a figure yet. */
  fundingUnknown: boolean;
  founderGoals: string;
}

export interface StageOption {
  value: string;
  label: string;
}

/**
 * Instrument sizing for the controls on this screen.
 *
 * The primitives already carry the surface, the border, the focus treatment
 * and the invalid state; these override only scale, so a control here is the
 * same object as a control in Settings, enlarged. The focus ring is widened
 * from 15% to 30% because on the deep glass the lighter value all but
 * disappears — the border carries the state either way (turquoise measures
 * 9.53:1 against the control fill), and this makes it obvious.
 */
const CONTROL = 'rounded-2xl text-lg focus-visible:ring-brand/30';
const LINE = `${CONTROL} h-14 px-5`;
const WRITING = `${CONTROL} min-h-44 max-w-2xl resize-y px-5 py-4 leading-relaxed`;

export function StepFields({
  step,
  values,
  stages,
  currency,
  fieldErrors,
}: {
  step: number;
  values: IntakeValues;
  stages: readonly StageOption[];
  /** ISO 4217 from the business's country. Derived by `saveStep`, never typed. */
  currency: string | null;
  fieldErrors: Record<string, string[]> | undefined;
}) {
  if (step === 1) {
    return (
      <Field
        id="description"
        size="question"
        label="What does the business do?"
        description="Plain language is best. Islanda uses this to work out which requirements apply."
        error={fieldErrors?.description?.[0]}
      >
        {(aria) => (
          <Textarea
            {...aria}
            name="description"
            rows={6}
            defaultValue={values.description}
            className={WRITING}
            required
          />
        )}
      </Field>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col gap-8">
        <Field
          id="businessStage"
          size="question"
          label="Where are you today?"
          error={fieldErrors?.businessStage?.[0]}
        >
          {(aria) => (
            <Select
              {...aria}
              name="businessStage"
              defaultValue={values.businessStage}
              className={`${LINE} max-w-md pr-12`}
              required
            >
              <option value="" disabled>
                Choose one
              </option>
              {stages.map((s) => (
                <option key={s.value} value={s.value} className="bg-ink text-on-ink">
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* The second half of the same question, set back a step so the screen
            still reads as asking one thing. */}
        <WorkspaceSurface tone="inset" className="p-5 sm:p-6">
          <Field
            id="location"
            label="Where will it operate?"
            description="An island, city or area is enough."
            error={fieldErrors?.location?.[0]}
          >
            {(aria) => (
              <Input
                {...aria}
                name="location"
                defaultValue={values.location}
                className={`${LINE} max-w-md`}
                required
              />
            )}
          </Field>
        </WorkspaceSurface>
      </div>
    );
  }

  if (step === 3) {
    return (
      <Field
        id="employeeCount"
        size="question"
        label="How many people will work in the business?"
        description="Include yourself. Enter 0 if you are not sure yet."
        error={fieldErrors?.employeeCount?.[0]}
      >
        {(aria) => <TeamSize {...aria} name="employeeCount" defaultValue={values.employeeCount} />}
      </Field>
    );
  }

  if (step === 4) {
    return (
      <div className="flex flex-col gap-6">
        <Field
          id="fundingAmount"
          size="question"
          label="How much funding do you think you need?"
          description="A guess you're unsure of is worse than no answer, so if you don't know yet, say so — that is a real answer and Islanda records it as one."
          error={fieldErrors?.fundingAmount?.[0]}
        >
          {(aria) => (
            <div className="border-border-control bg-surface focus-within:border-brand focus-within:ring-brand/30 flex w-full max-w-md items-center rounded-2xl border transition-colors duration-150 focus-within:ring-[3px]">
              {currency ? (
                <span
                  aria-hidden="true"
                  data-numeric
                  className="text-on-glass-subtle border-r border-white/10 py-4 pr-4 pl-5 text-lg"
                >
                  {currency}
                </span>
              ) : null}
              <input
                {...aria}
                name="fundingAmount"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                defaultValue={values.fundingAmount}
                data-numeric
                className="text-on-ink min-w-0 flex-1 [appearance:textfield] border-0 bg-transparent px-5 py-4 text-lg outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          )}
        </Field>

        {/* The alternative answer, not an escape hatch. Ticking it is recorded
            as a decision (ADR-0020), which is what lets the profile tell
            "doesn't know yet" from "never asked". */}
        <label className="border-border-control bg-surface has-[:checked]:border-brand/60 group has-[:focus-visible]:ring-brand/30 flex w-full max-w-md cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-colors duration-150 hover:bg-white/[0.06] has-[:focus-visible]:ring-[3px]">
          <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              name="fundingUnknown"
              defaultChecked={values.fundingUnknown}
              className="peer border-border-control checked:bg-brand checked:border-brand size-5 cursor-pointer appearance-none rounded-md border transition-colors duration-150 outline-none"
            />
            <Check
              aria-hidden="true"
              className="text-abyss pointer-events-none absolute size-3.5 opacity-0 peer-checked:opacity-100"
              strokeWidth={3.5}
            />
          </span>
          <span className="min-w-0">
            <span className="text-on-ink block text-base font-medium">I don’t know yet</span>
            <span className="text-on-ink-muted mt-1 block text-sm text-pretty">
              Islanda will treat funding as an open question rather than assuming you need nothing.
            </span>
          </span>
        </label>
      </div>
    );
  }

  return (
    <Field
      id="founderGoals"
      size="question"
      label="What do you want to achieve?"
      description="What would success look like in the next year?"
      error={fieldErrors?.founderGoals?.[0]}
    >
      {(aria) => (
        <Textarea
          {...aria}
          name="founderGoals"
          rows={5}
          defaultValue={values.founderGoals}
          className={WRITING}
          required
        />
      )}
    </Field>
  );
}

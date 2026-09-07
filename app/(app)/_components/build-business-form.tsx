'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Result } from '@/lib/errors';
import { BUSINESS_STAGES, BUSINESS_STAGE_LABELS } from '@/lib/validation/intake';
import { buildBusinessAction } from '../actions';

/**
 * Build my business — one natural prompt, then a few basics.
 *
 * The concept leads, at reading size: the founder describes what they are
 * building, not fills a government form. Name and jurisdiction are required
 * because the Business Object cannot exist without them (jurisdiction scopes
 * every future regulatory answer); industry and stage are optional here.
 */
export function BuildBusinessForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<Result<{ id: string }> | null, FormData>(
    buildBusinessAction,
    null,
  );

  const err = (n: string) => (state && !state.ok ? state.fieldErrors?.[n]?.[0] : undefined);
  const formError = state && !state.ok && !state.fieldErrors ? state : null;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-8" noValidate>
      {formError ? (
        <Alert tone="error">
          <p>{formError.message}</p>
          <p className="mt-1 text-xs opacity-70">
            Reference: {formError.correlationId.slice(0, 8)}
          </p>
        </Alert>
      ) : null}

      <Field
        id="concept"
        label="Tell FoundryAI what you want to build"
        size="question"
        description="For example: “A premium Bahamian skincare company selling natural products to tourists and local customers in Nassau.”"
        error={err('concept')}
      >
        {(aria) => (
          <Textarea
            {...aria}
            name="concept"
            rows={5}
            placeholder="Describe your business idea in a sentence or two…"
            required
          />
        )}
      </Field>

      <div className="flex flex-col gap-4">
        <p className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
          A few basics
        </p>

        <Field id="name" label="Business name" error={err('name')}>
          {(aria) => (
            <Input
              {...aria}
              name="name"
              autoComplete="organization"
              placeholder="A working name is fine — you can change it later"
              required
            />
          )}
        </Field>

        <Field
          id="countryCode"
          label="Where will it operate?"
          description="This determines which government requirements FoundryAI applies. It cannot be inferred, so we ask directly."
          error={err('countryCode')}
        >
          {(aria) => (
            <Select {...aria} name="countryCode" defaultValue={countries[0]?.code ?? ''} required>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          id="industry"
          label="Industry"
          optional
          description="In your own words — for example, skincare, restaurant, consulting."
          error={err('industry')}
        >
          {(aria) => <Input {...aria} name="industry" />}
        </Field>

        <Field
          id="businessStage"
          label="Where are you today?"
          optional
          error={err('businessStage')}
        >
          {(aria) => (
            <Select {...aria} name="businessStage" defaultValue="">
              <option value="">Not sure yet</option>
              {BUSINESS_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {BUSINESS_STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Button type="submit" loading={pending} className="w-fit">
        Start building
      </Button>
    </form>
  );
}

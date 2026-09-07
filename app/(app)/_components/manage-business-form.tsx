'use client';

import { useActionState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Result } from '@/lib/errors';
import { BUSINESS_STAGES, BUSINESS_STAGE_LABELS } from '@/lib/validation/intake';
import { manageBusinessAction } from '../actions';

/**
 * Manage my business — importing an existing company.
 *
 * Grouped so it reads as "bringing a business in", not one long form: identity,
 * what the business does, then records. The records section is explicit that
 * identifiers stay private and are never treated as verified — the product's
 * honesty rule made visible at the point of entry (§2, §6).
 */
export function ManageBusinessForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<Result<{ id: string }> | null, FormData>(
    manageBusinessAction,
    null,
  );

  const err = (n: string) => (state && !state.ok ? state.fieldErrors?.[n]?.[0] : undefined);
  const formError = state && !state.ok && !state.fieldErrors ? state : null;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-9" noValidate>
      {formError ? (
        <Alert tone="error">
          <p>{formError.message}</p>
          <p className="mt-1 text-xs opacity-70">
            Reference: {formError.correlationId.slice(0, 8)}
          </p>
        </Alert>
      ) : null}

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xs text-champagne mb-1 font-medium tracking-[0.16em] uppercase">
          Business identity
        </legend>

        <Field id="legalName" label="Legal business name" error={err('legalName')}>
          {(aria) => <Input {...aria} name="legalName" autoComplete="organization" required />}
        </Field>

        <Field
          id="tradingName"
          label="Trading name"
          optional
          description="If you trade under a different name from the legal one."
          error={err('tradingName')}
        >
          {(aria) => <Input {...aria} name="tradingName" />}
        </Field>

        <Field
          id="businessType"
          label="Business type"
          optional
          description="In your own words — for example, sole proprietorship, company, partnership."
          error={err('businessType')}
        >
          {(aria) => <Input {...aria} name="businessType" />}
        </Field>

        <Field
          id="countryCode"
          label="Jurisdiction"
          description="Where the business is registered. This determines which government requirements apply."
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
      </fieldset>

      {/* ── What the business does ───────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xs text-champagne mb-1 font-medium tracking-[0.16em] uppercase">
          What the business does
        </legend>

        <Field id="industry" label="Industry" optional error={err('industry')}>
          {(aria) => <Input {...aria} name="industry" />}
        </Field>

        <Field
          id="activities"
          label="Business activities"
          optional
          description="What the business actually does, day to day."
          error={err('activities')}
        >
          {(aria) => <Textarea {...aria} name="activities" rows={3} />}
        </Field>

        <Field
          id="productsServices"
          label="Products & services"
          optional
          error={err('productsServices')}
        >
          {(aria) => <Textarea {...aria} name="productsServices" rows={2} />}
        </Field>

        <Field
          id="targetCustomers"
          label="Target customers"
          optional
          error={err('targetCustomers')}
        >
          {(aria) => <Textarea {...aria} name="targetCustomers" rows={2} />}
        </Field>

        <Field id="location" label="Location" optional error={err('location')}>
          {(aria) => <Input {...aria} name="location" />}
        </Field>

        <Field id="businessStage" label="Stage" optional error={err('businessStage')}>
          {(aria) => (
            <Select {...aria} name="businessStage" defaultValue="">
              <option value="">Not specified</option>
              {BUSINESS_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {BUSINESS_STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          id="operatingStatus"
          label="Operating status"
          optional
          description="For example, operating, dormant, seasonal."
          error={err('operatingStatus')}
        >
          {(aria) => <Input {...aria} name="operatingStatus" />}
        </Field>
      </fieldset>

      {/* ── Records (sensitive identifiers) ──────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-2xs text-champagne mb-1 font-medium tracking-[0.16em] uppercase">
          Registrations &amp; records
        </legend>

        <Alert tone="info">
          <span className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="text-sm">
              These identifiers are private to your business and stored securely. FoundryAI records
              them as <strong>Founder provided · Not verified</strong> — it does not (and cannot
              yet) check them against any registry, and will never imply it has.
            </span>
          </span>
        </Alert>

        <Field
          id="registrationNumber"
          label="Company registration number"
          optional
          error={err('registrationNumber')}
        >
          {(aria) => <Input {...aria} name="registrationNumber" autoComplete="off" />}
        </Field>

        <Field id="taxId" label="Tax identification number (TIN)" optional error={err('taxId')}>
          {(aria) => <Input {...aria} name="taxId" autoComplete="off" />}
        </Field>

        <Field id="vatNumber" label="VAT registration number" optional error={err('vatNumber')}>
          {(aria) => <Input {...aria} name="vatNumber" autoComplete="off" />}
        </Field>
      </fieldset>

      <Button type="submit" loading={pending} className="w-fit">
        Bring my business in
      </Button>
    </form>
  );
}

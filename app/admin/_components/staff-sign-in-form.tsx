'use client';

import { useActionState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormShell, fieldError } from '@/app/(auth)/_components/form-shell';
import type { Result } from '@/lib/errors';
import { staffSignInAction } from '../actions';

export function StaffSignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<Result<never> | null, FormData>(
    staffSignInAction,
    null,
  );

  return (
    <FormShell
      state={state}
      pending={pending}
      action={formAction}
      submitLabel="Sign in"
      {...(next ? { hidden: { next } } : {})}
    >
      <Field id="staff-email" label="Email" error={fieldError(state, 'email')}>
        {(aria) => <Input {...aria} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field id="staff-password" label="Password" error={fieldError(state, 'password')}>
        {(aria) => (
          <Input
            {...aria}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>
    </FormShell>
  );
}

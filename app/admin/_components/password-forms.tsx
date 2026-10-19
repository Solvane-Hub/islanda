'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormShell, fieldError } from '@/app/(auth)/_components/form-shell';
import type { Result } from '@/lib/errors';
import {
  changePasswordAction,
  completeAdminResetAction,
  requestAdminResetAction,
} from '../actions';

function NewPasswordFields({ state }: { state: Result<unknown> | null }) {
  return (
    <>
      <Field
        id="admin-new-password"
        label="New password"
        description="At least 12 characters. A long passphrase is best."
        error={fieldError(state, 'password')}
      >
        {(aria) => (
          <Input
            {...aria}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        )}
      </Field>
      <Field
        id="admin-confirm-password"
        label="Confirm new password"
        error={fieldError(state, 'confirmPassword')}
      >
        {(aria) => (
          <Input
            {...aria}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>
    </>
  );
}

export function ChangePasswordForm({ onDoneHref }: { onDoneHref?: string }) {
  const [state, action, pending] = useActionState<Result<{ changed: true }> | null, FormData>(
    changePasswordAction,
    null,
  );

  if (state?.ok) {
    return (
      <Alert tone="success">
        <p>Your password has been changed.</p>
        {onDoneHref ? (
          <p className="mt-1">
            <Link href={onDoneHref} className="font-medium underline underline-offset-2">
              Continue
            </Link>
          </p>
        ) : null}
      </Alert>
    );
  }

  return (
    <FormShell state={state} pending={pending} action={action} submitLabel="Change password">
      <Field
        id="admin-current-password"
        label="Current password"
        error={fieldError(state, 'currentPassword')}
      >
        {(aria) => (
          <Input
            {...aria}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>
      <NewPasswordFields state={state} />
    </FormShell>
  );
}

export function AdminForgotPasswordForm() {
  const [state, action, pending] = useActionState<Result<{ sent: true }> | null, FormData>(
    requestAdminResetAction,
    null,
  );

  if (state?.ok) {
    return (
      <Alert tone="success">
        <p>
          If that address belongs to an administrator, a reset link is on its way. It expires after
          a short time and can be used once.
        </p>
      </Alert>
    );
  }

  return (
    <FormShell state={state} pending={pending} action={action} submitLabel="Send reset link">
      <Field id="admin-reset-email" label="Email" error={fieldError(state, 'email')}>
        {(aria) => <Input {...aria} name="email" type="email" autoComplete="email" required />}
      </Field>
    </FormShell>
  );
}

export function AdminResetPasswordForm() {
  const [state, action, pending] = useActionState<Result<{ reset: true }> | null, FormData>(
    completeAdminResetAction,
    null,
  );

  if (state?.ok) {
    return (
      <Alert tone="success">
        <p>Your new password is set.</p>
        <p className="mt-1">
          <Link href="/admin" className="font-medium underline underline-offset-2">
            Go to the admin portal
          </Link>
        </p>
      </Alert>
    );
  }

  return (
    <FormShell state={state} pending={pending} action={action} submitLabel="Set new password">
      <NewPasswordFields state={state} />
    </FormShell>
  );
}

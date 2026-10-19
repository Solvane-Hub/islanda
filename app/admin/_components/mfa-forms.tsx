'use client';

import { useActionState, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormShell, fieldError } from '@/app/(auth)/_components/form-shell';
import type { Result } from '@/lib/errors';
import { startMfaEnrollmentAction, verifyMfaAction } from '../actions';

function CodeForm({
  factorId,
  next,
  submitLabel,
}: {
  factorId: string;
  next: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<Result<never> | null, FormData>(
    verifyMfaAction,
    null,
  );
  return (
    <FormShell
      state={state}
      pending={pending}
      action={action}
      submitLabel={submitLabel}
      hidden={{ factorId, next }}
    >
      <Field
        id="admin-mfa-code"
        label="6-digit code"
        description="From your authenticator app (for example Google Authenticator, Microsoft Authenticator, 1Password)."
        error={fieldError(state, 'code')}
      >
        {(aria) => (
          <Input
            {...aria}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="font-mono tracking-[0.3em]"
          />
        )}
      </Field>
    </FormShell>
  );
}

export function MfaVerifyForm({ factorId, next }: { factorId: string; next: string }) {
  return <CodeForm factorId={factorId} next={next} submitLabel="Verify" />;
}

/**
 * First-time setup: scan the QR code (or type the key), then confirm with a
 * code. The key is shown once and never stored by Islanda.
 */
export function MfaEnrollPanel({ next }: { next: string }) {
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert tone="error">
            <p>{error}</p>
          </Alert>
        ) : null}
        <Button
          type="button"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startMfaEnrollmentAction();
              if (result.ok) {
                setEnrollment(result.data);
                setError(null);
              } else {
                setError(result.message);
              }
            })
          }
        >
          Set up my authenticator
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="text-foreground flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>Open your authenticator app and add a new account.</li>
        <li>Scan this QR code, or enter the key below.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {/* A data: URI returned by Supabase Auth; not a remote image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrCode}
        alt="QR code to add Islanda admin to your authenticator app"
        width={200}
        height={200}
        className="rounded-xl bg-white p-2"
      />
      <p className="text-foreground-muted text-xs">
        Key:{' '}
        <code className="text-foreground font-mono break-all select-all">{enrollment.secret}</code>
      </p>
      <CodeForm factorId={enrollment.factorId} next={next} submitLabel="Confirm and continue" />
    </div>
  );
}

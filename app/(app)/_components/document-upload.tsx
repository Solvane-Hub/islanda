'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileUp, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { createClient } from '@/lib/supabase/client';
import { DOCUMENT_TYPES } from '@/lib/validation/business-intelligence';
import { requestDocumentUploadAction, finalizeDocumentUploadAction } from '../documents/actions';

/** Human labels for the document types. Presentation only. */
const TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  financial_statement: 'Financial statement',
  profit_loss: 'Profit & loss',
  sales_report: 'Sales report',
  tax_document: 'Tax document',
  invoice: 'Invoice',
  expense_report: 'Expense report',
  bank_statement: 'Bank statement',
  payroll_report: 'Payroll report',
  inventory_report: 'Inventory report',
  registration: 'Registration',
  licence: 'Licence',
  certificate: 'Certificate',
  other: 'Other',
};

type Phase = 'idle' | 'working' | 'done';

/**
 * Add a document to the business.
 *
 * A three-step secure flow: request a signed upload ticket, upload the bytes
 * straight to private storage, then confirm. The file never passes through a
 * server action, and the bucket is private — nothing here produces a public URL.
 *
 * ⚠ It never claims Islanda understands the document. On success the founder is
 *   told it is stored; analysis is honestly absent until extraction exists.
 *
 * Validation errors land on the field they belong to. The ticket request
 * returns per-field errors; they used to be dropped, so a missing title showed
 * "Please correct the highlighted fields" with nothing highlighted.
 *
 * No file-type or size limit is configured on the private bucket, so this form
 * states none rather than inventing one; the storage project's own upload limit
 * still applies and surfaces as an upload error.
 */
export function DocumentUpload({ periods }: { periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors(undefined);
    const chosen = fileRef.current?.files?.[0] ?? null;
    if (!chosen) {
      setFieldErrors({ file: ['Choose a file to add.'] });
      return;
    }

    setPhase('working');
    try {
      const title = String(formData.get('title') ?? '');
      const ticket = await requestDocumentUploadAction({
        documentType: String(formData.get('documentType') ?? ''),
        title,
        filename: chosen.name,
        financialPeriodId: String(formData.get('financialPeriodId') ?? '') || undefined,
        documentDate: String(formData.get('documentDate') ?? '') || undefined,
        expirationDate: String(formData.get('expirationDate') ?? '') || undefined,
      });
      if (!ticket.ok) {
        if (ticket.fieldErrors) setFieldErrors(ticket.fieldErrors);
        else setError(ticket.message);
        setPhase('idle');
        return;
      }

      const supabase = createClient();
      const upload = await supabase.storage
        .from(ticket.data.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, chosen);
      if (upload.error) {
        setError('The file could not be uploaded securely. Please try again.');
        setPhase('idle');
        return;
      }

      const finalized = await finalizeDocumentUploadAction({
        documentId: ticket.data.documentId,
        contentType: chosen.type || undefined,
        byteSize: chosen.size,
      });
      if (!finalized.ok) {
        setError(finalized.message);
        setPhase('idle');
        return;
      }

      setPhase('done');
      setSavedTitle(title.trim() || chosen.name);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch {
      setError(
        'Something went wrong adding that document. Your file was not saved. Please try again.',
      );
      setPhase('idle');
    }
  }

  const fileError = fieldErrors?.file?.[0] ?? fieldErrors?.filename?.[0];

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <SurfaceLabel as="h2">Add a document</SurfaceLabel>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Choose a file from your phone or computer, give it a name, and save it. You can add PDFs,
          photos, spreadsheets or other files.
        </p>
      </div>

      <form action={onSubmit} className="flex flex-col gap-5" noValidate>
        {/* Dropzone-style file control. A real <input type=file>, styled. */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            id="document-file"
            type="file"
            name="file"
            className="peer sr-only"
            aria-invalid={Boolean(fileError)}
            aria-describedby={fileError ? 'document-file-error' : undefined}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPhase('idle');
              setFieldErrors(undefined);
            }}
          />
          <label
            htmlFor="document-file"
            className="border-border-control hover:border-bahama-turquoise/50 peer-focus-visible:ring-brand/30 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-white/[0.02] px-6 py-8 text-center transition-colors duration-150 peer-focus-visible:ring-[3px]"
            data-has-file={file ? 'true' : undefined}
          >
            <FileUp aria-hidden="true" className="text-champagne size-6" strokeWidth={1.5} />
            <span className="text-on-ink text-sm font-medium break-all">
              {file ? file.name : 'Choose a file'}
            </span>
            <span className="text-on-glass-subtle text-2xs">
              {file ? `${(file.size / 1024).toFixed(0)} KB · tap to change` : 'Tap or click here'}
            </span>
          </label>
          {fileError ? (
            <p id="document-file-error" role="alert" className="text-danger text-xs font-medium">
              {fileError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="title" label="Name" required error={fieldErrors?.title?.[0]}>
            {(aria) => (
              <Input {...aria} name="title" placeholder="e.g. March supplier receipts" required />
            )}
          </Field>

          <Field
            id="documentType"
            label="What kind of document is it?"
            required
            error={fieldErrors?.documentType?.[0]}
          >
            {(aria) => (
              <Select {...aria} name="documentType" defaultValue="" required>
                <option value="" disabled>
                  Choose one
                </option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {periods.length > 0 ? (
            <Field id="financialPeriodId" label="Reporting period" optional>
              {(aria) => (
                <Select {...aria} name="financialPeriodId" defaultValue="">
                  <option value="">Not tied to a period</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          <Field
            id="documentDate"
            label="Date on the document"
            optional
            error={fieldErrors?.documentDate?.[0]}
          >
            {(aria) => <Input {...aria} name="documentDate" type="date" />}
          </Field>

          <Field
            id="expirationDate"
            label="Expiry date, if it has one"
            optional
            error={fieldErrors?.expirationDate?.[0]}
          >
            {(aria) => <Input {...aria} name="expirationDate" type="date" />}
          </Field>
        </div>

        {/* One live region for the outcome, so a screen reader hears the result
            of the upload whichever way it went. */}
        <div aria-live="polite">
          {error ? <Alert tone="error">{error}</Alert> : null}

          {phase === 'done' && savedTitle ? (
            <Alert tone="success">
              <span className="flex items-start gap-2">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.75}
                />
                <span className="text-sm">
                  Saved. “{savedTitle}” is stored privately with your business.{' '}
                  <span className="text-on-ink-muted">Islanda does not read what is in it.</span>
                </span>
              </span>
            </Alert>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={phase === 'working'} className="w-fit">
            {phase === 'working' ? 'Saving your document' : 'Save document'}
          </Button>
          <span className="text-on-glass-subtle text-2xs inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            Private to your business. Not public.
          </span>
        </div>
      </form>
    </WorkspaceSurface>
  );
}

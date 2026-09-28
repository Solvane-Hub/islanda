'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from 'lucide-react';
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
 */
export function DocumentUpload({ periods }: { periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const chosen = fileRef.current?.files?.[0] ?? null;
    if (!chosen) {
      setError('Choose a file to add.');
      return;
    }

    setPhase('working');
    try {
      const ticket = await requestDocumentUploadAction({
        documentType: String(formData.get('documentType') ?? ''),
        title: String(formData.get('title') ?? ''),
        filename: chosen.name,
        financialPeriodId: String(formData.get('financialPeriodId') ?? '') || undefined,
        documentDate: String(formData.get('documentDate') ?? '') || undefined,
        expirationDate: String(formData.get('expirationDate') ?? '') || undefined,
      });
      if (!ticket.ok) {
        setError(ticket.message);
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
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch {
      setError('Something went wrong adding that document. Please try again.');
      setPhase('idle');
    }
  }

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <SurfaceLabel as="h2">Add to your business</SurfaceLabel>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Upload a financial statement, registration, licence, report, or other business record. It
          is stored privately to your business.
        </p>
      </div>

      <form action={onSubmit} className="flex flex-col gap-5" noValidate>
        {/* Dropzone-style file control. A real <input type=file>, styled. */}
        <label
          className="border-border-control hover:border-bahama-turquoise/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-white/[0.02] px-6 py-8 text-center transition-colors duration-150"
          data-has-file={file ? 'true' : undefined}
        >
          <FileUp aria-hidden="true" className="text-champagne size-6" strokeWidth={1.5} />
          <span className="text-on-ink text-sm font-medium">
            {file ? file.name : 'Drop a document here, or choose a file'}
          </span>
          <span className="text-on-glass-subtle text-2xs">
            {file ? `${(file.size / 1024).toFixed(0)} KB` : 'PDF, image, or spreadsheet'}
          </span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="title" label="Title" error={undefined}>
            {(aria) => (
              <Input {...aria} name="title" placeholder="e.g. Q2 2026 statement" required />
            )}
          </Field>

          <Field id="documentType" label="Document type">
            {(aria) => (
              <Select {...aria} name="documentType" defaultValue="financial_statement">
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

          <Field id="documentDate" label="Document date" optional>
            {(aria) => <Input {...aria} name="documentDate" type="date" />}
          </Field>

          <Field id="expirationDate" label="Expiration date" optional>
            {(aria) => <Input {...aria} name="expirationDate" type="date" />}
          </Field>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {phase === 'done' ? (
          <Alert tone="success">
            <span className="flex items-start gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
              />
              <span className="text-sm">
                Added to your business and stored securely.{' '}
                <span className="text-on-ink-muted">Analysis is not yet available.</span>
              </span>
            </span>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={phase === 'working'} className="w-fit">
            {phase === 'working' ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Adding securely
              </>
            ) : (
              'Add document'
            )}
          </Button>
          <span className="text-on-glass-subtle text-2xs inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            Private to your business. Never shared, never public.
          </span>
        </div>
      </form>
    </WorkspaceSurface>
  );
}

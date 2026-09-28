'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { attachEvidenceAction } from '../actions';

export interface MetricEvidenceItem {
  linkId: string;
  documentId: string;
  documentTitle: string;
}

/**
 * "Add evidence" — the smallest usable affordance on top of the P8 evidence
 * foundation (ADR-0022, Milestone 3). Attaches an existing private business
 * document to an existing metric as evidence, then shows it.
 *
 * ⚠ Evidence here means "this metric has been explicitly linked to this
 *   document" — nothing more. There is no document extraction in this
 *   product, so this never claims Islanda read the document or that its
 *   contents support the figure; it names the document and nothing else.
 *
 * Same collapsed-button → inline-form interaction as `RecordFigure`, so a
 * founder learns the pattern once.
 */
export function AddEvidence({
  metricId,
  documents,
  evidence,
}: {
  metricId: string;
  documents: { id: string; title: string }[];
  evidence: MetricEvidenceItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState('');

  // A document already attached to this metric shouldn't be offered again.
  const attachedIds = new Set(evidence.map((e) => e.documentId));
  const available = documents.filter((d) => !attachedIds.has(d.id));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId) {
      setError('Choose a document.');
      return;
    }
    setError(null);
    setPending(true);
    const res = await attachEvidenceAction({ metricId, documentId });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setDocumentId('');
      router.refresh();
    } else {
      setError(res.message);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {evidence.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {evidence.map((item) => (
            <li key={item.linkId} className="flex items-center gap-1.5">
              <FileText aria-hidden="true" className="text-champagne-dim size-3 shrink-0" />
              <span className="text-on-glass-subtle text-2xs">
                Evidence: <span className="text-on-ink-muted">{item.documentTitle}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!open ? (
        available.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-bahama-turquoise hover:text-on-ink text-2xs inline-flex w-fit items-center gap-1 rounded-sm font-medium transition-colors duration-150"
          >
            <Plus aria-hidden="true" className="size-3" strokeWidth={2} />
            Add evidence
          </button>
        ) : null
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field id={`evidence-doc-${metricId}`} label="Select a business document">
            {(aria) => (
              <Select {...aria} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                <option value="">Choose a document…</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={pending} size="sm" className="w-fit">
              Attach
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-on-ink-muted hover:text-on-ink text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

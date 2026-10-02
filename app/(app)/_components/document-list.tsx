'use client';

import { useState } from 'react';
import { Eye, FileText, Loader2 } from 'lucide-react';
import { ProvenanceBadge, type ProvenanceKind } from '@/components/ui/provenance-badge';
import type { FactProvenance, VerificationState } from '@/types/business';
import { documentViewUrlAction } from '../documents/actions';

/** Provenance chip for a document. Verified state wins, else the origin. */
export function documentProvenanceKind(
  provenance: FactProvenance,
  verification: VerificationState,
): ProvenanceKind {
  if (verification === 'verified') return 'evidence_verified';
  if (verification === 'verification_unavailable') return 'verification_unavailable';
  return provenance;
}

/** A serializable, client-safe projection of a document. No storage path. */
export interface DocumentListItem {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  provenanceKind: ProvenanceKind;
  documentDate: string | null;
  periodLabel: string | null;
  hasFile: boolean;
  /** Figures this document supports (founder-linked), e.g. "Revenue BSD 63,200". */
  supports: string | null;
}

export function DocumentList({ items }: { items: readonly DocumentListItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setError(null);
    setLoadingId(id);
    try {
      const res = await documentViewUrlAction(id);
      if (res.ok) window.open(res.data.url, '_blank', 'noopener,noreferrer');
      else setError(res.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-danger text-xs">{error}</p> : null}
      <ul className="flex flex-col divide-y divide-white/8">
        {items.map((doc) => (
          <li key={doc.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5">
            <span className="bg-champagne/10 text-champagne flex size-9 shrink-0 items-center justify-center rounded-lg">
              <FileText aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-on-ink truncate text-sm font-medium">{doc.title}</span>
              <span className="text-on-glass-subtle text-2xs">
                {[doc.typeLabel, doc.periodLabel, doc.documentDate].filter(Boolean).join(' · ')}
              </span>
              {doc.supports ? (
                <span className="text-champagne-dim text-2xs">Supports: {doc.supports}</span>
              ) : null}
            </div>

            <span className="text-on-ink-muted hidden text-xs sm:inline">{doc.status}</span>
            <ProvenanceBadge kind={doc.provenanceKind} />

            {doc.hasFile ? (
              <button
                type="button"
                onClick={() => view(doc.id)}
                disabled={loadingId === doc.id}
                className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-9 items-center gap-1.5 rounded-sm text-xs font-medium transition-colors duration-150 disabled:opacity-60"
              >
                {loadingId === doc.id ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <Eye aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                )}
                View
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

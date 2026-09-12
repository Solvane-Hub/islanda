import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { FileText, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getBusinessDocuments } from '@/services/documents';
import { getFinancialPeriods, getBusinessMetrics } from '@/services/financials';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import {
  DOCUMENT_TYPE_LABELS,
  documentStatusLabel,
} from '@/lib/business-intelligence/document-display';
import { METRIC_KEY_LABELS, formatMetricValue } from '@/lib/business-intelligence/performance';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { DocumentUpload } from '../_components/document-upload';
import {
  DocumentList,
  documentProvenanceKind,
  type DocumentListItem,
} from '../_components/document-list';

export const metadata: Metadata = { title: 'Documents' };

/**
 * Documents — the secure vault surface.
 *
 * Real upload into private per-business storage, and an honest list: a stored
 * file says "analysis not yet available" because no extraction has run. This is
 * a restrained records surface, not a file-management application.
 */
export default async function DocumentsPage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) {
    return (
      <div className="workspace-env flex flex-col gap-6">
        <EmptyState
          icon={<Rocket aria-hidden="true" className="size-5" strokeWidth={1.75} />}
          title="No business yet"
          explanation="Documents are held against a business. Create one first, then bring your records in."
          nextStep="Start by telling us what you're building."
          action={
            <Link href="/businesses/new">
              <Button>Create a business</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [documents, periods, metrics] = await Promise.all([
    getBusinessDocuments(db, current.id),
    getFinancialPeriods(db, current.id),
    getBusinessMetrics(db, current.id),
  ]);

  const periodLabels = new Map(periods.map((p) => [p.id, p.label ?? '']));

  // Figures a founder linked to each document — the "this document supports X"
  // relationship. Manual linkage only; nothing here implies automatic extraction.
  const supportsByDocument = new Map<string, string[]>();
  for (const m of metrics) {
    if (!m.source_document_id) continue;
    const label = `${METRIC_KEY_LABELS[m.metric_key]} ${formatMetricValue(Number(m.value), m.currency, m.unit)}`;
    const list = supportsByDocument.get(m.source_document_id) ?? [];
    list.push(label);
    supportsByDocument.set(m.source_document_id, list);
  }

  const items: DocumentListItem[] = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    typeLabel: DOCUMENT_TYPE_LABELS[doc.document_type],
    status: documentStatusLabel(doc.processing_status, doc.extraction_status),
    provenanceKind: documentProvenanceKind(doc.provenance, doc.verification_state),
    documentDate: doc.document_date,
    periodLabel: doc.financial_period_id
      ? (periodLabels.get(doc.financial_period_id) ?? null)
      : null,
    hasFile: doc.storage_path !== null && doc.processing_status !== 'pending',
    supports: supportsByDocument.get(doc.id)?.join(' · ') ?? null,
  }));

  return (
    <div className="workspace-env flex flex-col gap-6">
      <header className="flex flex-col gap-2 px-1 pt-2">
        <p className="text-2xs text-champagne font-medium tracking-[0.16em] uppercase">
          {current.name}
        </p>
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          Documents
        </h1>
        <p className="text-on-ink-muted max-w-prose text-sm">
          The records your business holds — stored privately, each with its own provenance.
        </p>
      </header>

      <DocumentUpload
        periods={periods.map((p) => ({ id: p.id, label: p.label ?? p.period_start }))}
      />

      <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-5 p-6 sm:p-8">
        <SurfaceLabel as="h2">Your documents</SurfaceLabel>
        {items.length > 0 ? (
          <DocumentList items={items} />
        ) : (
          <div className="flex flex-col items-start gap-2 py-4">
            <span className="bg-champagne/10 text-champagne flex size-10 items-center justify-center rounded-xl">
              <FileText aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </span>
            <p className="text-on-ink text-sm font-medium">No documents yet</p>
            <p className="text-on-ink-muted max-w-prose text-sm">
              Add your first business record above — a financial statement, a licence, a
              registration. FoundryAI keeps it private to your business.
            </p>
          </div>
        )}
      </WorkspaceSurface>
    </div>
  );
}

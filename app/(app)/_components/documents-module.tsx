import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import type { BusinessDocument } from '@/types/business-intelligence';
import {
  DOCUMENT_TYPE_LABELS,
  documentStatusLabel,
} from '@/lib/business-intelligence/document-display';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';

/**
 * A compact documents presence on the command centre. The full intake and list
 * live at /documents; this shows the few most recent and a way in.
 */
export function DocumentsModule({ documents }: { documents: readonly BusinessDocument[] }) {
  const recent = documents.slice(0, 3);

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
          <SurfaceLabel as="h2">Documents</SurfaceLabel>
        </div>
        <Link
          href="/documents"
          className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 text-xs font-medium"
        >
          {documents.length > 0 ? `View all (${documents.length})` : 'Add documents'}
          <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>

      {recent.length > 0 ? (
        <ul className="flex flex-col divide-y divide-white/8">
          {recent.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="bg-champagne/10 text-champagne flex size-8 shrink-0 items-center justify-center rounded-lg">
                <FileText aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-on-ink truncate text-sm font-medium">{doc.title}</span>
                <span className="text-on-glass-subtle text-2xs">
                  {DOCUMENT_TYPE_LABELS[doc.document_type]} ·{' '}
                  {documentStatusLabel(doc.processing_status, doc.extraction_status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Bring your business records in — statements, licences, registrations. Each is stored
          privately to your business.
        </p>
      )}
    </WorkspaceSurface>
  );
}

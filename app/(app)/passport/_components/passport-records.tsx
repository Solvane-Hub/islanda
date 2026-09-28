'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileText, Link2, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { DOCUMENT_TYPE_LABELS } from '@/lib/business-intelligence/document-display';
import type { DocumentProcessingStatus } from '@/types/business-intelligence';
import type { BusinessPassport } from '@/services/passport';
import { PassportPage } from './passport-page';

type Register = 'documents' | 'evidence' | 'financial';

/**
 * Processing status only. The shared `documentStatusLabel` also needs an
 * extraction status, which the Passport contract deliberately does not
 * carry — stating "Analyzed" here would be a claim the Passport cannot
 * stand behind, so the register reports the one fact it actually holds:
 * whether the file is in hand.
 */
const PROCESSING_LABELS: Record<DocumentProcessingStatus, string> = {
  pending: 'Awaiting upload',
  stored: 'Held',
  processing: 'Processing',
  processed: 'Held',
  failed: 'Needs attention',
};

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/**
 * Document-style date. Formatted from parts rather than
 * `toLocaleDateString` so the server and the client always print the same
 * string — a locale-dependent format would hydrate differently and flicker.
 */
function stampDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Page 05 — the register: what has been entered against this business over
 * time, in three columns of the same book.
 *
 * Evidence lines state LINKAGE only ("supported by"), never that a document
 * was read or verified — the Passport's evidence contract structurally
 * cannot carry document contents, and the page must not imply otherwise.
 */
export function PassportRecords({
  passport,
  totalPages,
  reference,
}: {
  passport: BusinessPassport;
  totalPages: number;
  reference: string;
}) {
  const { documents, evidenceForMetrics, financials } = passport;
  const [register, setRegister] = useState<Register>('documents');

  const metricLabelById = new Map(financials.recorded.map((m) => [m.id, m.label] as const));
  const evidenceEntries = Object.entries(evidenceForMetrics).filter(([, v]) => v.length > 0);

  const registers: { id: Register; label: string; count: number }[] = [
    { id: 'documents', label: 'Documents', count: documents.length },
    { id: 'evidence', label: 'Evidence', count: evidenceEntries.length },
    { id: 'financial', label: 'Financial', count: financials.recorded.length },
  ];

  return (
    <PassportPage
      title="Records"
      subtitle="Evidence & documents"
      pageNumber={5}
      totalPages={totalPages}
      reference={reference}
    >
      <div
        role="tablist"
        aria-label="Record registers"
        className="border-passport-line/70 flex items-end justify-between gap-1 border-b"
      >
        {registers.map((tab) => {
          const isActive = tab.id === register;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setRegister(tab.id)}
              className={cn(
                // Tracking and the count are kept tight deliberately: the
                // narrowest leaf this row has to survive is the 1280px
                // two-page spread, where a wider row clipped its last tab.
                'text-3xs -mb-px border-b-2 pb-2 font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors duration-150',
                isActive
                  ? 'border-passport-accent text-passport-ink'
                  : 'text-passport-ink-muted/80 hover:text-passport-ink border-transparent',
              )}
            >
              {tab.label}
              <span className="text-4xs ml-1 font-mono tabular-nums opacity-70">
                {String(tab.count).padStart(2, '0')}
              </span>
            </button>
          );
        })}
      </div>

      {register === 'documents' ? (
        documents.length > 0 ? (
          <ul className="mt-1">
            {documents.map((doc) => (
              <RegisterLine
                key={doc.id}
                icon={<FileText className="size-3.5" strokeWidth={1.75} />}
                title={doc.title}
                detail={`${DOCUMENT_TYPE_LABELS[doc.documentType]} · ${PROCESSING_LABELS[doc.processingStatus]}`}
                stamp={stampDate(doc.documentDate ?? doc.createdAt)}
              />
            ))}
          </ul>
        ) : (
          <EmptyRegister note="No documents entered against this business yet." />
        )
      ) : null}

      {register === 'evidence' ? (
        evidenceEntries.length > 0 ? (
          <ul className="mt-1">
            {evidenceEntries.flatMap(([metricId, views]) =>
              views.map((view) => (
                <RegisterLine
                  key={view.linkId}
                  icon={<Link2 className="size-3.5" strokeWidth={1.75} />}
                  title={metricLabelById.get(metricId) ?? 'Recorded figure'}
                  detail={`Supported by ${view.documentTitle}`}
                  stamp={stampDate(view.createdAt)}
                />
              )),
            )}
          </ul>
        ) : (
          <EmptyRegister note="No recorded figure has a supporting document yet." />
        )
      ) : null}

      {register === 'financial' ? (
        financials.recorded.length > 0 ? (
          <ul className="mt-1">
            {financials.recorded.map((metric) => (
              <RegisterLine
                key={metric.id}
                icon={<Landmark className="size-3.5" strokeWidth={1.75} />}
                title={metric.label}
                detail={financials.currentPeriodLabel ?? 'Recorded figure'}
                stamp={metric.display}
                stampMono
              />
            ))}
          </ul>
        ) : (
          <EmptyRegister note="No financial figures recorded yet." />
        )
      ) : null}

      <Link
        href={register === 'documents' ? '/documents' : '/dashboard#financials'}
        className="text-passport-accent hover:text-passport-ink text-3xs mt-4 inline-flex items-center gap-1.5 font-medium tracking-[0.14em] uppercase transition-colors duration-150"
      >
        Open in Islanda
        <ArrowUpRight aria-hidden="true" className="size-3" strokeWidth={2} />
      </Link>
    </PassportPage>
  );
}

function RegisterLine({
  icon,
  title,
  detail,
  stamp,
  stampMono,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  stamp: string | null;
  stampMono?: boolean;
}) {
  return (
    <li className="border-passport-line/60 flex items-start justify-between gap-4 border-b py-2.5">
      <span className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className="text-passport-accent/70 mt-0.5 shrink-0">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="text-passport-ink block truncate text-[0.8125rem] font-medium">
            {title}
          </span>
          <span className="text-passport-ink-muted text-3xs mt-0.5 block truncate tracking-[0.08em] uppercase">
            {detail}
          </span>
        </span>
      </span>
      {stamp ? (
        <span
          className={cn(
            'text-passport-ink-muted text-3xs shrink-0 tracking-[0.1em]',
            stampMono ? 'text-passport-ink font-mono font-medium' : 'font-mono',
          )}
        >
          {stamp}
        </span>
      ) : null}
    </li>
  );
}

function EmptyRegister({ note }: { note: string }) {
  return <p className="text-passport-ink-muted/80 mt-4 text-[0.8125rem] italic">— {note}</p>;
}

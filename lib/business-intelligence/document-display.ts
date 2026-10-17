import type {
  BusinessDocumentType,
  DocumentExtractionStatus,
  DocumentProcessingStatus,
} from '@/types/business-intelligence';

/** Human labels for document types. Presentation only. */
export const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
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
  other: 'Document',
};

/**
 * An honest status line for a document.
 *
 * ⚠ It never claims analysis that has not happened. A stored file with no
 *   extraction reads "Uploaded · not read by Islanda" — the truth today. The
 *   three states a person must be able to tell apart are uploaded (here),
 *   linked to a figure (shown separately, as "Linked to"), and analysed —
 *   and nothing produces the last one yet.
 */
export function documentStatusLabel(
  processing: DocumentProcessingStatus,
  extraction: DocumentExtractionStatus,
): string {
  if (extraction === 'extracted') return 'Analyzed';
  if (processing === 'failed' || extraction === 'failed') return 'Needs attention';
  if (processing === 'processing' || extraction === 'pending') return 'Processing';
  if (processing === 'stored') return 'Uploaded · not read by Islanda';
  if (processing === 'pending') return 'Upload not finished';
  return 'Stored';
}

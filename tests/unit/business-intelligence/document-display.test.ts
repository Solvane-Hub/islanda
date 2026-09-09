import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPE_LABELS,
  documentStatusLabel,
} from '@/lib/business-intelligence/document-display';

/**
 * Document status is honest about analysis that has not happened — a stored file
 * with no extraction reads "analysis not yet available", never "analyzed".
 */
describe('documentStatusLabel', () => {
  it('is honest about a stored-but-not-analyzed document', () => {
    expect(documentStatusLabel('stored', 'not_started')).toBe(
      'Stored · analysis not yet available',
    );
  });

  it('reports pending, processing, analyzed and failed distinctly', () => {
    expect(documentStatusLabel('pending', 'not_started')).toBe('Pending upload');
    expect(documentStatusLabel('processing', 'not_started')).toBe('Processing');
    expect(documentStatusLabel('stored', 'extracted')).toBe('Analyzed');
    expect(documentStatusLabel('failed', 'not_started')).toBe('Needs attention');
    expect(documentStatusLabel('stored', 'failed')).toBe('Needs attention');
  });

  it('labels every document type', () => {
    expect(DOCUMENT_TYPE_LABELS.financial_statement).toBe('Financial statement');
    expect(DOCUMENT_TYPE_LABELS.licence).toBe('Licence');
  });
});

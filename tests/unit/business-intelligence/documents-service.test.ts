import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/business-documents', () => ({
  insertBusinessDocument: vi.fn(),
  updateBusinessDocument: vi.fn(),
  listBusinessDocuments: vi.fn(),
  findBusinessDocumentById: vi.fn(),
}));
vi.mock('@/services/audit', () => ({ recordAuditEvent: vi.fn() }));

import {
  insertBusinessDocument,
  updateBusinessDocument,
  findBusinessDocumentById,
} from '@/lib/db/business-documents';
import { recordAuditEvent } from '@/services/audit';
import {
  beginDocumentUpload,
  markDocumentStored,
  getDocumentDownloadUrl,
} from '@/services/documents';

const audit = vi.mocked(recordAuditEvent);

/** A fake request-scoped client with a storage stub. */
function fakeDb(storage: { createSignedUploadUrl?: unknown; createSignedUrl?: unknown }): never {
  return {
    storage: {
      from: () => ({
        createSignedUploadUrl:
          storage.createSignedUploadUrl ??
          vi
            .fn()
            .mockResolvedValue({ data: { token: 'tok', path: 'p', signedUrl: 'x' }, error: null }),
        createSignedUrl:
          storage.createSignedUrl ??
          vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null }),
      }),
    },
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('beginDocumentUpload', () => {
  it('creates a founder-provided record, a scoped path, and a signed ticket', async () => {
    vi.mocked(insertBusinessDocument).mockResolvedValue({
      data: { id: 'doc-1' } as never,
      error: null,
    });
    vi.mocked(updateBusinessDocument).mockResolvedValue({
      data: { id: 'doc-1' } as never,
      error: null,
    });

    const ticket = await beginDocumentUpload(fakeDb({}), 'owner-1', {
      businessId: 'biz-1',
      documentType: 'financial_statement',
      title: 'Q2 2026',
      filename: 'my statement!!.pdf',
    });

    // The document row is founder_provided (a fact extracted LATER is user_document).
    expect(insertBusinessDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provenance: 'founder_provided', business_id: 'biz-1' }),
    );
    // Path is scoped to business/document and the filename is sanitised.
    expect(ticket.path).toMatch(/^biz-1\/doc-1\/my_statement_\.pdf$/);
    expect(ticket.token).toBe('tok');
    // The storage_path is recorded on the row.
    expect(updateBusinessDocument).toHaveBeenCalledWith(expect.anything(), 'doc-1', {
      storage_path: ticket.path,
    });
    // Audit carries the type only.
    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.document_added');
    expect(call?.[0]?.metadata).toEqual({ document_type: 'financial_statement' });
  });
});

describe('markDocumentStored', () => {
  it('marks stored and records size/type but NEVER claims extraction', async () => {
    vi.mocked(findBusinessDocumentById).mockResolvedValue({
      id: 'doc-1',
      content_type: null,
      byte_size: null,
    } as never);
    vi.mocked(updateBusinessDocument).mockResolvedValue({
      data: { id: 'doc-1' } as never,
      error: null,
    });

    await markDocumentStored(fakeDb({}), 'owner-1', 'doc-1', {
      contentType: 'application/pdf',
      byteSize: 2048,
    });

    const patch = vi.mocked(updateBusinessDocument).mock.calls[0]?.[2];
    expect(patch).toMatchObject({
      processing_status: 'stored',
      content_type: 'application/pdf',
      byte_size: 2048,
    });
    // It must not touch extraction_status — no analysis has run.
    expect(patch).not.toHaveProperty('extraction_status');
  });

  it('refuses a document the caller cannot see (RLS-filtered)', async () => {
    vi.mocked(findBusinessDocumentById).mockResolvedValue(null);
    await expect(markDocumentStored(fakeDb({}), 'owner-1', 'doc-x', {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('getDocumentDownloadUrl', () => {
  it('returns a signed URL for an owned document with a stored object', async () => {
    vi.mocked(findBusinessDocumentById).mockResolvedValue({
      id: 'doc-1',
      storage_path: 'biz-1/doc-1/f.pdf',
    } as never);
    const url = await getDocumentDownloadUrl(fakeDb({}), 'doc-1');
    expect(url).toBe('https://signed');
  });

  it('returns null when there is no stored object', async () => {
    vi.mocked(findBusinessDocumentById).mockResolvedValue({
      id: 'doc-1',
      storage_path: null,
    } as never);
    expect(await getDocumentDownloadUrl(fakeDb({}), 'doc-1')).toBeNull();
  });

  it('returns null (never throws, never a public URL) when the document is not the caller’s', async () => {
    vi.mocked(findBusinessDocumentById).mockResolvedValue(null);
    expect(await getDocumentDownloadUrl(fakeDb({}), 'doc-x')).toBeNull();
  });
});

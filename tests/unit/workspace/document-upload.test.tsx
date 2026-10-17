import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Document upload — errors land where the person can fix them.
 *
 * Regression: the ticket request's per-field validation errors were dropped,
 * so a missing name produced "Please correct the highlighted fields" with
 * nothing highlighted. The storage and action layers are mocked at the module
 * boundary; private-storage behaviour is covered by the RLS suite.
 */
const h = vi.hoisted(() => ({
  request: vi.fn(),
  finalize: vi.fn(),
  upload: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock('@/app/(app)/documents/actions', () => ({
  requestDocumentUploadAction: h.request,
  finalizeDocumentUploadAction: h.finalize,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: h.upload }) } }),
}));

const { DocumentUpload } = await import('@/app/(app)/_components/document-upload');

function chooseFile() {
  const input = screen.getByLabelText(/Choose a file/) as HTMLInputElement;
  const file = new File(['hello'], 'receipt.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('DocumentUpload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for a file, on the file control, before contacting the server', async () => {
    render(<DocumentUpload periods={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
    const error = await screen.findByText('Choose a file to add.');
    expect(error.id).toBe('document-file-error');
    expect(screen.getByLabelText(/Choose a file/)).toHaveAttribute('aria-invalid', 'true');
    expect(h.request).not.toHaveBeenCalled();
  });

  it('shows server validation errors on the fields they belong to', async () => {
    h.request.mockResolvedValue({
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'Please correct the highlighted fields.',
      correlationId: 'c1',
      fieldErrors: {
        title: ['Give the document a title.'],
        documentType: ['Choose a document type.'],
      },
    });
    render(<DocumentUpload periods={[]} />);
    chooseFile();
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    expect(await screen.findByText('Give the document a title.')).toBeTruthy();
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Choose a document type.')).toBeTruthy();
    // The generic banner is not shown when the fields carry the detail.
    expect(screen.queryByText('Please correct the highlighted fields.')).toBeNull();
  });

  it('reports success only after the upload is confirmed, without claiming to read the file', async () => {
    h.request.mockResolvedValue({
      ok: true,
      data: { documentId: 'd1', bucket: 'business-documents', path: 'p', token: 't' },
    });
    h.upload.mockResolvedValue({ error: null });
    h.finalize.mockResolvedValue({ ok: true, data: { saved: true } });

    render(<DocumentUpload periods={[]} />);
    chooseFile();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'March receipts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => expect(h.finalize).toHaveBeenCalled());
    expect(await screen.findByText(/“March receipts” is stored privately/)).toBeTruthy();
    expect(screen.getByText(/does not read what is in it/)).toBeTruthy();
    expect(h.refresh).toHaveBeenCalled();
  });

  it('says plainly when the storage upload fails, and claims nothing was saved', async () => {
    h.request.mockResolvedValue({
      ok: true,
      data: { documentId: 'd1', bucket: 'business-documents', path: 'p', token: 't' },
    });
    h.upload.mockResolvedValue({ error: { message: 'too large' } });

    render(<DocumentUpload periods={[]} />);
    chooseFile();
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    expect(await screen.findByText(/could not be uploaded securely/)).toBeTruthy();
    expect(h.finalize).not.toHaveBeenCalled();
    expect(screen.queryByText(/stored privately/)).toBeNull();
  });
});

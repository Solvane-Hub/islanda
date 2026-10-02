import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/business-cases', () => ({
  insertBusinessCase: vi.fn(),
  listBusinessCases: vi.fn(),
  findBusinessCaseById: vi.fn(),
  updateBusinessCase: vi.fn(),
}));
vi.mock('@/services/audit', () => ({ recordAuditEvent: vi.fn() }));

import {
  insertBusinessCase,
  findBusinessCaseById,
  updateBusinessCase,
} from '@/lib/db/business-cases';
import { recordAuditEvent } from '@/services/audit';
import { createBusinessCase, setCaseStatus } from '@/services/cases';

const db = {} as never;
const audit = vi.mocked(recordAuditEvent);

beforeEach(() => vi.clearAllMocks());

describe('createBusinessCase', () => {
  it('creates a case owned by the caller, defaulting to no advisor', async () => {
    vi.mocked(insertBusinessCase).mockResolvedValue({
      data: { id: 'case-1' } as never,
      error: null,
    });

    await createBusinessCase(db, 'owner-1', {
      businessId: 'biz-1',
      title: 'Confidential title',
      objective: 'Confidential objective text',
    });

    expect(insertBusinessCase).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        business_id: 'biz-1',
        owner_id: 'owner-1',
        advisor_id: null,
        title: 'Confidential title',
        objective: 'Confidential objective text',
      }),
    );
  });

  it('never audits the title or objective text — shape only', async () => {
    vi.mocked(insertBusinessCase).mockResolvedValue({
      data: { id: 'case-1' } as never,
      error: null,
    });

    await createBusinessCase(db, 'owner-1', {
      businessId: 'biz-1',
      title: 'Secret strategic title',
      objective: 'Secret strategic objective',
      advisorId: 'advisor-1',
    });

    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.case_created');
    expect(call).toBeTruthy();
    const metadata = JSON.stringify(call?.[0]?.metadata ?? {});
    expect(metadata).not.toContain('Secret');
    expect(call?.[0]?.metadata).toEqual({ has_advisor: true });
  });

  it('surfaces an insert failure without leaking the objective in the developer message', async () => {
    vi.mocked(insertBusinessCase).mockResolvedValue({ data: null, error: 'db exploded' });
    await expect(
      createBusinessCase(db, 'owner-1', { businessId: 'biz-1', title: 't', objective: 'o' }),
    ).rejects.toMatchObject({ code: 'UNEXPECTED' });
  });
});

describe('setCaseStatus', () => {
  it('updates status and audits the status value only', async () => {
    vi.mocked(findBusinessCaseById).mockResolvedValue({
      id: 'case-1',
      business_id: 'biz-1',
    } as never);
    vi.mocked(updateBusinessCase).mockResolvedValue({
      data: { id: 'case-1', status: 'in_review' } as never,
      error: null,
    });

    await setCaseStatus(db, 'owner-1', 'case-1', 'in_review');

    expect(updateBusinessCase).toHaveBeenCalledWith(db, 'case-1', { status: 'in_review' });
    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.case_status_changed');
    expect(call?.[0]?.metadata).toEqual({ status: 'in_review' });
    expect(call?.[0]?.businessId).toBe('biz-1');
  });

  it('treats a case RLS filtered out as not found — no existence oracle', async () => {
    vi.mocked(findBusinessCaseById).mockResolvedValue(null);
    await expect(setCaseStatus(db, 'owner-1', 'case-x', 'resolved')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { upsertBusinessRegulatoryRequirement } from '@/lib/db/regulatory';

describe('regulatory repository', () => {
  it('upserts the derived business regulatory state', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'state-1',
        business_id: 'business-1',
        requirement_id: 'requirement-1',
        state: 'applicable',
        reason: 'All applicability rules were satisfied.',
        missing_information: [],
        required_documents: [],
        started_at: null,
        submitted_at: null,
        approved_at: null,
        active_at: null,
        renewal_due_at: null,
        expired_at: null,
        last_evaluated_at: '2026-08-14T12:00:00.000Z',
        created_at: '2026-08-14T12:00:00.000Z',
        updated_at: '2026-08-14T12:00:00.000Z',
      },
      error: null,
    });

    const select = vi.fn(() => ({
      single,
    }));

    const upsert = vi.fn(() => ({
      select,
    }));

    const from = vi.fn(() => ({
      upsert,
    }));

    const db = { from } as never;

    const result = await upsertBusinessRegulatoryRequirement(db, {
      business_id: 'business-1',
      requirement_id: 'requirement-1',
      state: 'applicable',
      reason: 'All applicability rules were satisfied.',
      missing_information: [],
      last_evaluated_at: '2026-08-14T12:00:00.000Z',
    });

    expect(from).toHaveBeenCalledWith('business_regulatory_requirements');

    expect(upsert).toHaveBeenCalledWith(
      {
        business_id: 'business-1',
        requirement_id: 'requirement-1',
        state: 'applicable',
        reason: 'All applicability rules were satisfied.',
        missing_information: [],
        last_evaluated_at: '2026-08-14T12:00:00.000Z',
      },
      {
        onConflict: 'business_id,requirement_id',
      },
    );

    expect(result.error).toBeNull();
    expect(result.data?.state).toBe('applicable');
  });

  it('returns the database error without hiding it', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'database write failed',
      },
    });

    const select = vi.fn(() => ({
      single,
    }));

    const upsert = vi.fn(() => ({
      select,
    }));

    const from = vi.fn(() => ({
      upsert,
    }));

    const db = { from } as never;

    const result = await upsertBusinessRegulatoryRequirement(db, {
      business_id: 'business-1',
      requirement_id: 'requirement-1',
      state: 'needs_information',
      reason: 'Additional business information is required.',
      missing_information: ['business.industry'],
      last_evaluated_at: '2026-08-14T12:00:00.000Z',
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe('database write failed');
  });

  it('persists missing information as an array', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'state-1',
        business_id: 'business-1',
        requirement_id: 'requirement-1',
        state: 'needs_information',
        reason: 'More information is required.',
        missing_information: ['business.industry', 'profile.employee_count'],
        required_documents: [],
        started_at: null,
        submitted_at: null,
        approved_at: null,
        active_at: null,
        renewal_due_at: null,
        expired_at: null,
        last_evaluated_at: '2026-08-14T12:00:00.000Z',
        created_at: '2026-08-14T12:00:00.000Z',
        updated_at: '2026-08-14T12:00:00.000Z',
      },
      error: null,
    });

    const select = vi.fn(() => ({
      single,
    }));

    const upsert = vi.fn(() => ({
      select,
    }));

    const from = vi.fn(() => ({
      upsert,
    }));

    const db = { from } as never;

    await upsertBusinessRegulatoryRequirement(db, {
      business_id: 'business-1',
      requirement_id: 'requirement-1',
      state: 'needs_information',
      reason: 'More information is required.',
      missing_information: ['business.industry', 'profile.employee_count'],
      last_evaluated_at: '2026-08-14T12:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        missing_information: ['business.industry', 'profile.employee_count'],
      }),
      expect.any(Object),
    );
  });
});

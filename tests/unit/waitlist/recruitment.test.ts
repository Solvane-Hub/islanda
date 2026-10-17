import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  hasWaitlistAdminRole: vi.fn(),
  listWaitlistEntries: vi.fn(),
  updateRecruitmentFields: vi.fn(),
  recordAuditEvent: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/db/waitlist', () => ({
  hasWaitlistAdminRole: mocks.hasWaitlistAdminRole,
  listWaitlistEntries: mocks.listWaitlistEntries,
  updateRecruitmentFields: mocks.updateRecruitmentFields,
}));
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/services/auth', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }));

import {
  getWaitlistAdminAccess,
  listWaitlist,
  sanitiseSearchTerm,
  signInWaitlistAdmin,
  updateRecruitment,
} from '@/services/waitlist/recruitment';
import { waitlistFiltersSchema } from '@/lib/validation/waitlist';

const SIGNUP_ID = '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11';

function dbWithUser(user: { id: string } | null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listWaitlistEntries.mockResolvedValue({ rows: [], total: 0 });
});

describe('getWaitlistAdminAccess', () => {
  it('signed out without a session', async () => {
    expect(await getWaitlistAdminAccess(dbWithUser(null))).toEqual({ kind: 'signed_out' });
    expect(mocks.hasWaitlistAdminRole).not.toHaveBeenCalled();
  });

  it('a signed-in user without the role is not an admin', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(false);
    expect(await getWaitlistAdminAccess(dbWithUser({ id: 'u1' }))).toEqual({ kind: 'not_admin' });
  });

  it('a signed-in user with the role is an admin', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(true);
    expect(await getWaitlistAdminAccess(dbWithUser({ id: 'u1' }))).toEqual({
      kind: 'admin',
      userId: 'u1',
    });
  });

  it('fails closed when the role cannot be checked', async () => {
    mocks.hasWaitlistAdminRole.mockRejectedValue(new Error('db down'));
    expect(await getWaitlistAdminAccess(dbWithUser({ id: 'u1' }))).toEqual({ kind: 'not_admin' });
  });
});

describe('signInWaitlistAdmin', () => {
  it('admits a waitlist_admin', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    mocks.hasWaitlistAdminRole.mockResolvedValue(true);
    await expect(
      signInWaitlistAdmin(dbWithUser({ id: 'u1' }), { email: 'a@b.co', password: 'x' }),
    ).resolves.toBeUndefined();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('signs a non-staff account straight back out', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    mocks.hasWaitlistAdminRole.mockResolvedValue(false);
    await expect(
      signInWaitlistAdmin(dbWithUser({ id: 'u1' }), { email: 'a@b.co', password: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('gives wrong credentials the same message as a non-staff account', async () => {
    mocks.signIn.mockRejectedValue(
      new AppError({ code: 'AUTH_INVALID_CREDENTIALS', humanMessage: 'Wrong' }),
    );
    const wrong = await signInWaitlistAdmin(dbWithUser(null), {
      email: 'a@b.co',
      password: 'x',
    }).catch((e: AppError) => e.humanMessage);

    mocks.signIn.mockResolvedValue(undefined);
    mocks.hasWaitlistAdminRole.mockResolvedValue(false);
    const notStaff = await signInWaitlistAdmin(dbWithUser({ id: 'u1' }), {
      email: 'a@b.co',
      password: 'x',
    }).catch((e: AppError) => e.humanMessage);

    expect(wrong).toBe(notStaff);
  });
});

describe('listWaitlist', () => {
  it('passes every filter to the database query and pages there', async () => {
    const filters = waitlistFiltersSchema.parse({
      q: 'Ada  lovelace',
      country: 'Bahamas',
      cityIsland: 'Grand Bahama',
      businessStage: 'trying_to_register',
      biggestChallenge: 'other',
      testingInterest: 'yes',
      recruitmentStatus: 'not_contacted',
      completed: 'yes',
      from: '2026-10-01',
      to: '2026-10-17',
      page: '3',
    });
    mocks.listWaitlistEntries.mockResolvedValue({ rows: [], total: 120 });

    const result = await listWaitlist({} as never, filters);

    expect(mocks.listWaitlistEntries.mock.calls[0]![1]).toEqual({
      searchTerms: ['Ada', 'lovelace'],
      country: 'Bahamas',
      cityIsland: 'Grand Bahama',
      businessStage: 'trying_to_register',
      biggestChallenge: 'other',
      testingInterest: 'yes',
      recruitmentStatus: 'not_contacted',
      completed: true,
      createdFrom: '2026-10-01T00:00:00.000Z',
      createdBefore: '2026-10-18T00:00:00.000Z',
      offset: 100,
      limit: 50,
    });
    expect(result).toMatchObject({ total: 120, page: 3, pageCount: 3 });
  });

  it('"not answered" filters on a missing completion timestamp', async () => {
    await listWaitlist({} as never, waitlistFiltersSchema.parse({ completed: 'no' }));
    expect(mocks.listWaitlistEntries.mock.calls[0]![1].completed).toBe(false);
  });

  it('maps rows for display without leaking anything not selected', async () => {
    mocks.listWaitlistEntries.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: SIGNUP_ID,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: null,
          created_at: '2026-10-10T12:00:00Z',
          survey_country: 'The Bahamas',
          survey_city_island: 'Exuma',
          business_stage: 'already_operating',
          biggest_challenge: 'finding_customers',
          challenge_other: null,
          testing_interest: 'yes',
          survey_completed_at: '2026-10-10T12:01:00Z',
          recruitment_status: 'not_contacted',
          recruitment_notes: null,
          recruitment_updated_at: null,
        },
      ],
    });
    const page = await listWaitlist({} as never, waitlistFiltersSchema.parse({}));
    expect(page.entries[0]).toMatchObject({
      name: 'Ada Lovelace',
      country: 'The Bahamas',
      testingInterest: 'yes',
      recruitmentStatus: 'not_contacted',
    });
  });
});

describe('sanitiseSearchTerm', () => {
  it('removes PostgREST filter syntax so a search cannot become a filter', () => {
    expect(sanitiseSearchTerm('a,email.eq.x)')).toBe('aemail.eq.x');
    expect(sanitiseSearchTerm('*%(),"\\')).toBe('');
    expect(sanitiseSearchTerm("O'Brien-Smith")).toBe("O'Brien-Smith");
    expect(sanitiseSearchTerm('ada+test@example.com')).toBe('ada+test@example.com');
  });
});

describe('updateRecruitment', () => {
  const input = {
    signupId: SIGNUP_ID,
    recruitmentStatus: 'contacted' as const,
    recruitmentNotes: 'Called on Tuesday; prefers WhatsApp.',
  };

  it('is refused for a non-admin before any write', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(false);
    await expect(updateRecruitment(dbWithUser({ id: 'u1' }), input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(updateRecruitment(dbWithUser(null), input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.updateRecruitmentFields).not.toHaveBeenCalled();
  });

  it('updates status and notes for an admin and audits without personal data', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(true);
    mocks.updateRecruitmentFields.mockResolvedValue({
      recruitment_status: 'contacted',
      recruitment_updated_at: '2026-10-17T10:00:00Z',
    });

    const result = await updateRecruitment(dbWithUser({ id: 'admin-1' }), input);

    expect(result).toEqual({
      recruitmentStatus: 'contacted',
      recruitmentUpdatedAt: '2026-10-17T10:00:00Z',
    });
    expect(mocks.updateRecruitmentFields).toHaveBeenCalledWith(expect.anything(), SIGNUP_ID, {
      recruitmentStatus: 'contacted',
      recruitmentNotes: input.recruitmentNotes,
    });
    const audit = mocks.recordAuditEvent.mock.calls[0]![0];
    expect(audit).toMatchObject({
      event: 'waitlist.recruitment_updated',
      actorId: 'admin-1',
      metadata: { signupId: SIGNUP_ID, recruitmentStatus: 'contacted', hasNotes: true },
    });
    expect(JSON.stringify(audit)).not.toContain('WhatsApp');
  });

  it('clearing notes stores null', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(true);
    mocks.updateRecruitmentFields.mockResolvedValue({
      recruitment_status: 'tested',
      recruitment_updated_at: null,
    });
    await updateRecruitment(dbWithUser({ id: 'admin-1' }), {
      signupId: SIGNUP_ID,
      recruitmentStatus: 'tested',
    });
    expect(mocks.updateRecruitmentFields.mock.calls[0]![2].recruitmentNotes).toBeNull();
  });

  it('reports a row RLS did not let us update as not found', async () => {
    mocks.hasWaitlistAdminRole.mockResolvedValue(true);
    mocks.updateRecruitmentFields.mockResolvedValue(null);
    await expect(updateRecruitment(dbWithUser({ id: 'admin-1' }), input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});

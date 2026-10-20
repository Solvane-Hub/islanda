import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import type * as WaitlistDb from '@/lib/db/waitlist';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listWaitlistEntries: vi.fn(),
  getWaitlistEntry: vi.fn(),
  updateRecruitmentFields: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('@/lib/db/waitlist', async (importOriginal) => {
  const real = await importOriginal<typeof WaitlistDb>();
  return {
    isTestEmail: real.isTestEmail,
    isTestSignup: real.isTestSignup,
    goalsOf: real.goalsOf,
    challengesOf: real.challengesOf,
    listWaitlistEntries: mocks.listWaitlistEntries,
    getWaitlistEntry: mocks.getWaitlistEntry,
    updateRecruitmentFields: mocks.updateRecruitmentFields,
  };
});
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/services/admin/access', () => ({ requireAdmin: mocks.requireAdmin }));

import {
  getWaitlistDetail,
  listWaitlist,
  sanitiseSearchTerm,
  updateRecruitment,
} from '@/services/waitlist/recruitment';
import { waitlistFiltersSchema } from '@/lib/validation/waitlist';

const SIGNUP_ID = '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11';
const ADMIN = { userId: 'admin-1', email: 'jamilnash@solvanehub.us', displayName: 'Jamil Nash' };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: SIGNUP_ID,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@gmail.com',
    phone: null,
    business_name: 'Ada Catering',
    created_at: '2026-10-10T12:00:00Z',
    survey_country: 'The Bahamas',
    survey_city_island: 'Exuma',
    business_journey: 'preparing_to_register',
    industry: 'food_restaurants_catering',
    industry_other: null,
    primary_goal: 'licences_permits_approvals',
    primary_goals: ['licences_permits_approvals', 'funding_investment'],
    goal_other: null,
    business_stage: 'trying_to_register',
    biggest_challenge: 'finding_customers',
    challenges: ['finding_customers'],
    challenge_other: null,
    source: 'landing_page',
    testing_interest: 'yes',
    feedback_interest: 'maybe',
    additional_info: null,
    survey_started_at: '2026-10-10T12:00:30Z',
    survey_completed_at: '2026-10-10T12:01:00Z',
    survey_updated_at: '2026-10-10T12:01:00Z',
    recruitment_status: 'not_contacted',
    recruitment_notes: null,
    recruitment_updated_at: null,
    recruitment_contacted_on: null,
    recruitment_confirmed_on: null,
    recruitment_tested_on: null,
    feedback_summary: null,
    feedback_link: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listWaitlistEntries.mockResolvedValue({ rows: [], total: 0 });
  mocks.requireAdmin.mockResolvedValue(ADMIN);
});

describe('listWaitlist', () => {
  it('passes every filter to the database query and pages there', async () => {
    const filters = waitlistFiltersSchema.parse({
      q: 'Ada  lovelace',
      country: 'Bahamas',
      cityIsland: 'Grand Bahama',
      businessStage: 'trying_to_register',
      businessJourney: 'preparing_to_register',
      industry: 'technology_software',
      primaryGoal: 'clear_plan',
      biggestChallenge: 'other',
      testingInterest: 'yes',
      feedbackInterest: 'maybe',
      recruitmentStatus: 'not_contacted',
      completed: 'yes',
      pool: 'early_access',
      sort: 'oldest',
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
      businessJourney: 'preparing_to_register',
      industry: 'technology_software',
      primaryGoal: 'clear_plan',
      biggestChallenge: 'other',
      testingInterest: 'yes',
      feedbackInterest: 'maybe',
      recruitmentStatus: 'not_contacted',
      completed: true,
      pool: 'early_access',
      includeTests: false,
      createdFrom: '2026-10-01T00:00:00.000Z',
      createdBefore: '2026-10-18T00:00:00.000Z',
      sort: 'oldest',
      offset: 100,
      limit: 50,
    });
    expect(result).toMatchObject({ total: 120, page: 3, pageCount: 3 });
  });

  it('hides automated test records unless asked', async () => {
    await listWaitlist({} as never, waitlistFiltersSchema.parse({}));
    expect(mocks.listWaitlistEntries.mock.calls[0]![1].includeTests).toBe(false);
    await listWaitlist({} as never, waitlistFiltersSchema.parse({ tests: 'show' }));
    expect(mocks.listWaitlistEntries.mock.calls[1]![1].includeTests).toBe(true);
  });

  it('"not completed" filters on a missing completion timestamp', async () => {
    await listWaitlist({} as never, waitlistFiltersSchema.parse({ completed: 'no' }));
    expect(mocks.listWaitlistEntries.mock.calls[0]![1].completed).toBe(false);
  });

  it('maps rows for display, labelling test records', async () => {
    mocks.listWaitlistEntries.mockResolvedValue({
      total: 2,
      rows: [row(), row({ id: 'x', email: 'rlstest-1@example.dev' })],
    });
    const page = await listWaitlist({} as never, waitlistFiltersSchema.parse({ tests: 'show' }));
    expect(page.entries[0]).toMatchObject({
      name: 'Ada Lovelace',
      businessName: 'Ada Catering',
      industry: 'food_restaurants_catering',
      feedbackInterest: 'maybe',
      isTest: false,
    });
    expect(page.entries[1]!.isTest).toBe(true);
  });

  it('returns every selected goal and challenge', async () => {
    mocks.listWaitlistEntries.mockResolvedValue({ total: 1, rows: [row()] });
    const page = await listWaitlist({} as never, waitlistFiltersSchema.parse({}));
    expect(page.entries[0]).toMatchObject({
      primaryGoals: ['licences_permits_approvals', 'funding_investment'],
      challenges: ['finding_customers'],
    });
  });

  it('reads an answer saved before multi-select as a one-item list', async () => {
    mocks.listWaitlistEntries.mockResolvedValue({
      total: 1,
      rows: [row({ primary_goals: null, challenges: null })],
    });
    const page = await listWaitlist({} as never, waitlistFiltersSchema.parse({}));
    expect(page.entries[0]).toMatchObject({
      primaryGoals: ['licences_permits_approvals'],
      challenges: ['finding_customers'],
    });
    mocks.listWaitlistEntries.mockResolvedValue({
      total: 1,
      rows: [
        row({ primary_goals: null, primary_goal: null, challenges: null, biggest_challenge: null }),
      ],
    });
    const blank = await listWaitlist({} as never, waitlistFiltersSchema.parse({}));
    expect(blank.entries[0]).toMatchObject({ primaryGoals: [], challenges: [] });
  });

  it('labels signups created by automated tests or non-production deployments', async () => {
    mocks.listWaitlistEntries.mockResolvedValue({
      total: 3,
      rows: [
        row({ id: 'a', source: 'rls_test' }),
        row({ id: 'b', source: 'preview' }),
        row({ id: 'c', source: 'landing_page' }),
      ],
    });
    const page = await listWaitlist({} as never, waitlistFiltersSchema.parse({ tests: 'show' }));
    expect(page.entries.map((e) => e.isTest)).toEqual([true, true, false]);
  });
});

describe('getWaitlistDetail', () => {
  it('returns null for a row RLS did not return', async () => {
    mocks.getWaitlistEntry.mockResolvedValue(null);
    expect(await getWaitlistDetail({} as never, SIGNUP_ID)).toBeNull();
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

  it('is refused for anyone who is not a fully authorized administrator, before any write', async () => {
    mocks.requireAdmin.mockRejectedValue(new AppError({ code: 'FORBIDDEN', humanMessage: 'No.' }));
    await expect(updateRecruitment({} as never, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.updateRecruitmentFields).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('updates status and notes and audits without personal data', async () => {
    mocks.updateRecruitmentFields.mockResolvedValue({
      recruitment_status: 'contacted',
      recruitment_updated_at: '2026-10-17T10:00:00Z',
    });

    const result = await updateRecruitment({} as never, input);

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

  it('writes recruitment dates and feedback only when the full editor sent them', async () => {
    mocks.updateRecruitmentFields.mockResolvedValue({
      recruitment_status: 'tested',
      recruitment_updated_at: '2026-11-02T10:00:00Z',
    });
    await updateRecruitment({} as never, {
      signupId: SIGNUP_ID,
      recruitmentStatus: 'tested',
      testedOn: '2026-11-02',
      feedbackSummary: 'Liked the citations; wants WhatsApp reminders.',
      feedbackLink: null,
    });
    expect(mocks.updateRecruitmentFields.mock.calls[0]![2]).toEqual({
      recruitmentStatus: 'tested',
      recruitmentNotes: null,
      testedOn: '2026-11-02',
      feedbackSummary: 'Liked the citations; wants WhatsApp reminders.',
      feedbackLink: null,
    });
    const audit = mocks.recordAuditEvent.mock.calls[0]![0];
    expect(audit.metadata).toMatchObject({ datesChanged: ['testedOn'], hasFeedback: true });
    expect(JSON.stringify(audit)).not.toContain('citations');
  });

  it('reports a row RLS did not let us update as not found', async () => {
    mocks.updateRecruitmentFields.mockResolvedValue(null);
    await expect(updateRecruitment({} as never, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});

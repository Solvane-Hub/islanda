import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { parseDateRange } from '@/lib/admin/date-range';
import { waitlistFiltersSchema } from '@/lib/validation/waitlist';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listWaitlist: vi.fn(),
  recordAuditEvent: vi.fn(),
  webAnalytics: vi.fn(),
}));
vi.mock('@/services/admin/access', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/services/waitlist/recruitment', () => ({ listWaitlist: mocks.listWaitlist }));
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/services/admin/reports', () => ({
  webAnalytics: mocks.webAnalytics,
  waitlistInsights: vi.fn(),
  productUsage: vi.fn(),
  userList: vi.fn(),
}));

import { buildExport } from '@/services/admin/exports';

const range = parseDateRange({ range: '30d' }, new Date('2026-10-19T12:00:00Z'));
const ADMIN = { userId: 'admin-1', email: 'jamilnash@solvanehub.us', displayName: 'Jamil Nash' };

function entry(extra: Record<string, unknown> = {}) {
  return {
    id: '1',
    name: '=HYPERLINK("http://evil")',
    email: 'ada@gmail.com',
    phone: '+1 242 555 0123',
    businessName: 'Ada Catering',
    isTest: false,
    signedUpAt: '2026-10-10T12:00:00Z',
    country: 'The Bahamas',
    cityIsland: 'Exuma',
    businessJourney: 'preparing_to_register',
    industry: 'food_restaurants_catering',
    industryOther: null,
    primaryGoals: ['licences_permits_approvals', 'funding_investment'],
    goalOther: null,
    businessStage: null,
    challenges: ['finding_customers'],
    challengeOther: null,
    testingInterest: 'yes',
    feedbackInterest: 'maybe',
    additionalInfo: 'secret-ish free text',
    surveyStartedAt: null,
    surveyCompletedAt: null,
    surveyUpdatedAt: null,
    recruitmentStatus: 'contacted',
    recruitmentNotes: 'INTERNAL NOTE — never exported',
    recruitmentUpdatedAt: null,
    contactedOn: '2026-10-12',
    confirmedOn: null,
    testedOn: null,
    feedbackSummary: null,
    feedbackLink: null,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(ADMIN);
  mocks.listWaitlist.mockResolvedValue({
    entries: [entry()],
    total: 1,
    page: 1,
    pageCount: 1,
    pageSize: 500,
  });
});

describe('buildExport', () => {
  it('refuses anyone who is not an administrator, and writes no audit row', async () => {
    mocks.requireAdmin.mockRejectedValue(new AppError({ code: 'FORBIDDEN', humanMessage: 'No.' }));
    await expect(
      buildExport({} as never, {
        report: 'waitlist',
        range,
        waitlistFilters: waitlistFiltersSchema.parse({}),
        includeContact: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('leaves out contact details unless asked, never exports internal notes, neutralises formulas', async () => {
    const file = await buildExport({} as never, {
      report: 'waitlist',
      range,
      waitlistFilters: waitlistFiltersSchema.parse({ country: 'Bahamas' }),
      includeContact: false,
    });
    expect(file.body).not.toContain('ada@gmail.com');
    expect(file.body).not.toContain('555 0123');
    expect(file.body).not.toContain('INTERNAL NOTE');
    expect(file.body).toContain('Filters: country=Bahamas');
    expect(file.filename).toMatch(/^islanda-waitlist-\d{8}-\d{4}Z\.csv$/);

    const withContact = await buildExport({} as never, {
      report: 'waitlist',
      range,
      waitlistFilters: waitlistFiltersSchema.parse({}),
      includeContact: true,
    });
    expect(withContact.body).toContain('ada@gmail.com');
    expect(withContact.body).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(withContact.body).not.toContain('INTERNAL NOTE');
    // Multi-select answers export every selection in one cell, labelled as such.
    expect(withContact.body).toContain('Wants help with (all selected)');
    expect(withContact.body).toContain('Challenges (all selected)');
    expect(withContact.body).toMatch(
      /licences, permits, or approvals I may need; Prepare my business for funding/,
    );
  });

  it('audits every export with its shape — not its content', async () => {
    await buildExport({} as never, {
      report: 'recruitment',
      range,
      waitlistFilters: waitlistFiltersSchema.parse({}),
      includeContact: false,
    });
    const audit = mocks.recordAuditEvent.mock.calls[0]![0];
    expect(audit).toMatchObject({
      event: 'admin.export',
      actorId: 'admin-1',
      metadata: { report: 'recruitment', rows: 1, includeContact: true },
    });
    expect(JSON.stringify(audit)).not.toContain('ada@gmail.com');
    // The recruitment list is the early-access pool by default.
    expect(mocks.listWaitlist.mock.calls[0]![1].pool).toBe('early_access');
  });

  it('states the analytics coverage boundary in traffic exports', async () => {
    mocks.webAnalytics.mockResolvedValue({ tracking_started_at: null, daily: [] });
    const file = await buildExport({} as never, {
      report: 'traffic-daily',
      range,
      waitlistFilters: waitlistFiltersSchema.parse({}),
      includeContact: false,
    });
    expect(file.body).toContain('No website analytics have been collected yet.');
  });
});

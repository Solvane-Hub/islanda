import { render, screen, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

/**
 * The owner-only admin portal, from the outside: page access for every
 * access state, the actions behind it, and the proxy carve-out that keeps it
 * reachable while WAITLIST_ONLY_MODE closes the founder product.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAdminAccess: vi.fn(),
  recordAdminPageDenied: vi.fn(),
  listWaitlist: vi.fn(),
  signInPlatformAdmin: vi.fn(),
  signOutPlatformAdmin: vi.fn(),
  updateRecruitment: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  revalidatePath: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ serverEnv: { WAITLIST_ONLY_MODE: true } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  usePathname: () => '/admin/waitlist',
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/services/admin/access', () => ({
  getAdminAccess: mocks.getAdminAccess,
  recordAdminPageDenied: mocks.recordAdminPageDenied,
}));
vi.mock('@/services/admin/auth', () => ({
  signInPlatformAdmin: mocks.signInPlatformAdmin,
  signOutPlatformAdmin: mocks.signOutPlatformAdmin,
  startMfaEnrollment: vi.fn(),
  verifyMfaCode: vi.fn(),
  changeAdminPassword: vi.fn(),
  requestAdminPasswordReset: vi.fn(),
  completeAdminPasswordReset: vi.fn(),
}));
vi.mock('@/services/waitlist/recruitment', () => ({
  listWaitlist: mocks.listWaitlist,
  updateRecruitment: mocks.updateRecruitment,
}));

import WaitlistAdminPage from '@/app/admin/(portal)/waitlist/page';
import { staffSignInAction, updateRecruitmentAction } from '@/app/admin/actions';
import { updateSession } from '@/lib/supabase/proxy-session';

const SIGNUP_ID = '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11';
const ADMIN = {
  kind: 'admin',
  userId: 'admin-1',
  email: 'jamilnash@solvanehub.us',
  displayName: 'Jamil Nash',
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: SIGNUP_ID,
    name: 'Ada Lovelace',
    email: 'ada@gmail.com',
    phone: '(242) 555-0123',
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
    businessStage: 'trying_to_register',
    challenges: ['marketing', 'other'],
    challengeOther: 'Finding a shop',
    testingInterest: 'yes',
    feedbackInterest: 'maybe',
    additionalInfo: null,
    surveyStartedAt: '2026-10-10T12:00:30Z',
    surveyCompletedAt: '2026-10-10T12:01:00Z',
    surveyUpdatedAt: null,
    recruitmentStatus: 'not_contacted',
    recruitmentNotes: null,
    recruitmentUpdatedAt: null,
    contactedOn: null,
    confirmedOn: null,
    testedOn: null,
    feedbackSummary: null,
    feedbackLink: null,
    ...overrides,
  };
}

const emptyPage = { entries: [], total: 0, page: 1, pageCount: 1, pageSize: 50 };

async function renderPage(params: Record<string, string> = {}) {
  const ui = await WaitlistAdminPage({ searchParams: Promise.resolve(params) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({});
});

describe('admin page access', () => {
  it('sends a signed-out visitor to the admin sign-in', async () => {
    mocks.getAdminAccess.mockResolvedValue({ kind: 'signed_out' });
    await expect(renderPage()).rejects.toThrow('REDIRECT:/admin/login?next=%2Fadmin%2Fwaitlist');
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
  });

  it('a signed-in founder gets a 404, the attempt is audited, and no data is read', async () => {
    mocks.getAdminAccess.mockResolvedValue({ kind: 'denied', userId: 'founder-1' });
    await expect(renderPage()).rejects.toThrow('NOT_FOUND');
    expect(mocks.recordAdminPageDenied).toHaveBeenCalledWith('founder-1', '/admin/waitlist');
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
  });

  it('an administrator who has not completed MFA is sent to verify, with no data read', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'mfa_verify', factorId: 'f-1' });
    await expect(renderPage()).rejects.toThrow('REDIRECT:/admin/mfa?next=%2Fadmin%2Fwaitlist');
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
  });

  it('a temporary password must be changed before anything else', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'password_change' });
    await expect(renderPage()).rejects.toThrow('REDIRECT:/admin/account/password');
  });
});

describe('waitlist table', () => {
  beforeEach(() => mocks.getAdminAccess.mockResolvedValue(ADMIN));

  it('shows the agreed columns and the row data', async () => {
    mocks.listWaitlist.mockResolvedValue({ ...emptyPage, entries: [entry()], total: 1 });
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Name',
      'Email',
      'Phone',
      'Business',
      'Country',
      'City / island',
      'Journey',
      'Industry',
      'Wants help with',
      'Challenges',
      'Early access',
      'Feedback',
      'Recruitment',
      'Signed up',
      'Questionnaire',
    ]);

    const row = screen.getByRole('row', { name: /Ada Lovelace/ });
    expect(within(row).getByText('ada@gmail.com')).toBeTruthy();
    expect(within(row).getByText('Food, Restaurants & Catering')).toBeTruthy();
    expect(within(row).getByText(/Finding a shop/)).toBeTruthy();
    // Every selection of a multi-select answer is shown, not just the first.
    expect(within(row).getByText('Marketing my business')).toBeTruthy();
    expect(within(row).getByText('Other')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      `/admin/waitlist/${SIGNUP_ID}`,
    );
    expect(within(row).getByLabelText('Recruitment status for Ada Lovelace')).toHaveValue(
      'not_contacted',
    );
  });

  it('labels automated test records', async () => {
    mocks.listWaitlist.mockResolvedValue({
      ...emptyPage,
      entries: [entry({ email: 'rlstest@example.dev', isTest: true })],
      total: 1,
    });
    await renderPage({ tests: 'show' });
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('passes URL filters to the service (server-side filtering)', async () => {
    mocks.listWaitlist.mockResolvedValue(emptyPage);
    await renderPage({
      country: 'Bahamas',
      industry: 'technology_software',
      testingInterest: 'yes',
      recruitmentStatus: 'bogus',
    });

    expect(mocks.listWaitlist.mock.calls[0]![1]).toMatchObject({
      country: 'Bahamas',
      industry: 'technology_software',
      testingInterest: 'yes',
      recruitmentStatus: undefined,
      page: 1,
    });
    expect(screen.getByText('No signups match these filters')).toBeTruthy();
  });

  it('explains an empty waitlist differently from an empty filter', async () => {
    mocks.listWaitlist.mockResolvedValue(emptyPage);
    await renderPage();
    expect(screen.getByText('No one has joined yet')).toBeTruthy();
  });

  it('shows an error instead of crashing when the list cannot load', async () => {
    mocks.listWaitlist.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/);
  });
});

describe('admin actions', () => {
  function update(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return updateRecruitmentAction(null, fd);
  }

  it('updates recruitment through the service and refreshes the views', async () => {
    mocks.updateRecruitment.mockResolvedValue({
      recruitmentStatus: 'confirmed',
      recruitmentUpdatedAt: '2026-10-17T10:00:00Z',
    });
    const result = await update({ signupId: SIGNUP_ID, recruitmentStatus: 'confirmed' });
    expect(result).toMatchObject({ ok: true, data: { recruitmentStatus: 'confirmed' } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/waitlist');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/recruitment');
  });

  it('the quick editor never sends recruitment dates (absent ≠ cleared)', async () => {
    mocks.updateRecruitment.mockResolvedValue({
      recruitmentStatus: 'contacted',
      recruitmentUpdatedAt: null,
    });
    await update({ signupId: SIGNUP_ID, recruitmentStatus: 'contacted' });
    expect(mocks.updateRecruitment.mock.calls[0]![1].testedOn).toBeUndefined();
  });

  it('rejects an unknown status before reaching the service', async () => {
    const result = await update({ signupId: SIGNUP_ID, recruitmentStatus: 'hired' });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(mocks.updateRecruitment).not.toHaveBeenCalled();
  });

  it('surfaces the service refusal for a non-admin', async () => {
    mocks.updateRecruitment.mockRejectedValue(
      new AppError({ code: 'FORBIDDEN', humanMessage: 'No permission.' }),
    );
    const result = await update({ signupId: SIGNUP_ID, recruitmentStatus: 'contacted' });
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN', message: 'No permission.' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('admin sign-in only ever redirects inside the admin area, through MFA', async () => {
    mocks.signInPlatformAdmin.mockResolvedValue({ ...ADMIN, kind: 'mfa_verify', factorId: 'f' });
    const fd = new FormData();
    fd.set('email', 'jamilnash@solvanehub.us');
    fd.set('password', 'secret');

    fd.set('next', 'https://evil.example/admin');
    await expect(staffSignInAction(null, fd)).rejects.toThrow('REDIRECT:/admin/mfa?next=%2Fadmin');

    fd.set('next', '/dashboard');
    await expect(staffSignInAction(null, fd)).rejects.toThrow('REDIRECT:/admin/mfa?next=%2Fadmin');

    mocks.signInPlatformAdmin.mockResolvedValue(ADMIN);
    fd.set('next', '/admin/waitlist?testingInterest=yes');
    await expect(staffSignInAction(null, fd)).rejects.toThrow(
      'REDIRECT:/admin/waitlist?testingInterest=yes',
    );

    mocks.signInPlatformAdmin.mockResolvedValue({ ...ADMIN, kind: 'password_change' });
    await expect(staffSignInAction(null, fd)).rejects.toThrow('REDIRECT:/admin/account/password');
  });

  it('admin sign-in works in WAITLIST_ONLY_MODE but returns the service refusal', async () => {
    mocks.signInPlatformAdmin.mockRejectedValue(
      new AppError({ code: 'FORBIDDEN', humanMessage: 'Not here.' }),
    );
    const fd = new FormData();
    fd.set('email', 'founder@example.com');
    fd.set('password', 'secret');
    expect(await staffSignInAction(null, fd)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mocks.signInPlatformAdmin).toHaveBeenCalledOnce();
  });
});

describe('proxy in WAITLIST_ONLY_MODE', () => {
  beforeEach(() => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
  });

  it.each(['/admin', '/admin/login', '/admin/waitlist', '/admin/mfa', '/admin/exports/waitlist'])(
    'lets %s through and refreshes its session',
    async (path) => {
      const response = await updateSession(new NextRequest(`https://islanda.test${path}`));
      expect(response.status).toBe(200);
      expect(mocks.createServerClient).toHaveBeenCalledOnce();
    },
  );

  it('still closes the founder product and founder sign-in', async () => {
    for (const path of ['/dashboard', '/login', '/signup']) {
      const response = await updateSession(new NextRequest(`https://islanda.test${path}`));
      expect(response.headers.get('location')).toBe('https://islanda.test/?access=waitlist');
    }
  });

  it('does not treat look-alike paths as the admin area', async () => {
    const response = await updateSession(new NextRequest('https://islanda.test/administrator'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});

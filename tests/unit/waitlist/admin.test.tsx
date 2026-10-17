import { render, screen, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

/**
 * The team-only Waitlist & Pilot Recruitment surface: page access, the
 * actions behind it, and the proxy carve-out that keeps it reachable while
 * WAITLIST_ONLY_MODE closes the founder product.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getWaitlistAdminAccess: vi.fn(),
  listWaitlist: vi.fn(),
  signInWaitlistAdmin: vi.fn(),
  updateRecruitment: vi.fn(),
  signOut: vi.fn(),
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
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/services/auth', () => ({ signOut: mocks.signOut }));
vi.mock('@/services/waitlist/recruitment', () => ({
  getWaitlistAdminAccess: mocks.getWaitlistAdminAccess,
  listWaitlist: mocks.listWaitlist,
  signInWaitlistAdmin: mocks.signInWaitlistAdmin,
  updateRecruitment: mocks.updateRecruitment,
}));

import WaitlistAdminPage from '@/app/admin/waitlist/page';
import { staffSignInAction, updateRecruitmentAction } from '@/app/admin/actions';
import { updateSession } from '@/lib/supabase/proxy-session';

const SIGNUP_ID = '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: SIGNUP_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '(242) 555-0123',
    signedUpAt: '2026-10-10T12:00:00Z',
    country: 'The Bahamas',
    cityIsland: 'Exuma',
    businessStage: 'trying_to_register',
    biggestChallenge: 'other',
    challengeOther: 'Finding a shop',
    testingInterest: 'yes',
    surveyCompletedAt: '2026-10-10T12:01:00Z',
    recruitmentStatus: 'not_contacted',
    recruitmentNotes: null,
    recruitmentUpdatedAt: null,
    ...overrides,
  };
}

async function renderPage(params: Record<string, string> = {}) {
  const ui = await WaitlistAdminPage({ searchParams: Promise.resolve(params) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({});
});

describe('admin page access', () => {
  it('sends a signed-out visitor to the staff sign-in', async () => {
    mocks.getWaitlistAdminAccess.mockResolvedValue({ kind: 'signed_out' });
    await expect(renderPage()).rejects.toThrow('REDIRECT:/admin/login?next=/admin/waitlist');
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
  });

  it('a signed-in founder without the role gets a 404 and no data is read', async () => {
    mocks.getWaitlistAdminAccess.mockResolvedValue({ kind: 'not_admin' });
    await expect(renderPage()).rejects.toThrow('NOT_FOUND');
    expect(mocks.listWaitlist).not.toHaveBeenCalled();
  });
});

describe('admin table', () => {
  beforeEach(() => {
    mocks.getWaitlistAdminAccess.mockResolvedValue({ kind: 'admin', userId: 'admin-1' });
  });

  it('shows every agreed column and the row data', async () => {
    mocks.listWaitlist.mockResolvedValue({
      entries: [entry()],
      total: 1,
      page: 1,
      pageCount: 1,
      pageSize: 50,
    });
    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Waitlist & Pilot Recruitment' }),
    ).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Name',
      'Email',
      'Phone',
      'Country',
      'City / island',
      'Business stage',
      'Biggest challenge',
      'Early testing?',
      'Recruitment status',
      'Signed up',
      'Questions answered?',
      'Last recruitment update',
    ]);

    const row = screen.getByRole('row', { name: /Ada Lovelace/ });
    expect(within(row).getByText('ada@example.com')).toBeTruthy();
    expect(within(row).getByText('Trying to register')).toBeTruthy();
    expect(within(row).getByText(/Finding a shop/)).toBeTruthy();
    expect(within(row).getByText('Yes')).toBeTruthy();
    expect(within(row).getByLabelText('Recruitment status for Ada Lovelace')).toHaveValue(
      'not_contacted',
    );
  });

  it('passes URL filters to the service (server-side filtering)', async () => {
    mocks.listWaitlist.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: 50,
    });
    await renderPage({ country: 'Bahamas', testingInterest: 'yes', recruitmentStatus: 'bogus' });

    expect(mocks.listWaitlist.mock.calls[0]![1]).toMatchObject({
      country: 'Bahamas',
      testingInterest: 'yes',
      recruitmentStatus: undefined,
      page: 1,
    });
    expect(screen.getByText('No signups match these filters')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Reset filters' })[0]).toHaveAttribute(
      'href',
      '/admin/waitlist',
    );
  });

  it('explains an empty waitlist differently from an empty filter', async () => {
    mocks.listWaitlist.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: 50,
    });
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

  it('updates recruitment through the service and refreshes the table', async () => {
    mocks.updateRecruitment.mockResolvedValue({
      recruitmentStatus: 'confirmed',
      recruitmentUpdatedAt: '2026-10-17T10:00:00Z',
    });
    const result = await update({ signupId: SIGNUP_ID, recruitmentStatus: 'confirmed' });
    expect(result).toMatchObject({ ok: true, data: { recruitmentStatus: 'confirmed' } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/waitlist');
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

  it('staff sign-in only ever redirects inside the team area', async () => {
    mocks.signInWaitlistAdmin.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.set('email', 'coo@example.com');
    fd.set('password', 'secret');

    fd.set('next', 'https://evil.example/admin');
    await expect(staffSignInAction(null, fd)).rejects.toThrow('REDIRECT:/admin/waitlist');

    fd.set('next', '/dashboard');
    await expect(staffSignInAction(null, fd)).rejects.toThrow('REDIRECT:/admin/waitlist');

    fd.set('next', '/admin/waitlist?testingInterest=yes');
    await expect(staffSignInAction(null, fd)).rejects.toThrow(
      'REDIRECT:/admin/waitlist?testingInterest=yes',
    );
  });

  it('staff sign-in works in WAITLIST_ONLY_MODE but returns the service refusal', async () => {
    mocks.signInWaitlistAdmin.mockRejectedValue(
      new AppError({ code: 'FORBIDDEN', humanMessage: 'Not here.' }),
    );
    const fd = new FormData();
    fd.set('email', 'founder@example.com');
    fd.set('password', 'secret');
    expect(await staffSignInAction(null, fd)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mocks.signInWaitlistAdmin).toHaveBeenCalledOnce();
  });
});

describe('proxy in WAITLIST_ONLY_MODE', () => {
  beforeEach(() => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
  });

  it.each(['/admin', '/admin/login', '/admin/waitlist'])(
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

  it('does not treat look-alike paths as the team area', async () => {
    const response = await updateSession(new NextRequest('https://islanda.test/administrator'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});

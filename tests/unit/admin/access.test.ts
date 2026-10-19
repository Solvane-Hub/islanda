import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The single admin access decision. Postgres enforces the same rules again
 * (proven live in tests/rls/admin.test.ts); this suite pins every branch of
 * the server-side decision, and that it fails closed.
 */

const mocks = vi.hoisted(() => ({
  readAdminAccess: vi.fn(),
  recordAuditEvent: vi.fn(),
}));
vi.mock('@/lib/db/admin', () => ({ readAdminAccess: mocks.readAdminAccess }));
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));

import { getAdminAccess, requireAdmin } from '@/services/admin/access';

const JAMIL = 'jamilnash@solvanehub.us';

function db(opts: {
  user?: Record<string, unknown> | null;
  factors?: { id: string; status: string }[];
  factorsError?: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }),
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue(
            opts.factorsError
              ? { data: null, error: { message: 'x' } }
              : { data: { totp: opts.factors ?? [], all: opts.factors ?? [] }, error: null },
          ),
      },
    },
  } as never;
}

const confirmed = (email: string, extra: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email,
  email_confirmed_at: '2026-10-16T17:57:39Z',
  app_metadata: {},
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readAdminAccess.mockResolvedValue({
    allowlisted: true,
    aal: 'aal2',
    display_name: 'Jamil Nash',
  });
});

describe('getAdminAccess', () => {
  it('no session → signed out', async () => {
    expect(await getAdminAccess(db({ user: null }))).toEqual({ kind: 'signed_out' });
  });

  it('an email that is not on the allowlist is denied without asking the database', async () => {
    const access = await getAdminAccess(db({ user: confirmed('founder@gmail.com') }));
    expect(access).toEqual({ kind: 'denied', userId: 'user-1' });
    expect(mocks.readAdminAccess).not.toHaveBeenCalled();
  });

  it('an allowlisted email with an UNCONFIRMED address is denied', async () => {
    const access = await getAdminAccess(
      db({ user: confirmed(JAMIL, { email_confirmed_at: null }) }),
    );
    expect(access.kind).toBe('denied');
  });

  it('an allowlisted email with no provisioned platform_admins binding is denied', async () => {
    mocks.readAdminAccess.mockResolvedValue({
      allowlisted: false,
      aal: 'aal2',
      display_name: null,
    });
    // e.g. someone who registered the address themselves: email matches, id does not.
    expect((await getAdminAccess(db({ user: confirmed(JAMIL) }))).kind).toBe('denied');
  });

  it('user-editable metadata cannot grant access', async () => {
    const access = await getAdminAccess(
      db({
        user: confirmed('founder@gmail.com', { user_metadata: { is_admin: true, role: 'admin' } }),
      }),
    );
    expect(access.kind).toBe('denied');
  });

  it('a temporary password must be changed first', async () => {
    const access = await getAdminAccess(
      db({ user: confirmed(JAMIL, { app_metadata: { password_change_required: true } }) }),
    );
    expect(access.kind).toBe('password_change');
  });

  it('without MFA on the session: enrol when no authenticator exists', async () => {
    mocks.readAdminAccess.mockResolvedValue({
      allowlisted: true,
      aal: 'aal1',
      display_name: 'Jamil Nash',
    });
    expect((await getAdminAccess(db({ user: confirmed(JAMIL), factors: [] }))).kind).toBe(
      'mfa_enroll',
    );
  });

  it('without MFA on the session: verify when an authenticator exists', async () => {
    mocks.readAdminAccess.mockResolvedValue({
      allowlisted: true,
      aal: 'aal1',
      display_name: 'Jamil Nash',
    });
    const access = await getAdminAccess(
      db({ user: confirmed(JAMIL), factors: [{ id: 'f-1', status: 'verified' }] }),
    );
    expect(access).toMatchObject({ kind: 'mfa_verify', factorId: 'f-1' });
  });

  it('an unverified (abandoned) authenticator still means enrol', async () => {
    mocks.readAdminAccess.mockResolvedValue({ allowlisted: true, aal: 'aal1', display_name: null });
    const access = await getAdminAccess(
      db({ user: confirmed(JAMIL), factors: [{ id: 'f-1', status: 'unverified' }] }),
    );
    expect(access.kind).toBe('mfa_enroll');
  });

  it('provisioned + confirmed + aal2 → admin', async () => {
    expect(await getAdminAccess(db({ user: confirmed(JAMIL) }))).toEqual({
      kind: 'admin',
      userId: 'user-1',
      email: JAMIL,
      displayName: 'Jamil Nash',
    });
  });

  it('works for the second administrator too', async () => {
    const access = await getAdminAccess(db({ user: confirmed('JonathanCash@SolvaneHub.us') }));
    expect(access).toMatchObject({ kind: 'admin', email: 'jonathancash@solvanehub.us' });
  });

  it('fails closed when the database check errors', async () => {
    mocks.readAdminAccess.mockRejectedValue(new Error('db down'));
    expect((await getAdminAccess(db({ user: confirmed(JAMIL) }))).kind).toBe('denied');
  });

  it('fails closed when the MFA factors cannot be listed', async () => {
    mocks.readAdminAccess.mockResolvedValue({ allowlisted: true, aal: 'aal1', display_name: null });
    expect((await getAdminAccess(db({ user: confirmed(JAMIL), factorsError: true }))).kind).toBe(
      'denied',
    );
  });
});

describe('requireAdmin', () => {
  it('returns the administrator', async () => {
    await expect(requireAdmin(db({ user: confirmed(JAMIL) }))).resolves.toMatchObject({
      userId: 'user-1',
    });
  });

  it('throws FORBIDDEN for a founder and audits the attempt', async () => {
    await expect(requireAdmin(db({ user: confirmed('founder@gmail.com') }))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.recordAuditEvent.mock.calls[0]![0]).toMatchObject({
      event: 'admin.access_denied',
      actorId: 'user-1',
    });
  });

  it('throws FORBIDDEN for an administrator who has not completed MFA', async () => {
    mocks.readAdminAccess.mockResolvedValue({ allowlisted: true, aal: 'aal1', display_name: null });
    await expect(
      requireAdmin(db({ user: confirmed(JAMIL), factors: [{ id: 'f', status: 'verified' }] })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws FORBIDDEN when signed out', async () => {
    await expect(requireAdmin(db({ user: null }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

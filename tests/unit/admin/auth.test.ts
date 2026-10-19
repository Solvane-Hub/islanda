import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  getAdminAccess: vi.fn(),
  signIn: vi.fn(),
  requestPasswordReset: vi.fn(),
  recordAuditEvent: vi.fn(),
  probeSignIn: vi.fn(),
  probeSignOut: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock('@/services/admin/access', () => ({ getAdminAccess: mocks.getAdminAccess }));
vi.mock('@/services/auth', () => ({
  signIn: mocks.signIn,
  requestPasswordReset: mocks.requestPasswordReset,
}));
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/lib/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
  serverEnv: {},
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { updateUserById: mocks.updateUserById } } }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mocks.probeSignIn, signOut: mocks.probeSignOut },
  }),
}));

import {
  changeAdminPassword,
  completeAdminPasswordReset,
  requestAdminPasswordReset,
  signInPlatformAdmin,
  verifyMfaCode,
} from '@/services/admin/auth';

const ADMIN = {
  kind: 'admin',
  userId: 'u1',
  email: 'jamilnash@solvanehub.us',
  displayName: 'Jamil',
};

function db(extra: Record<string, unknown> = {}) {
  return {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [] } } }),
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue({ data: { all: [{ id: 'f-1', factor_type: 'totp' }] } }),
        challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
      },
      ...extra,
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue(undefined);
  mocks.probeSignIn.mockResolvedValue({ error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
});

describe('signInPlatformAdmin', () => {
  it('admits an administrator and reports the next step (MFA)', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'mfa_verify', factorId: 'f-1' });
    const access = await signInPlatformAdmin(db(), {
      email: 'jamilnash@solvanehub.us',
      password: 'x',
    });
    expect(access.kind).toBe('mfa_verify');
    expect(mocks.recordAuditEvent.mock.calls[0]![0].event).toBe('admin.signed_in');
  });

  it('signs a non-administrator straight back out — this browser only', async () => {
    mocks.getAdminAccess.mockResolvedValue({ kind: 'denied', userId: 'founder' });
    const client = db();
    await expect(
      signInPlatformAdmin(client, { email: 'founder@gmail.com', password: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(
      (client as { auth: { signOut: ReturnType<typeof vi.fn> } }).auth.signOut,
    ).toHaveBeenCalledWith({
      scope: 'local',
    });
    expect(mocks.recordAuditEvent.mock.calls[0]![0].event).toBe('admin.sign_in_denied');
  });

  it('gives wrong credentials and non-administrators the same message (no account enumeration)', async () => {
    mocks.signIn.mockRejectedValueOnce(
      new AppError({ code: 'AUTH_INVALID_CREDENTIALS', humanMessage: 'Wrong' }),
    );
    const wrong = await signInPlatformAdmin(db(), { email: 'a@b.co', password: 'x' }).catch(
      (e: AppError) => e.humanMessage,
    );
    mocks.getAdminAccess.mockResolvedValue({ kind: 'denied', userId: 'founder' });
    const notAdmin = await signInPlatformAdmin(db(), { email: 'a@b.co', password: 'x' }).catch(
      (e: AppError) => e.humanMessage,
    );
    expect(wrong).toBe(notAdmin);
  });
});

describe('verifyMfaCode', () => {
  it('refuses a factor that does not belong to the caller', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'mfa_verify', factorId: 'f-1' });
    await expect(
      verifyMfaCode(db(), { factorId: 'someone-elses', code: '123456' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('a wrong code fails and is audited', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'mfa_verify', factorId: 'f-1' });
    const client = db({
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue({ data: { all: [{ id: 'f-1', factor_type: 'totp' }] } }),
        challengeAndVerify: vi.fn().mockResolvedValue({ error: { message: 'Invalid TOTP code' } }),
      },
    });
    await expect(verifyMfaCode(client, { factorId: 'f-1', code: '000000' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(mocks.recordAuditEvent.mock.calls[0]![0].event).toBe('admin.mfa_failed');
  });

  it('is unavailable to a non-administrator', async () => {
    mocks.getAdminAccess.mockResolvedValue({ kind: 'denied', userId: 'x' });
    await expect(verifyMfaCode(db(), { factorId: 'f-1', code: '123456' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('changeAdminPassword', () => {
  it('requires the correct current password, checked without touching the session', async () => {
    mocks.getAdminAccess.mockResolvedValue(ADMIN);
    mocks.probeSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const client = db();
    await expect(
      changeAdminPassword(client, {
        currentPassword: 'wrong',
        newPassword: 'a-long-new-passphrase',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(
      (client as { auth: { updateUser: ReturnType<typeof vi.fn> } }).auth.updateUser,
    ).not.toHaveBeenCalled();
  });

  it('changes the password, clears the temporary-password flag and audits — without the password', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'password_change' });
    const client = db();
    await changeAdminPassword(client, {
      currentPassword: 'temporary-one',
      newPassword: 'a-long-new-passphrase',
    });
    expect(
      (client as { auth: { updateUser: ReturnType<typeof vi.fn> } }).auth.updateUser,
    ).toHaveBeenCalledWith({
      password: 'a-long-new-passphrase',
    });
    expect(mocks.updateUserById).toHaveBeenCalledWith('u1', {
      app_metadata: { password_change_required: false },
    });
    const audit = JSON.stringify(mocks.recordAuditEvent.mock.calls);
    expect(audit).toContain('admin.password_changed');
    expect(audit).not.toContain('a-long-new-passphrase');
    expect(audit).not.toContain('temporary-one');
  });

  it('refuses reusing the current password', async () => {
    mocks.getAdminAccess.mockResolvedValue(ADMIN);
    await expect(
      changeAdminPassword(db(), {
        currentPassword: 'same-password-123',
        newPassword: 'same-password-123',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('is refused to anyone who is not an administrator', async () => {
    mocks.getAdminAccess.mockResolvedValue({ kind: 'denied', userId: 'x' });
    await expect(
      changeAdminPassword(db(), { currentPassword: 'a', newPassword: 'a-long-new-passphrase' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('password reset', () => {
  it('sends a reset only for an allowlisted address, silently for anything else', async () => {
    await requestAdminPasswordReset(db(), 'founder@gmail.com');
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    await requestAdminPasswordReset(db(), 'jamilnash@solvanehub.us');
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'jamilnash@solvanehub.us' },
      {},
      '/admin/reset-password',
    );
  });

  it('only a session that came from a recent recovery link may set a password without the current one', async () => {
    mocks.getAdminAccess.mockResolvedValue({ ...ADMIN, kind: 'mfa_enroll' });
    await expect(completeAdminPasswordReset(db(), 'a-long-new-passphrase')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const now = Math.floor(Date.now() / 1000);
    const client = db({
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { amr: [{ method: 'recovery', timestamp: now - 60 }] } },
      }),
    });
    await completeAdminPasswordReset(client, 'a-long-new-passphrase');
    expect(
      (client as { auth: { updateUser: ReturnType<typeof vi.fn> } }).auth.updateUser,
    ).toHaveBeenCalled();
  });

  it('an old recovery session is refused', async () => {
    mocks.getAdminAccess.mockResolvedValue(ADMIN);
    const old = Math.floor(Date.now() / 1000) - 3 * 3600;
    const client = db({
      getClaims: vi
        .fn()
        .mockResolvedValue({ data: { claims: { amr: [{ method: 'recovery', timestamp: old }] } } }),
    });
    await expect(completeAdminPasswordReset(client, 'a-long-new-passphrase')).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  consumeWaitlistRateLimit: vi.fn(),
  joinWaitlist: vi.fn(),
  sendWaitlistConfirmation: vi.fn(),
  sendWaitlistNotification: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '192.0.2.10' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/services/waitlist', () => ({
  consumeWaitlistRateLimit: mocks.consumeWaitlistRateLimit,
  joinWaitlist: mocks.joinWaitlist,
}));

vi.mock('@/lib/email/resend', () => ({
  sendWaitlistConfirmation: mocks.sendWaitlistConfirmation,
  sendWaitlistNotification: mocks.sendWaitlistNotification,
}));

import { joinWaitlistAction } from '@/app/waitlist-actions';

function submission(): FormData {
  const formData = new FormData();
  formData.set('firstName', 'Jamil');
  formData.set('lastName', 'Nash');
  formData.set('email', 'jamil@example.com');
  return formData;
}

describe('waitlist email dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({});
    mocks.consumeWaitlistRateLimit.mockResolvedValue({ allowed: true });
    mocks.sendWaitlistConfirmation.mockResolvedValue(undefined);
    mocks.sendWaitlistNotification.mockResolvedValue(undefined);
  });

  it('does not resend emails for a duplicate signup', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'already_on_list' });

    const result = await joinWaitlistAction(null, submission());

    expect(result).toMatchObject({ ok: true, data: { status: 'already_on_list' } });
    expect(mocks.sendWaitlistConfirmation).not.toHaveBeenCalled();
    expect(mocks.sendWaitlistNotification).not.toHaveBeenCalled();
  });

  it('sends both emails for a newly joined visitor', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'joined' });

    const result = await joinWaitlistAction(null, submission());

    expect(result).toMatchObject({ ok: true, data: { status: 'joined' } });
    expect(mocks.sendWaitlistConfirmation).toHaveBeenCalledOnce();
    expect(mocks.sendWaitlistNotification).toHaveBeenCalledOnce();
  });
});

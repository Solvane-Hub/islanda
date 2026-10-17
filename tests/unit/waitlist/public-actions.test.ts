import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  consumeWaitlistRateLimit: vi.fn(),
  consumeWaitlistSurveyRateLimit: vi.fn(),
  joinWaitlist: vi.fn(),
  submitWaitlistSurvey: vi.fn(),
  sendWaitlistConfirmation: vi.fn(),
  sendWaitlistNotification: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '192.0.2.10' })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/services/waitlist', () => ({
  consumeWaitlistRateLimit: mocks.consumeWaitlistRateLimit,
  consumeWaitlistSurveyRateLimit: mocks.consumeWaitlistSurveyRateLimit,
  joinWaitlist: mocks.joinWaitlist,
  submitWaitlistSurvey: mocks.submitWaitlistSurvey,
}));
vi.mock('@/lib/email/resend', () => ({
  sendWaitlistConfirmation: mocks.sendWaitlistConfirmation,
  sendWaitlistNotification: mocks.sendWaitlistNotification,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.logError } }));

import { joinWaitlistAction, submitWaitlistSurveyAction } from '@/app/waitlist-actions';

const TOKEN = 'k'.repeat(43);

function signup(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('firstName', 'Ada');
  fd.set('lastName', 'Lovelace');
  fd.set('email', 'ada@example.com');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

function survey(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('token', TOKEN);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({});
  mocks.consumeWaitlistRateLimit.mockResolvedValue({ allowed: true });
  mocks.consumeWaitlistSurveyRateLimit.mockResolvedValue({ allowed: true });
  mocks.sendWaitlistConfirmation.mockResolvedValue(undefined);
  mocks.sendWaitlistNotification.mockResolvedValue(undefined);
});

describe('joinWaitlistAction', () => {
  it('joins with name and email only', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'joined', surveyToken: TOKEN });
    const result = await joinWaitlistAction(null, signup());
    expect(result).toEqual({ ok: true, data: { status: 'joined', surveyToken: TOKEN } });
    expect(mocks.joinWaitlist.mock.calls[0]![1]).toMatchObject({
      email: 'ada@example.com',
      phone: undefined,
    });
  });

  it('passes an optional phone number through to the service', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'joined', surveyToken: TOKEN });
    await joinWaitlistAction(null, signup({ phone: '(242) 555-0123' }));
    expect(mocks.joinWaitlist.mock.calls[0]![1].phone).toBe('(242) 555-0123');
  });

  it('rejects an invalid phone with a field error and writes nothing', async () => {
    const result = await joinWaitlistAction(null, signup({ phone: 'abc' }));
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(result.ok ? null : result.fieldErrors?.phone).toBeTruthy();
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });

  it('rejects missing required fields and an invalid email', async () => {
    const missing = new FormData();
    const result = await joinWaitlistAction(null, missing);
    expect(result.ok ? null : Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
    ]);
    const bad = await joinWaitlistAction(null, signup({ email: 'nope' }));
    expect(bad.ok ? null : bad.fieldErrors?.email).toBeTruthy();
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });

  it('still applies the signup rate limit', async () => {
    mocks.consumeWaitlistRateLimit.mockResolvedValue({ allowed: false });
    const result = await joinWaitlistAction(null, signup());
    expect(result).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });
});

describe('submitWaitlistSurveyAction', () => {
  it('saves answers against the token', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'saved' });
    const result = await submitWaitlistSurveyAction(
      null,
      survey({ country: 'The Bahamas', businessStage: 'just_exploring', testingInterest: 'yes' }),
    );
    expect(result).toEqual({ ok: true, data: { status: 'saved' } });
    expect(mocks.submitWaitlistSurvey.mock.calls[0]![1]).toMatchObject({
      token: TOKEN,
      country: 'The Bahamas',
      businessStage: 'just_exploring',
      testingInterest: 'yes',
    });
  });

  it('treats an all-blank submission as a success (skip), not an error', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'empty' });
    const result = await submitWaitlistSurveyAction(null, survey({ country: '', cityIsland: '' }));
    expect(result).toEqual({ ok: true, data: { status: 'empty' } });
  });

  it('a missing or malformed token fails without touching the database', async () => {
    const fd = new FormData();
    fd.set('token', 'short');
    const result = await submitWaitlistSurveyAction(null, fd);
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(result.ok ? null : result.message).toMatch(/still on the waitlist/);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.submitWaitlistSurvey).not.toHaveBeenCalled();
  });

  it('an unknown token says so — and reassures that the signup stands', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'not_found' });
    const result = await submitWaitlistSurveyAction(null, survey({ testingInterest: 'maybe' }));
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(result.ok ? null : result.message).toMatch(/still on the waitlist/);
  });

  it('rejects an answer outside the agreed options as a field error', async () => {
    const result = await submitWaitlistSurveyAction(null, survey({ businessStage: 'unicorn' }));
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(result.ok ? null : result.fieldErrors?.businessStage).toBeTruthy();
    expect(mocks.submitWaitlistSurvey).not.toHaveBeenCalled();
  });

  it('is rate limited separately from signup', async () => {
    mocks.consumeWaitlistSurveyRateLimit.mockResolvedValue({ allowed: false });
    const result = await submitWaitlistSurveyAction(null, survey({ testingInterest: 'yes' }));
    expect(result).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(mocks.consumeWaitlistRateLimit).not.toHaveBeenCalled();
    expect(mocks.submitWaitlistSurvey).not.toHaveBeenCalled();
  });

  it('fails closed if the limiter is unreachable', async () => {
    mocks.consumeWaitlistSurveyRateLimit.mockRejectedValue(new Error('db down'));
    const result = await submitWaitlistSurveyAction(null, survey({ testingInterest: 'yes' }));
    expect(result).toMatchObject({ ok: false, code: 'UNEXPECTED' });
    expect(mocks.submitWaitlistSurvey).not.toHaveBeenCalled();
  });

  it('returns a retryable error on a database failure and never logs the token', async () => {
    mocks.submitWaitlistSurvey.mockRejectedValue(new Error(`boom ${TOKEN}`));
    const result = await submitWaitlistSurveyAction(null, survey({ country: 'Bahamas' }));
    expect(result).toMatchObject({
      ok: false,
      code: 'UNEXPECTED',
      message: 'We could not save your answers just now. Please try again.',
    });
    expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain(TOKEN);
  });
});

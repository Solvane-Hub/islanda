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
  recordServerEvent: vi.fn(),
  getWaitlistSurvey: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        'x-forwarded-for': '192.0.2.10',
        'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1',
      }),
  ),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));
vi.mock('@/services/analytics', () => ({
  recordServerEvent: mocks.recordServerEvent,
  errorCategoryFor: (code: string) => (code === 'RATE_LIMITED' ? 'rate_limited' : 'unexpected'),
}));
vi.mock('@/services/analytics/context', () => ({ analyticsContext: () => ({}) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/services/waitlist', () => ({
  consumeWaitlistRateLimit: mocks.consumeWaitlistRateLimit,
  consumeWaitlistSurveyRateLimit: mocks.consumeWaitlistSurveyRateLimit,
  joinWaitlist: mocks.joinWaitlist,
  submitWaitlistSurvey: mocks.submitWaitlistSurvey,
  getWaitlistSurvey: mocks.getWaitlistSurvey,
}));
vi.mock('@/lib/email/resend', () => ({
  sendWaitlistConfirmation: mocks.sendWaitlistConfirmation,
  sendWaitlistNotification: mocks.sendWaitlistNotification,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.logError } }));

import {
  getWaitlistSurveyAction,
  joinWaitlistAction,
  submitWaitlistSurveyAction,
} from '@/app/waitlist-actions';

const TOKEN = 'k'.repeat(43);

function signup(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('firstName', 'Ada');
  fd.set('lastName', 'Lovelace');
  fd.set('email', 'ada@example.com');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** One questionnaire section save: the declared fields, their values and the final flag. */
function survey(extra: Record<string, string> = {}, final = false): FormData {
  const fd = new FormData();
  fd.set('token', TOKEN);
  fd.set('final', final ? 'true' : 'false');
  fd.set('section', '1');
  fd.set('fields', Object.keys(extra).join(','));
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

describe('analytics around signup (server-verified, no personal data)', () => {
  it('records a successful signup and never sends the name or email', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'joined', surveyToken: TOKEN });
    await joinWaitlistAction(null, signup());
    const event = mocks.recordServerEvent.mock.calls[0]![0];
    expect(event).toMatchObject({ name: 'waitlist_signup_succeeded', status: 'success' });
    expect(JSON.stringify(mocks.recordServerEvent.mock.calls)).not.toMatch(/Ada|example\.com/);
  });

  it('records a duplicate separately from a new signup', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'already_on_list' });
    await joinWaitlistAction(null, signup());
    expect(mocks.recordServerEvent.mock.calls[0]![0].name).toBe('waitlist_signup_duplicate');
  });

  it('records a failure with a safe category only', async () => {
    mocks.consumeWaitlistRateLimit.mockResolvedValue({ allowed: false });
    await joinWaitlistAction(null, signup());
    expect(mocks.recordServerEvent.mock.calls[0]![0]).toMatchObject({
      name: 'waitlist_signup_failed',
      status: 'failure',
      errorCategory: 'rate_limited',
    });
  });

  it('an analytics failure never changes the signup result', async () => {
    mocks.joinWaitlist.mockResolvedValue({ status: 'joined', surveyToken: TOKEN });
    mocks.recordServerEvent.mockRejectedValue(new Error('analytics down'));
    expect(await joinWaitlistAction(null, signup())).toEqual({
      ok: true,
      data: { status: 'joined', surveyToken: TOKEN },
    });
  });
});

describe('submitWaitlistSurveyAction', () => {
  it('saves one section — only its declared fields — against the token', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'saved' });
    const result = await submitWaitlistSurveyAction(
      null,
      survey({ country: 'The Bahamas', businessJourney: 'preparing_to_register', industry: '' }),
    );
    expect(result).toEqual({ ok: true, data: { status: 'saved' } });
    expect(mocks.submitWaitlistSurvey.mock.calls[0]![1]).toEqual({
      token: TOKEN,
      final: false,
      // Clearing the industry also clears its "Other" explanation.
      answers: {
        country: 'The Bahamas',
        businessJourney: 'preparing_to_register',
        industry: null,
        industryOther: null,
      },
    });
    expect(mocks.recordServerEvent.mock.calls[0]![0]).toMatchObject({
      name: 'waitlist_survey_saved',
      properties: { section: 1 },
    });
  });

  it('the final section marks completion', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'saved' });
    await submitWaitlistSurveyAction(null, survey({ additionalInfo: 'Food licence help' }, true));
    expect(mocks.submitWaitlistSurvey.mock.calls[0]![1].final).toBe(true);
    expect(mocks.recordServerEvent.mock.calls[0]![0].name).toBe('waitlist_survey_completed');
  });

  it('treats an all-blank submission as a success (skip), not an error', async () => {
    mocks.submitWaitlistSurvey.mockResolvedValue({ status: 'empty' });
    const result = await submitWaitlistSurveyAction(null, survey({ country: '', cityIsland: '' }));
    expect(result).toEqual({ ok: true, data: { status: 'empty' } });
    expect(mocks.recordServerEvent).not.toHaveBeenCalled();
  });

  it('a missing or malformed token fails without touching the database', async () => {
    const fd = new FormData();
    fd.set('token', 'short');
    fd.set('final', 'false');
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

  it('rejects an answer outside the agreed options as a field error on that field', async () => {
    const result = await submitWaitlistSurveyAction(null, survey({ industry: 'unicorns' }));
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(result.ok ? null : result.fieldErrors?.industry).toBeTruthy();
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

  it('returns a retryable error on a database failure and never logs the token or answers', async () => {
    mocks.submitWaitlistSurvey.mockRejectedValue(new Error(`boom ${TOKEN} Barbados`));
    const result = await submitWaitlistSurveyAction(null, survey({ country: 'Barbados' }));
    expect(result).toMatchObject({
      ok: false,
      code: 'UNEXPECTED',
      message: 'We could not save your answers just now. Please try again.',
    });
    const logged = JSON.stringify(mocks.logError.mock.calls);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('Barbados');
  });
});

describe('getWaitlistSurveyAction', () => {
  it('returns the token holder their own answers', async () => {
    mocks.getWaitlistSurvey.mockResolvedValue({ country: 'Barbados', completed: true });
    expect(await getWaitlistSurveyAction(TOKEN)).toEqual({ country: 'Barbados', completed: true });
  });

  it('refuses a malformed token without a database call', async () => {
    expect(await getWaitlistSurveyAction('short')).toBeNull();
    expect(mocks.getWaitlistSurvey).not.toHaveBeenCalled();
  });
});

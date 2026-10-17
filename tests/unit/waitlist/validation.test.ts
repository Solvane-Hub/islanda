import { describe, expect, it } from 'vitest';
import {
  joinWaitlistSchema,
  recruitmentUpdateSchema,
  waitlistFiltersSchema,
  waitlistSurveySchema,
} from '@/lib/validation/waitlist';
import {
  BUSINESS_STAGE_OPTIONS,
  CHALLENGE_OPTIONS,
  RECRUITMENT_STATUS_OPTIONS,
  TESTING_INTEREST_OPTIONS,
} from '@/lib/waitlist/options';

const TOKEN = 'a'.repeat(43);

describe('joinWaitlistSchema', () => {
  const base = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };

  it('accepts name and email only — phone is optional', () => {
    const parsed = joinWaitlistSchema.parse({ ...base, phone: null });
    expect(parsed.phone).toBeUndefined();
    expect(joinWaitlistSchema.parse({ ...base, phone: '   ' }).phone).toBeUndefined();
  });

  it.each(['(242) 555-0123', '+1 242 555 0123', '242.555.0123'])('accepts phone %s', (phone) => {
    expect(joinWaitlistSchema.parse({ ...base, phone }).phone).toBe(phone);
  });

  it.each(['12345', 'call me maybe', '242-555-0123; drop table', '1'.repeat(31)])(
    'rejects phone %s',
    (phone) => {
      const result = joinWaitlistSchema.safeParse({ ...base, phone });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['phone']);
    },
  );

  it('still requires first name, last name and a valid email', () => {
    expect(joinWaitlistSchema.safeParse({ ...base, firstName: '' }).success).toBe(false);
    expect(joinWaitlistSchema.safeParse({ ...base, lastName: '  ' }).success).toBe(false);
    expect(joinWaitlistSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    expect(joinWaitlistSchema.safeParse({ ...base, email: '' }).success).toBe(false);
  });
});

describe('waitlistSurveySchema', () => {
  it('treats every question as optional', () => {
    const parsed = waitlistSurveySchema.parse({
      token: TOKEN,
      country: null,
      cityIsland: '',
      businessStage: null,
      biggestChallenge: '',
      challengeOther: null,
      testingInterest: null,
    });
    expect(parsed).toEqual({
      token: TOKEN,
      country: undefined,
      cityIsland: undefined,
      businessStage: undefined,
      biggestChallenge: undefined,
      challengeOther: undefined,
      testingInterest: undefined,
    });
  });

  it('requires a well-formed token', () => {
    expect(waitlistSurveySchema.safeParse({ token: 'short' }).success).toBe(false);
    expect(waitlistSurveySchema.safeParse({}).success).toBe(false);
  });

  it.each(BUSINESS_STAGE_OPTIONS.map((o) => o.value))('accepts business stage %s', (value) => {
    expect(waitlistSurveySchema.parse({ token: TOKEN, businessStage: value }).businessStage).toBe(
      value,
    );
  });

  it.each(CHALLENGE_OPTIONS.map((o) => o.value))('accepts challenge %s', (value) => {
    expect(
      waitlistSurveySchema.parse({ token: TOKEN, biggestChallenge: value }).biggestChallenge,
    ).toBe(value);
  });

  it.each(TESTING_INTEREST_OPTIONS.map((o) => o.value))('accepts interest %s', (value) => {
    expect(
      waitlistSurveySchema.parse({ token: TOKEN, testingInterest: value }).testingInterest,
    ).toBe(value);
  });

  it('rejects a value outside the agreed options', () => {
    const result = waitlistSurveySchema.safeParse({ token: TOKEN, businessStage: 'unicorn' });
    expect(result.success).toBe(false);
  });

  it('keeps the explanation only when "Other" is chosen', () => {
    expect(
      waitlistSurveySchema.parse({
        token: TOKEN,
        biggestChallenge: 'other',
        challengeOther: 'Getting a loan',
      }).challengeOther,
    ).toBe('Getting a loan');
    expect(
      waitlistSurveySchema.parse({
        token: TOKEN,
        biggestChallenge: 'finding_customers',
        challengeOther: 'Getting a loan',
      }).challengeOther,
    ).toBeUndefined();
  });

  it('limits the explanation to 300 characters', () => {
    const result = waitlistSurveySchema.safeParse({
      token: TOKEN,
      biggestChallenge: 'other',
      challengeOther: 'x'.repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

describe('waitlistFiltersSchema', () => {
  it('ignores malformed values instead of failing the page', () => {
    const parsed = waitlistFiltersSchema.parse({
      businessStage: 'nope',
      recruitmentStatus: 'contacted',
      from: '17/10/2026',
      to: '2026-10-17',
      page: 'abc',
    });
    expect(parsed.businessStage).toBeUndefined();
    expect(parsed.recruitmentStatus).toBe('contacted');
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBe('2026-10-17');
    expect(parsed.page).toBe(1);
  });
});

describe('recruitmentUpdateSchema', () => {
  const id = '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11';

  it.each(RECRUITMENT_STATUS_OPTIONS.map((o) => o.value))('accepts status %s', (value) => {
    expect(
      recruitmentUpdateSchema.parse({ signupId: id, recruitmentStatus: value }).recruitmentStatus,
    ).toBe(value);
  });

  it('turns blank notes into "no notes" and caps their length', () => {
    expect(
      recruitmentUpdateSchema.parse({
        signupId: id,
        recruitmentStatus: 'contacted',
        recruitmentNotes: '  ',
      }).recruitmentNotes,
    ).toBeUndefined();
    expect(
      recruitmentUpdateSchema.safeParse({
        signupId: id,
        recruitmentStatus: 'contacted',
        recruitmentNotes: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid id', () => {
    expect(
      recruitmentUpdateSchema.safeParse({ signupId: '1', recruitmentStatus: 'tested' }).success,
    ).toBe(false);
  });
});

describe('option wording', () => {
  it('matches the agreed questionnaire and recruitment labels exactly', () => {
    expect(BUSINESS_STAGE_OPTIONS.map((o) => o.label)).toEqual([
      'Just exploring',
      'Planning to start',
      'Trying to register',
      'Already operating',
    ]);
    expect(CHALLENGE_OPTIONS.map((o) => o.label)).toEqual([
      'Finding reliable information',
      'Understanding registration',
      'Knowing the next steps',
      'Finding customers',
      'Managing my business',
      'Other',
    ]);
    expect(TESTING_INTEREST_OPTIONS.map((o) => o.label)).toEqual(['Yes', 'Maybe', 'Not right now']);
    expect(RECRUITMENT_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'Not Contacted',
      'Contacted',
      'Confirmed',
      'Tested',
    ]);
  });
});

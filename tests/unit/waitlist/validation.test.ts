import { describe, expect, it } from 'vitest';
import {
  joinWaitlistSchema,
  recruitmentUpdateSchema,
  surveyAnswersFromForm,
  waitlistFiltersSchema,
  waitlistSurveySchema,
} from '@/lib/validation/waitlist';
import {
  BUSINESS_JOURNEY_OPTIONS,
  BUSINESS_STAGE_OPTIONS,
  CHALLENGE_OPTIONS,
  EARLY_ACCESS_QUESTION_OPTIONS,
  FEEDBACK_INTEREST_OPTIONS,
  INDUSTRY_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RECRUITMENT_STATUS_OPTIONS,
  TESTING_INTEREST_OPTIONS,
  challengeLabel,
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
  const parse = (answers: Record<string, unknown>, final = false) =>
    waitlistSurveySchema.parse({ token: TOKEN, final, answers });

  it('treats every question as optional, and blank as "cleared" rather than "untouched"', () => {
    expect(parse({}).answers).toEqual({});
    expect(parse({ country: '', businessJourney: null }).answers).toEqual({
      country: null,
      businessJourney: null,
    });
  });

  it('requires a well-formed token and a final flag', () => {
    expect(
      waitlistSurveySchema.safeParse({ token: 'short', final: false, answers: {} }).success,
    ).toBe(false);
    expect(waitlistSurveySchema.safeParse({ token: TOKEN, answers: {} }).success).toBe(false);
  });

  it.each([
    ['businessJourney', BUSINESS_JOURNEY_OPTIONS],
    ['industry', INDUSTRY_OPTIONS],
    ['businessStage', BUSINESS_STAGE_OPTIONS],
    ['testingInterest', TESTING_INTEREST_OPTIONS],
    ['feedbackInterest', FEEDBACK_INTEREST_OPTIONS],
  ] as const)('accepts every offered %s', (field, options) => {
    for (const option of options) {
      expect(parse({ [field]: option.value }).answers).toMatchObject({ [field]: option.value });
    }
  });

  it.each([
    ['primaryGoals', PRIMARY_GOAL_OPTIONS],
    ['challenges', CHALLENGE_OPTIONS],
  ] as const)('accepts every offered %s, alone and together', (field, options) => {
    for (const option of options) {
      expect(parse({ [field]: [option.value] }).answers).toMatchObject({
        [field]: [option.value],
      });
    }
    const several = options
      .map((o) => o.value)
      .filter((v) => v !== 'not_sure_yet' && v !== 'several_challenges');
    expect(parse({ [field]: several }).answers).toMatchObject({ [field]: several });
  });

  it('accepts a single value where a list is expected (one ticked checkbox)', () => {
    expect(parse({ primaryGoals: 'clear_plan' }).answers.primaryGoals).toEqual(['clear_plan']);
  });

  it('treats an empty selection as cleared, not untouched', () => {
    // Clearing the selection also clears its now-orphaned 'Other' explanation.
    expect(parse({ primaryGoals: [] }).answers).toEqual({ primaryGoals: null, goalOther: null });
    expect(parse({ challenges: [''] }).answers).toEqual({ challenges: null, challengeOther: null });
    expect(parse({}).answers).toEqual({});
  });

  it('rejects duplicate selections', () => {
    expect(
      waitlistSurveySchema.safeParse({
        token: TOKEN,
        final: false,
        answers: { primaryGoals: ['clear_plan', 'clear_plan'] },
      }).success,
    ).toBe(false);
  });

  it('keeps the exclusive answers exclusive', () => {
    const ok = (answers: Record<string, unknown>) =>
      waitlistSurveySchema.safeParse({ token: TOKEN, final: false, answers }).success;
    expect(ok({ primaryGoals: ['not_sure_yet'] })).toBe(true);
    expect(ok({ primaryGoals: ['not_sure_yet', 'clear_plan'] })).toBe(false);
    expect(ok({ challenges: ['several_challenges'] })).toBe(true);
    expect(ok({ challenges: ['several_challenges', 'marketing'] })).toBe(false);
  });

  it('rejects values outside the agreed options, including the retired challenge', () => {
    expect(
      waitlistSurveySchema.safeParse({
        token: TOKEN,
        final: false,
        answers: { industry: 'unicorns' },
      }).success,
    ).toBe(false);
    expect(
      waitlistSurveySchema.safeParse({
        token: TOKEN,
        final: false,
        answers: { challenges: ['managing_business'] },
      }).success,
    ).toBe(false);
  });

  it('keeps an "Other" explanation only with "Other", and clears it otherwise', () => {
    expect(parse({ industry: 'other', industryOther: 'Boat repair' }).answers).toEqual({
      industry: 'other',
      industryOther: 'Boat repair',
    });
    expect(parse({ industry: 'technology_software', industryOther: 'stale' }).answers).toEqual({
      industry: 'technology_software',
      industryOther: null,
    });
    expect(parse({ primaryGoals: ['clear_plan'], goalOther: 'x' }).answers.goalOther).toBeNull();
    expect(
      parse({ challenges: ['marketing'], challengeOther: 'x' }).answers.challengeOther,
    ).toBeNull();
    // "Other" anywhere in a multi-select keeps its explanation.
    expect(
      parse({ primaryGoals: ['clear_plan', 'other'], goalOther: 'Export permits' }).answers
        .goalOther,
    ).toBe('Export permits');
    expect(
      parse({ challenges: ['marketing', 'other'], challengeOther: 'Shipping' }).answers
        .challengeOther,
    ).toBe('Shipping');
  });

  it('caps free text at the database limits', () => {
    const tooLong = (field: string, n: number) =>
      waitlistSurveySchema.safeParse({
        token: TOKEN,
        final: false,
        answers: { [field]: 'x'.repeat(n) },
      }).success;
    expect(tooLong('additionalInfo', 1000)).toBe(true);
    expect(tooLong('additionalInfo', 1001)).toBe(false);
    expect(tooLong('businessName', 201)).toBe(false);
    expect(tooLong('goalOther', 301)).toBe(false);
  });

  it('reads only the fields a section declared', () => {
    const fd = new FormData();
    fd.set('fields', 'country,businessJourney,notAField');
    fd.set('country', 'Barbados');
    fd.set('industry', 'technology_software'); // present but not declared — ignored
    expect(surveyAnswersFromForm(fd)).toEqual({ country: 'Barbados', businessJourney: null });
  });

  it('reads every ticked checkbox of a multi-select field', () => {
    const fd = new FormData();
    fd.set('fields', 'primaryGoals,challenges');
    fd.append('primaryGoals', 'clear_plan');
    fd.append('primaryGoals', 'other');
    expect(surveyAnswersFromForm(fd)).toEqual({
      primaryGoals: ['clear_plan', 'other'],
      challenges: [],
    });
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

  it('accepts the expanded filters and ignores unknown values', () => {
    const parsed = waitlistFiltersSchema.parse({
      industry: 'technology_software',
      primaryGoal: 'nope',
      pool: 'early_access',
      tests: 'show',
      sort: 'oldest',
      feedbackInterest: 'maybe',
    });
    expect(parsed).toMatchObject({
      industry: 'technology_software',
      primaryGoal: undefined,
      pool: 'early_access',
      tests: 'show',
      sort: 'oldest',
      feedbackInterest: 'maybe',
    });
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

  it('validates the detail editor dates and https feedback link', () => {
    const base = { signupId: id, recruitmentStatus: 'tested' };
    expect(
      recruitmentUpdateSchema.parse({ ...base, testedOn: '2026-11-02', feedbackLink: '' }),
    ).toMatchObject({
      testedOn: '2026-11-02',
      feedbackLink: null,
    });
    expect(recruitmentUpdateSchema.safeParse({ ...base, testedOn: '02/11/2026' }).success).toBe(
      false,
    );
    expect(
      recruitmentUpdateSchema.safeParse({ ...base, feedbackLink: 'http://x.example' }).success,
    ).toBe(false);
    expect(
      recruitmentUpdateSchema.safeParse({ ...base, feedbackLink: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      recruitmentUpdateSchema.parse({ ...base, feedbackLink: 'https://drive.google.com/x' })
        .feedbackLink,
    ).toBe('https://drive.google.com/x');
  });

  it('rejects a non-uuid id', () => {
    expect(
      recruitmentUpdateSchema.safeParse({ signupId: '1', recruitmentStatus: 'tested' }).success,
    ).toBe(false);
  });
});

describe('option wording', () => {
  it('matches the agreed questionnaire wording exactly', () => {
    expect(BUSINESS_JOURNEY_OPTIONS.map((o) => o.label)).toEqual([
      "I have an idea but haven't started yet",
      "I'm planning to start a new business",
      "I'm preparing to register my business",
      "I've started operating but am not fully established yet",
      'I already run an established business',
      "I'm starting another business",
      "I'm exploring business ownership and haven't decided yet",
      'Other',
    ]);
    expect(INDUSTRY_OPTIONS).toHaveLength(22);
    expect(INDUSTRY_OPTIONS.at(-2)!.label).toBe('Other');
    expect(INDUSTRY_OPTIONS.at(-1)!.label).toBe('Not Sure Yet');
    expect(PRIMARY_GOAL_OPTIONS).toHaveLength(20);
    expect(PRIMARY_GOAL_OPTIONS[2]!.label).toBe(
      'Figure out what licences, permits, or approvals I may need',
    );
    expect(CHALLENGE_OPTIONS.map((o) => o.label)).toEqual([
      'Finding reliable information',
      'Understanding registration and legal requirements',
      'Knowing what to do next',
      'Getting my business started',
      'Organizing documents and information',
      'Managing money and expenses',
      'Finding customers',
      'Marketing my business',
      'Managing day-to-day operations',
      'Understanding industry-specific requirements',
      'Finding funding or financial support',
      'Keeping up with deadlines and requirements',
      'Turning my business idea into a workable plan',
      "I have several challenges and don't know where to start",
      'Other',
    ]);
    expect(BUSINESS_STAGE_OPTIONS.map((o) => o.label)).toEqual([
      'Just exploring',
      'Planning to start',
      'Trying to register',
      'Already operating',
    ]);
    expect(EARLY_ACCESS_QUESTION_OPTIONS.map((o) => o.label)).toEqual([
      "Yes, I'd love to try it",
      "Maybe — I'd like to learn more first",
      'Not right now',
    ]);
    expect(FEEDBACK_INTEREST_OPTIONS.map((o) => o.label)).toEqual([
      'Yes',
      'Maybe',
      'Not right now',
    ]);
    expect(RECRUITMENT_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'Not Contacted',
      'Contacted',
      'Confirmed',
      'Tested',
    ]);
  });

  it('still labels the retired challenge stored by the first questionnaire', () => {
    expect(challengeLabel('managing_business')).toMatch(/Managing my business/);
  });
});

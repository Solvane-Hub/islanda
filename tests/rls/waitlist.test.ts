import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Json } from '@/types/database';
import {
  adminClient,
  adminConfigured,
  anonClient,
  productionWritesAllowed,
  rlsConfigured,
  RUN,
  signIn,
  TEST_SOURCE,
} from './client';

/** Tests that leave a signup row behind. Skipped against production unless explicitly allowed. */
const writes = it.skipIf(!productionWritesAllowed);

/**
 * Row Level Security — public waitlist (`waitlist_signups`).
 *
 * Unlike every other table in this schema, this one has no owner and no
 * `app.business_access()` seam at all: it is intentionally reachable by
 * `anon`, but only through a single narrow door (INSERT). This suite proves
 * that door is the only one — a public visitor can create a signup, but can
 * never read any row (including the one they just created), update anything,
 * or delete anything, and that a duplicate email is rejected at the database
 * layer regardless of what the application layer does with that rejection.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — waitlist_signups', () => {
  const email = `${RUN}-waitlist@example.dev`.toLowerCase();

  writes('an anonymous visitor can INSERT a signup', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email,
      first_name: 'Founder',
      last_name: 'Founder',
      source: TEST_SOURCE,
    });
    expect(error).toBeNull();
  });

  writes('the database rejects a duplicate email regardless of case', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email: email.toUpperCase(),
      first_name: 'Founder',
      last_name: 'Founder',
      source: TEST_SOURCE,
    });
    expect(error).not.toBeNull(); // waitlist_signups_email_unique_idx on lower(email)
  });

  it('the database rejects a malformed email', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email: `${RUN}-not-an-email`,
      first_name: 'Founder',
      last_name: 'Founder',
      source: TEST_SOURCE,
    });
    expect(error).not.toBeNull(); // ws_email_format
  });

  it('an anonymous visitor cannot read any signup, including their own', async () => {
    const anon = anonClient();
    const { data } = await anon.from('waitlist_signups').select('id').eq('email', email);
    expect(data ?? []).toHaveLength(0);
  });

  it('an anonymous visitor cannot update a signup', async () => {
    const anon = anonClient();
    const { error, data } = await anon
      .from('waitlist_signups')
      .update({ status: 'invited' } as never)
      .eq('email', email)
      .select('id');
    expect(error).not.toBeNull(); // no UPDATE grant/policy
    expect(data ?? []).toHaveLength(0);
  });

  it('an anonymous visitor cannot delete a signup', async () => {
    const anon = anonClient();
    const { error, data } = await anon
      .from('waitlist_signups')
      .delete()
      .eq('email', email)
      .select('id');
    expect(error).not.toBeNull(); // no DELETE grant/policy
    expect(data ?? []).toHaveLength(0);
  });

  it('a signed-in founder cannot read the waitlist either', async () => {
    const { db } = await signIn('A');
    const { data } = await db.from('waitlist_signups').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  writes(
    'a signed-in founder can also join the waitlist (no auth required, none forbidden)',
    async () => {
      const { db } = await signIn('B');
      const { error } = await db.from('waitlist_signups').insert({
        email: `${RUN}-founder-b@example.dev`.toLowerCase(),
        first_name: 'Founder',
        last_name: 'B',
        source: TEST_SOURCE,
      });
      expect(error).toBeNull();
    },
  );

  describe('rate limiting (the anon grant extension this migration adds)', () => {
    it('an anonymous caller can now invoke consume_rate_limit, and it denies past the limit', async () => {
      const anon = anonClient();
      const scope = `${RUN}-waitlist-rate-test`;
      const subject = `${RUN}-rate-subject`;

      let lastAllowed = true;
      for (let i = 0; i < 6; i++) {
        const { data, error } = await anon.rpc('consume_rate_limit', {
          p_scope: scope,
          p_subject_id: subject,
          p_window_seconds: 3600,
          p_limit: 5,
        });
        expect(error).toBeNull(); // anon can call it at all — the grant this migration adds
        lastAllowed = Boolean(data?.[0]?.allowed);
      }
      // The 6th call against a limit of 5 must be denied.
      expect(lastAllowed).toBe(false);
    });
  });
});

/**
 * Survey + pilot recruitment (20261017160038_waitlist_survey_and_recruitment).
 *
 * Proves, live: the public can still only INSERT the contact columns; survey
 * answers reach a row only through the token-gated function; recruitment is
 * invisible and immutable to visitors and founders; and only a
 * platform administrator can read the list or change recruitment (see
 * tests/rls/admin.test.ts) — and even then never the token hash.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — waitlist survey and recruitment', () => {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const email = `${RUN}-survey@example.dev`.toLowerCase();

  writes('a visitor can insert a signup carrying a survey token hash and a phone', async () => {
    const { error } = await anonClient().from('waitlist_signups').insert({
      email,
      first_name: 'Survey',
      last_name: 'Tester',
      phone: '(242) 555-0123',
      source: TEST_SOURCE,
      survey_token_hash: tokenHash,
    });
    expect(error).toBeNull();
  });

  it('a visitor cannot set recruitment status, survey answers or a signup date at insert', async () => {
    const attempts = [
      { recruitment_status: 'confirmed' },
      { testing_interest: 'yes' },
      { created_at: '2020-01-01T00:00:00Z' },
    ];
    for (const [i, extra] of attempts.entries()) {
      const { error } = await anonClient()
        .from('waitlist_signups')
        .insert({
          email: `${RUN}-sneaky-${i}@example.dev`,
          first_name: 'X',
          last_name: 'Y',
          ...extra,
        } as never);
      expect(error).not.toBeNull(); // column-level INSERT grant excludes these
    }
  });

  it('the database rejects a malformed phone number', async () => {
    const { error } = await anonClient()
      .from('waitlist_signups')
      .insert({
        email: `${RUN}-bad-phone@example.dev`,
        first_name: 'X',
        last_name: 'Y',
        phone: 'call me',
      });
    expect(error).not.toBeNull(); // ws_phone_format
  });

  writes(
    'the survey function accepts the right token and reveals nothing for a wrong one',
    async () => {
      const anon = anonClient();
      // PostgREST resolves functions by their full named-argument list, and this
      // one has no defaults: every call sends all seven (the app always does).
      const answers = {
        p_country: 'The Bahamas',
        p_city_island: 'Exuma',
        p_business_stage: 'trying_to_register' as const,
        p_biggest_challenge: 'other' as const,
        p_challenge_other: 'Finding a shop',
        p_testing_interest: 'yes' as const,
      };

      const wrong = await anon.rpc('submit_waitlist_survey', {
        p_token: randomBytes(32).toString('base64url'),
        ...answers,
      });
      expect(wrong.error).toBeNull();
      expect(wrong.data).toBe(false);

      const right = await anon.rpc('submit_waitlist_survey', { p_token: token, ...answers });
      expect(right.error).toBeNull();
      expect(right.data).toBe(true);

      // Submitting again updates the same row — it never creates another.
      const again = await anon.rpc('submit_waitlist_survey', {
        p_token: token,
        ...answers,
        p_business_stage: 'already_operating',
      });
      expect(again.data).toBe(true);
    },
  );

  it('a visitor still cannot read anything back', async () => {
    const { data } = await anonClient()
      .from('waitlist_signups')
      .select('id, testing_interest')
      .eq('email', email);
    expect(data ?? []).toHaveLength(0);
  });

  it('a signed-in founder cannot read, change recruitment, or grant themselves a role', async () => {
    const { db, userId } = await signIn('A');

    const read = await db.from('waitlist_signups').select('id').eq('email', email);
    expect(read.data ?? []).toHaveLength(0);

    const update = await db
      .from('waitlist_signups')
      .update({ recruitment_status: 'tested' })
      .eq('email', email)
      .select('id');
    expect(update.data ?? []).toHaveLength(0); // RLS: no visible row to update

    const grant = await db
      .from('staff_members')
      .insert({ user_id: userId, role: 'waitlist_admin' });
    expect(grant.error).not.toBeNull(); // no INSERT grant or policy

    const tokenRead = await db.from('waitlist_signups').select('survey_token_hash').limit(1);
    expect(tokenRead.error).not.toBeNull(); // no column grant, for anyone
  });

  writes('the expanded questionnaire saves partially by token, merging sections', async () => {
    const anon = anonClient();
    const wrong = await anon.rpc('save_waitlist_survey', {
      p_token: randomBytes(32).toString('base64url'),
      p_answers: { country: 'Barbados' },
      p_final: false,
    });
    expect(wrong.error).toBeNull();
    expect(wrong.data).toBe(false);

    const sectionA = await anon.rpc('save_waitlist_survey', {
      p_token: token,
      p_answers: {
        industry: 'other',
        industryOther: 'Boat repair',
        businessJourney: 'established_business',
      },
      p_final: false,
    });
    expect(sectionA.data).toBe(true);

    // A later section never erases an earlier one; unknown keys (an attempt to
    // set recruitment through the public door) are ignored.
    const sectionD = await anon.rpc('save_waitlist_survey', {
      p_token: token,
      p_answers: {
        additionalInfo: 'Need a licence',
        recruitmentStatus: 'tested',
        recruitment_status: 'tested',
      },
      p_final: true,
    });
    expect(sectionD.data).toBe(true);

    const own = await anon.rpc('get_waitlist_survey', { p_token: token });
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({
      industry: 'other',
      industryOther: 'Boat repair',
      businessJourney: 'established_business',
      additionalInfo: 'Need a licence',
      completed: true,
    });
    // The answers read back carry no contact or recruitment data.
    expect(JSON.stringify(own.data)).not.toContain(email);
    expect(own.data).not.toHaveProperty('recruitmentStatus');

    const nobody = await anon.rpc('get_waitlist_survey', {
      p_token: randomBytes(32).toString('base64url'),
    });
    expect(nobody.data).toBeNull();
  });

  writes('the database rejects an invalid answer and an orphaned "Other" explanation', async () => {
    const anon = anonClient();
    const bad = await anon.rpc('save_waitlist_survey', {
      p_token: token,
      p_answers: { industry: 'unicorns' },
      p_final: false,
    });
    expect(bad.error).not.toBeNull();

    // Switching away from "Other" clears its explanation rather than violating the check.
    const switched = await anon.rpc('save_waitlist_survey', {
      p_token: token,
      p_answers: { industry: 'technology_software' },
      p_final: false,
    });
    expect(switched.error).toBeNull();
    const own = await anon.rpc('get_waitlist_survey', { p_token: token });
    expect(own.data).toMatchObject({ industry: 'technology_software', industryOther: null });
  });

  writes(
    'goals and challenges are multi-select, with exclusive answers and no duplicates',
    async () => {
      const anon = anonClient();
      const save = (answers: { [key: string]: Json }) =>
        anon.rpc('save_waitlist_survey', { p_token: token, p_answers: answers, p_final: false });

      const several = await save({
        primaryGoals: ['clear_plan', 'funding_investment', 'other'],
        goalOther: 'Import duties',
        challenges: ['finding_customers', 'marketing'],
      });
      expect(several.error).toBeNull();
      let own = await anon.rpc('get_waitlist_survey', { p_token: token });
      expect(own.data).toMatchObject({
        primaryGoals: ['clear_plan', 'funding_investment', 'other'],
        goalOther: 'Import duties',
        challenges: ['finding_customers', 'marketing'],
        // The single-value columns mirror the first selection for older readers.
        primaryGoal: 'clear_plan',
        biggestChallenge: 'finding_customers',
      });

      // A section that does not mention goals leaves them alone (partial save).
      expect((await save({ testingInterest: 'yes' })).error).toBeNull();
      own = await anon.rpc('get_waitlist_survey', { p_token: token });
      expect(own.data).toMatchObject({
        primaryGoals: ['clear_plan', 'funding_investment', 'other'],
      });

      // Exclusive answers cannot be combined; duplicates are refused.
      expect((await save({ primaryGoals: ['not_sure_yet', 'clear_plan'] })).error).not.toBeNull();
      expect(
        (await save({ challenges: ['several_challenges', 'marketing'] })).error,
      ).not.toBeNull();
      expect((await save({ primaryGoals: ['clear_plan', 'clear_plan'] })).error).not.toBeNull();
      expect((await save({ primaryGoals: ['not_sure_yet'] })).error).toBeNull();

      // Dropping "Other" clears its explanation; an empty list clears the answer.
      own = await anon.rpc('get_waitlist_survey', { p_token: token });
      expect(own.data).toMatchObject({ primaryGoals: ['not_sure_yet'], goalOther: null });
      expect((await save({ challenges: null })).error).toBeNull();
      own = await anon.rpc('get_waitlist_survey', { p_token: token });
      expect(own.data).toMatchObject({ challenges: [], biggestChallenge: null });

      // The older single-value keys are still accepted.
      expect((await save({ biggestChallenge: 'marketing' })).error).toBeNull();
      own = await anon.rpc('get_waitlist_survey', { p_token: token });
      expect(own.data).toMatchObject({ challenges: ['marketing'] });
    },
  );

  describe.skipIf(!adminConfigured)('stored state, checked with the service role', () => {
    writes('answering never touched recruitment, and completion is stamped once', async () => {
      const { data, error } = await adminClient()
        .from('waitlist_signups')
        .select(
          'phone, survey_completed_at, survey_started_at, recruitment_status, recruitment_updated_at, recruitment_tested_on',
        )
        .eq('email', email)
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({
        phone: '(242) 555-0123',
        recruitment_status: 'not_contacted',
        recruitment_updated_at: null,
        recruitment_tested_on: null,
      });
      expect(data?.survey_completed_at).not.toBeNull();
      expect(data?.survey_started_at).not.toBeNull();
    });
  });
});

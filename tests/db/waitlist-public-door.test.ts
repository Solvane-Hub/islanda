// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, databaseAt } from './harness';

/**
 * The public waitlist door, at the database layer, without production.
 *
 * The nine tests in tests/rls/waitlist.test.ts that write a signup skip against
 * the production project (tests/rls/client.ts). These are the same statements
 * under the same roles, against an isolated database with every migration
 * applied — they prove grants, RLS policies, constraints and functions. They do
 * not exercise Supabase Auth or PostgREST; the RLS suite still needs a
 * dedicated Supabase test project for that.
 */
const RUN = `rlstest-${Date.now()}`;
const email = `${RUN}-waitlist@example.dev`;
const surveyEmail = `${RUN}-survey@example.dev`;
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const wrongToken = () => randomBytes(32).toString('base64url');

let db: PGlite;
let founderB: string;
const anon = <T>(fn: (tx: Transaction) => Promise<T>) => as(db, { role: 'anon' }, fn);
const insert = (tx: Transaction, row: Record<string, string>) => {
  const cols = Object.keys(row);
  return tx.query(
    `insert into public.waitlist_signups (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
};
async function save(t: string, answers: Record<string, unknown>, final = false): Promise<boolean> {
  const r = await anon((tx) =>
    tx.query<{ ok: boolean }>('select public.save_waitlist_survey($1, $2::jsonb, $3) ok', [
      t,
      JSON.stringify(answers),
      final,
    ]),
  );
  return r.rows[0]!.ok;
}
async function read(t: string) {
  const r = await anon((tx) =>
    tx.query<{ a: Record<string, unknown> | null }>('select public.get_waitlist_survey($1) a', [t]),
  );
  return r.rows[0]!.a;
}

beforeAll(async () => {
  // The latest schema, including any migration not yet applied to production.
  db = await databaseAt('99999999999999');
  const b = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at) values ('b@foundryai-test.dev', now()) returning id`,
  );
  founderB = b.rows[0]!.id;
}, 180_000);

describe('public waitlist door (isolated database)', () => {
  it('1. an anonymous visitor can INSERT a signup', async () => {
    await anon((tx) =>
      insert(tx, { email, first_name: 'Founder', last_name: 'Founder', source: 'rls_test' }),
    );
  });

  it('2. the database rejects a duplicate email regardless of case', async () => {
    await expect(
      anon((tx) =>
        insert(tx, {
          email: email.toUpperCase(),
          first_name: 'Founder',
          last_name: 'Founder',
          source: 'rls_test',
        }),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('3. a signed-in founder can also join the waitlist', async () => {
    await as(db, { role: 'authenticated', sub: founderB, aal: 'aal1' }, (tx) =>
      insert(tx, {
        email: `${RUN}-founder-b@example.dev`,
        first_name: 'Founder',
        last_name: 'B',
        source: 'rls_test',
      }),
    );
  });

  it('4. a visitor can insert a signup carrying a survey token hash and a phone', async () => {
    await anon((tx) =>
      insert(tx, {
        email: surveyEmail,
        first_name: 'Survey',
        last_name: 'Tester',
        phone: '(242) 555-0123',
        source: 'rls_test',
        survey_token_hash: tokenHash,
      }),
    );
  });

  it('5. the original survey function accepts the right token, reveals nothing for a wrong one, and never adds a row', async () => {
    const call = (t: string, stage: string) =>
      anon((tx) =>
        tx.query<{ ok: boolean }>(
          `select public.submit_waitlist_survey($1, 'The Bahamas', 'Exuma', $2::public.waitlist_business_stage, 'other', 'Finding a shop', 'yes') ok`,
          [t, stage],
        ),
      ).then((r) => r.rows[0]!.ok);
    expect(await call(wrongToken(), 'trying_to_register')).toBe(false);
    expect(await call(token, 'trying_to_register')).toBe(true);
    expect(await call(token, 'already_operating')).toBe(true);
    const { rows } = await db.query<{ n: string }>(
      `select count(*) n from public.waitlist_signups where lower(email) = $1`,
      [surveyEmail],
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it('6. the questionnaire saves partially by token, merging sections, and reads back only answers', async () => {
    expect(await save(wrongToken(), { country: 'Barbados' })).toBe(false);
    expect(
      await save(token, {
        industry: 'other',
        industryOther: 'Boat repair',
        businessJourney: 'established_business',
      }),
    ).toBe(true);
    expect(
      await save(
        token,
        {
          additionalInfo: 'Need a licence',
          recruitmentStatus: 'tested',
          recruitment_status: 'tested',
        },
        true,
      ),
    ).toBe(true);
    const own = await read(token);
    expect(own).toMatchObject({
      industry: 'other',
      industryOther: 'Boat repair',
      businessJourney: 'established_business',
      additionalInfo: 'Need a licence',
      completed: true,
    });
    expect(JSON.stringify(own)).not.toContain(surveyEmail);
    expect(own).not.toHaveProperty('recruitmentStatus');
    expect(await read(wrongToken())).toBeNull();
  });

  it('7. the database rejects an invalid answer and clears an orphaned "Other"', async () => {
    await expect(save(token, { industry: 'unicorns' })).rejects.toThrow(/invalid input value/);
    expect(await save(token, { industry: 'technology_software' })).toBe(true);
    expect(await read(token)).toMatchObject({
      industry: 'technology_software',
      industryOther: null,
    });
  });

  it('8. goals and challenges are multi-select, with exclusive answers and no duplicates', async () => {
    expect(
      await save(token, {
        primaryGoals: ['clear_plan', 'funding_investment', 'other'],
        goalOther: 'Import duties',
        challenges: ['finding_customers', 'marketing'],
      }),
    ).toBe(true);
    expect(await save(token, { testingInterest: 'yes' })).toBe(true);
    expect(await read(token)).toMatchObject({
      primaryGoals: ['clear_plan', 'funding_investment', 'other'],
      primaryGoal: 'clear_plan',
      biggestChallenge: 'finding_customers',
    });
    await expect(save(token, { primaryGoals: ['not_sure_yet', 'clear_plan'] })).rejects.toThrow();
    await expect(
      save(token, { challenges: ['several_challenges', 'marketing'] }),
    ).rejects.toThrow();
    await expect(save(token, { primaryGoals: ['clear_plan', 'clear_plan'] })).rejects.toThrow();
    expect(await save(token, { primaryGoals: ['not_sure_yet'] })).toBe(true);
    expect(await read(token)).toMatchObject({ primaryGoals: ['not_sure_yet'], goalOther: null });
    expect(await save(token, { challenges: null })).toBe(true);
    expect(await read(token)).toMatchObject({ challenges: [] });
    expect(await save(token, { biggestChallenge: 'marketing' })).toBe(true);
    expect(await read(token)).toMatchObject({ challenges: ['marketing'] });
  });

  it('9. answering never touched recruitment, and completion is stamped once', async () => {
    const { rows } = await as(db, { role: 'service_role' }, (tx) =>
      tx.query<Record<string, unknown>>(
        `select phone, survey_completed_at, survey_started_at, recruitment_status::text, recruitment_updated_at, recruitment_tested_on
         from public.waitlist_signups where email = $1`,
        [surveyEmail],
      ),
    );
    expect(rows[0]).toMatchObject({
      phone: '(242) 555-0123',
      recruitment_status: 'not_contacted',
      recruitment_updated_at: null,
      recruitment_tested_on: null,
    });
    expect(rows[0]!.survey_completed_at).not.toBeNull();
    expect(rows[0]!.survey_started_at).not.toBeNull();
  });
});

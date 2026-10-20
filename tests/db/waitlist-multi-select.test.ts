// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, databaseAt, MIGRATIONS_DIR, readSql } from './harness';

/**
 * 20261019200000_waitlist_multi_select against an isolated database built from
 * every earlier migration, seeded with rows shaped like production's.
 *
 * The four functions the migration replaces were compared with production on
 * 2026-10-20 (md5 of pg_get_functiondef, read-only): the definitions replayed
 * here are byte-identical, so "before" here is production's "before".
 */
const PRODUCTION_BEFORE_MD5: Record<string, string> = {
  admin_waitlist_insights: '1fcbdb8b683996e04938e4e199d7564c',
  admin_web_analytics: '2c8a3d850d7641a337d9ca4cd391d2d7',
  get_waitlist_survey: '55d0958e07cdf473eac55f4b6a33f9b0',
  save_waitlist_survey: '94ccf483a7ed65dbdd74ba16ad3400a5',
};
const MIGRATION = readSql(path.join(MIGRATIONS_DIR, '20261019200000_waitlist_multi_select.sql'));
const LAST_NAME = readSql(path.join(MIGRATIONS_DIR, '20260928000000_add_waitlist_last_name.sql'));
const ROLLBACK = readSql(
  path.join(
    process.cwd(),
    'supabase',
    'rollbacks',
    '20261019200000_waitlist_multi_select.down.sql',
  ),
);

// The same fingerprint expression as the read-only production baseline.
const FINGERPRINT = `select md5(string_agg(id::text||'|'||coalesce(primary_goal::text,'')||'|'||coalesce(biggest_challenge::text,'')||'|'||coalesce(goal_other,'')||'|'||coalesce(challenge_other,'')||'|'||updated_at::text||'|'||coalesce(recruitment_updated_at::text,''), ',' order by id)) as fp from public.waitlist_signups`;
const TEST_SOURCE_SQL = `('rls_test','e2e_test','development','preview')`;

const token = (n: number) => `${'t'.repeat(40)}${String(n).padStart(3, '0')}`;
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
type Answers = Record<string, unknown>;

let db: PGlite;
let adminId: string;
let before: string;

const anon = <T>(fn: (tx: Transaction) => Promise<T>) => as(db, { role: 'anon' }, fn);
const asAdmin = <T>(fn: (tx: Transaction) => Promise<T>, aal: 'aal1' | 'aal2' = 'aal2') =>
  as(db, { role: 'authenticated', sub: adminId, aal }, fn);
async function save(t: string, answers: Answers): Promise<boolean> {
  const r = await anon((tx) =>
    tx.query<{ ok: boolean }>('select public.save_waitlist_survey($1, $2::jsonb, false) as ok', [
      t,
      JSON.stringify(answers),
    ]),
  );
  return r.rows[0]!.ok;
}
async function read(t: string): Promise<Answers | null> {
  const r = await anon((tx) =>
    tx.query<{ a: Answers | null }>('select public.get_waitlist_survey($1) as a', [t]),
  );
  return r.rows[0]!.a;
}
const fingerprint = async () => (await db.query<{ fp: string }>(FINGERPRINT)).rows[0]!.fp;

beforeAll(async () => {
  db = await databaseAt('20261019171608');
  // Production-shaped rows: legacy single answers, "Other" with text, a test
  // domain, recruitment data, a retired challenge, rows with no answers.
  const rows: [number, string, string | null, string | null, string | null][] = [
    [1, 'ada@gmail.com', 'clear_plan', 'other', 'Shipping costs'],
    [2, 'bo@gmail.com', 'licences_permits_approvals', 'finding_customers', null],
    [3, 'cy@gmail.com', null, 'other', 'Rent'],
    [4, 'qa@example.dev', 'next_steps', 'marketing', null],
    [5, 'dee@gmail.com', null, null, null],
    [6, 'old@gmail.com', null, 'managing_business', null],
  ];
  for (const [n, email, goal, challenge, other] of rows) {
    await db.query(
      `insert into public.waitlist_signups (email, first_name, last_name, source, survey_token_hash,
         primary_goal, biggest_challenge, challenge_other, created_at, survey_started_at)
       values ($1, 'Test', 'Person', 'landing_page', $2, $3, $4, $5, now() - interval '2 days', now() - interval '2 days')`,
      [email, hash(token(n)), goal, challenge, other],
    );
  }
  await db.query(
    `update public.waitlist_signups set recruitment_status = 'contacted' where email = 'ada@gmail.com'`,
  );
  const admin = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at) values ('jamilnash@solvanehub.us', now()) returning id`,
  );
  adminId = admin.rows[0]!.id;
  await db.query(
    `insert into public.platform_admins (user_id, email, display_name, provisioned_by)
     values ($1, 'jamilnash@solvanehub.us', 'Isolated test admin', 'tests/db')`,
    [adminId],
  );

  const { rows: defs } = await db.query<{ proname: string; m: string }>(
    `select p.proname, md5(pg_get_functiondef(p.oid)) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any($1)`,
    [Object.keys(PRODUCTION_BEFORE_MD5)],
  );
  for (const d of defs)
    expect(d.m, `${d.proname} differs from production`).toBe(PRODUCTION_BEFORE_MD5[d.proname]);

  before = await fingerprint();
  await db.exec(MIGRATION);
}, 180_000);

describe('20261019200000 — data and schema', () => {
  it('leaves every existing answer, updated_at and recruitment_updated_at unchanged', async () => {
    expect(await fingerprint()).toBe(before);
  });

  it('backfills each single answer as a one-item list, and keeps blanks blank', async () => {
    const { rows } = await db.query<{
      g: string | null;
      c: string | null;
      gs: string[] | null;
      cs: string[] | null;
    }>(
      `select primary_goal::text g, biggest_challenge::text c, primary_goals::text[] gs, challenges::text[] cs from public.waitlist_signups`,
    );
    for (const r of rows) {
      expect(r.gs).toEqual(r.g ? [r.g] : null);
      expect(r.cs).toEqual(r.c ? [r.c] : null);
    }
    expect(rows.find((r) => r.c === 'managing_business')?.cs).toEqual(['managing_business']);
  });

  it('adds validated constraints', async () => {
    const { rows } = await db.query<{ conname: string; convalidated: boolean }>(
      `select conname, convalidated from pg_constraint where conrelid = 'public.waitlist_signups'::regclass and conname = any($1)`,
      [
        [
          'ws_primary_goals_shape',
          'ws_primary_goals_exclusive',
          'ws_challenges_shape',
          'ws_challenges_exclusive',
          'ws_goal_other_only_for_other',
          'ws_challenge_other_only_for_other',
        ],
      ],
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.convalidated)).toBe(true);
  });

  it('keeps every write path working under the new constraints (anon signup, admin, service role)', async () => {
    // Regression: the constraint helper was once not executable by anon, which
    // would have refused every public signup.
    await anon((tx) =>
      tx.query(
        `insert into public.waitlist_signups (email, first_name, last_name, source) values ('new@gmail.com', 'New', 'Person', 'landing_page')`,
      ),
    );
    await asAdmin((tx) =>
      tx.query(
        `update public.waitlist_signups set recruitment_status = 'contacted' where email = 'bo@gmail.com'`,
      ),
    );
    await as(db, { role: 'service_role' }, (tx) =>
      tx.query(
        `update public.waitlist_signups set first_name = first_name where email = 'new@gmail.com'`,
      ),
    );
  });

  it('exposes nothing new: anon cannot read the columns, a non-admin reads no rows, privileges as before', async () => {
    await expect(
      anon((tx) => tx.query('select primary_goals from public.waitlist_signups')),
    ).rejects.toThrow(/permission denied/);
    const nonAdmin = await as(db, { role: 'authenticated', sub: randomUUID(), aal: 'aal2' }, (tx) =>
      tx.query('select primary_goals, challenges from public.waitlist_signups'),
    );
    expect(nonAdmin.rows).toHaveLength(0);
    const { rows } = await db.query<{ proname: string; anon_x: boolean }>(
      `select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_x
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.proname in ('save_waitlist_survey','get_waitlist_survey','admin_waitlist_insights','admin_web_analytics','is_test_signup')`,
    );
    expect(Object.fromEntries(rows.map((r) => [r.proname, r.anon_x]))).toEqual({
      save_waitlist_survey: true,
      get_waitlist_survey: true,
      admin_waitlist_insights: false,
      admin_web_analytics: false,
      is_test_signup: false,
    });
  });
});

describe('20261019200000 — token-gated questionnaire', () => {
  it('reads a legacy single answer as a list, with the legacy keys too', async () => {
    expect(await read(token(1))).toMatchObject({
      primaryGoals: ['clear_plan'],
      primaryGoal: 'clear_plan',
      challenges: ['other'],
      challengeOther: 'Shipping costs',
    });
  });

  it('saves every choice in order, mirrors the first, and leaves it alone on later sections', async () => {
    expect(
      await save(token(2), {
        primaryGoals: ['funding_investment', 'clear_plan', 'other'],
        goalOther: 'Import duties',
        challenges: ['marketing', 'finding_customers'],
      }),
    ).toBe(true);
    expect(await save(token(2), { testingInterest: 'yes' })).toBe(true);
    expect(await read(token(2))).toMatchObject({
      primaryGoals: ['funding_investment', 'clear_plan', 'other'],
      primaryGoal: 'funding_investment',
      goalOther: 'Import duties',
      challenges: ['marketing', 'finding_customers'],
      biggestChallenge: 'marketing',
      testingInterest: 'yes',
    });
  });

  it("still accepts the previous release's single keys", async () => {
    expect(
      await save(token(3), {
        primaryGoal: 'next_steps',
        biggestChallenge: 'other',
        challengeOther: 'Still rent',
      }),
    ).toBe(true);
    expect(await read(token(3))).toMatchObject({
      primaryGoals: ['next_steps'],
      challenges: ['other'],
      challengeOther: 'Still rent',
    });
  });

  it('refuses combined exclusive answers, duplicates and unknown values — and a refused save changes nothing', async () => {
    const was = await read(token(5));
    await expect(save(token(5), { primaryGoals: ['not_sure_yet', 'clear_plan'] })).rejects.toThrow(
      /ws_primary_goals_exclusive/,
    );
    await expect(
      save(token(5), { challenges: ['several_challenges', 'marketing'] }),
    ).rejects.toThrow(/ws_challenges_exclusive/);
    await expect(save(token(5), { primaryGoals: ['clear_plan', 'clear_plan'] })).rejects.toThrow(
      /ws_primary_goals_shape/,
    );
    await expect(save(token(5), { challenges: ['unicorns'] })).rejects.toThrow(
      /invalid input value/,
    );
    expect(await read(token(5))).toEqual(was);
    expect(
      await save(token(5), { primaryGoals: ['not_sure_yet'], challenges: ['several_challenges'] }),
    ).toBe(true);
  });

  it('clears "Other" text when "Other" is dropped, keeps it when "Other" is not first, and clears on an empty list', async () => {
    expect(await save(token(1), { challenges: ['finding_customers', 'other'] })).toBe(true);
    expect((await read(token(1)))?.challengeOther).toBe('Shipping costs');
    expect(await save(token(2), { primaryGoals: ['clear_plan'] })).toBe(true);
    expect((await read(token(2)))?.goalOther).toBeNull();
    expect(await save(token(2), { challenges: [] })).toBe(true);
    expect(await read(token(2))).toMatchObject({ challenges: [], biggestChallenge: null });
  });

  it('saves nothing for an unknown token, and never lets the public door set recruitment', async () => {
    expect(await save(token(999), { primaryGoals: ['clear_plan'] })).toBe(false);
    expect(
      await save(token(1), { recruitmentStatus: 'tested', recruitment_status: 'tested' }),
    ).toBe(true);
    const { rows } = await db.query<{ s: string }>(
      `select recruitment_status::text s from public.waitlist_signups where email = 'ada@gmail.com'`,
    );
    expect(rows[0]!.s).toBe('contacted');
  });
});

describe('20261019200000 — admin reporting', () => {
  const range = [
    new Date(Date.now() - 7 * 864e5).toISOString(),
    new Date(Date.now() + 864e5).toISOString(),
  ];

  it('refuses anon, non-admins and admins without MFA', async () => {
    await expect(
      anon((tx) => tx.query('select public.admin_waitlist_insights($1, $2)', range)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, { role: 'authenticated', sub: randomUUID(), aal: 'aal2' }, (tx) =>
        tx.query('select public.admin_waitlist_insights($1, $2)', range),
      ),
    ).rejects.toThrow(/forbidden/);
    await expect(
      asAdmin((tx) => tx.query('select public.admin_waitlist_insights($1, $2)', range), 'aal1'),
    ).rejects.toThrow(/forbidden/);
  });

  it('counts respondents and selections separately, excluding test signups by domain and source', async () => {
    await db.query(
      `insert into public.waitlist_signups (email, first_name, source, primary_goals, primary_goal) values ('preview@gmail.com', 'P', 'preview', '{clear_plan}', 'clear_plan')`,
    );
    type Insights = { totals: Record<string, number>; goal: { count: number }[] };
    const r = (
      await asAdmin((tx) =>
        tx.query<{ j: Insights }>('select public.admin_waitlist_insights($1, $2) as j', range),
      )
    ).rows[0]!.j;
    const e = (
      await db.query<Record<string, string>>(`
        select count(*) n,
          count(*) filter (where cardinality(coalesce(primary_goals,'{}')) > 0) gr, coalesce(sum(cardinality(primary_goals)),0) gs,
          count(*) filter (where cardinality(coalesce(challenges,'{}')) > 0) cr, coalesce(sum(cardinality(challenges)),0) cs
        from public.waitlist_signups where not app.is_test_email(email) and source not in ${TEST_SOURCE_SQL}`)
    ).rows[0]!;
    expect(r.totals).toMatchObject({
      signups: Number(e.n),
      goal_respondents: Number(e.gr),
      goal_selections: Number(e.gs),
      challenge_respondents: Number(e.cr),
      challenge_selections: Number(e.cs),
      test_records_excluded: 2,
    });
    expect(r.goal.reduce((s, x) => s + x.count, 0)).toBe(r.totals.goal_selections);
  });

  it('web analytics still runs and excludes source-tagged signups', async () => {
    const r = (
      await asAdmin((tx) =>
        tx.query<{ j: { totals: Record<string, number> } }>(
          'select public.admin_web_analytics($1, $2) as j',
          range,
        ),
      )
    ).rows[0]!.j;
    expect(r.totals.test_signups_excluded).toBe(2);
  });

  it("serves the admin list's exact columns and new filters to an MFA admin, and nothing without MFA", async () => {
    const source = readSql(path.join(process.cwd(), 'lib', 'db', 'waitlist.ts'));
    const cols = /const ENTRY_COLUMNS =\s*'([^']+)'/.exec(source)![1]!;
    const listed = await asAdmin((tx) =>
      tx.query<{ primary_goals: string[] }>(
        `select ${cols} from public.waitlist_signups
         where (source is null or source not in ${TEST_SOURCE_SQL})
           and primary_goals @> array['clear_plan']::public.waitlist_primary_goal[]`,
      ),
    );
    expect(listed.rows.length).toBeGreaterThan(0);
    expect(listed.rows.every((r) => r.primary_goals.includes('clear_plan'))).toBe(true);
    const noMfa = await asAdmin(
      (tx) => tx.query(`select ${cols} from public.waitlist_signups`),
      'aal1',
    );
    expect(noMfa.rows).toHaveLength(0);
  });

  it('keeps the single columns in step for the release live today', async () => {
    const { rows } = await db.query<{ n: string }>(
      `select count(*) n from public.waitlist_signups where primary_goals is not null and primary_goal is distinct from primary_goals[1]`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });
});

describe('20261019200000 — re-run and rollback', () => {
  it('a blind re-run fails and changes nothing', async () => {
    const fp = await fingerprint();
    await expect(db.exec(MIGRATION)).rejects.toThrow(/already exists/);
    await db.exec('rollback').catch(() => undefined);
    expect(await fingerprint()).toBe(fp);
  });

  it('20260928000000_add_waitlist_last_name is idempotent', async () => {
    await db.exec(LAST_NAME);
    const { rows } = await db.query<{ n: string }>(
      `select count(*) n from pg_constraint where conrelid = 'public.waitlist_signups'::regclass and conname = 'waitlist_signups_last_name_check'`,
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("the rollback restores production's exact functions and keeps every answer", async () => {
    const snapshot = `select id, primary_goal, biggest_challenge, goal_other, challenge_other, primary_goals::text, challenges::text from public.waitlist_signups order by id`;
    const keep = (await db.query(snapshot)).rows;
    await db.exec(ROLLBACK);
    const { rows } = await db.query<{ proname: string; m: string }>(
      `select p.proname, md5(pg_get_functiondef(p.oid)) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1)`,
      [Object.keys(PRODUCTION_BEFORE_MD5)],
    );
    for (const r of rows) expect(r.m, r.proname).toBe(PRODUCTION_BEFORE_MD5[r.proname]);
    expect((await db.query(snapshot)).rows).toEqual(keep);
    // The previous release works again, including a public signup.
    expect(await save(token(3), { primaryGoal: 'clear_plan' })).toBe(true);
    await anon((tx) =>
      tx.query(
        `insert into public.waitlist_signups (email, first_name, source) values ('after@gmail.com', 'A', 'landing_page')`,
      ),
    );
  });
});

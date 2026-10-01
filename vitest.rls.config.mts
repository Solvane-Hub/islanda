import { defineConfig, mergeConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import base from './vitest.config.mts';

/**
 * Vitest configuration for the Row Level Security suite.
 *
 * The RLS tests run against a REAL Supabase project with REAL authenticated
 * sessions (see tests/rls/client.ts) — mocking here would test the mock, not
 * the security boundary. They therefore need the same credentials the app uses,
 * which live in `.env.local` (gitignored, never committed).
 *
 * Vitest does not load `.env.local` into `process.env` on its own, so the base
 * config left `NEXT_PUBLIC_SUPABASE_*` and `RLS_TEST_USER_*` undefined. That is
 * why 50 tenant-isolation tests were silently SKIPPED: `rlsConfigured` was
 * false because the values never reached the worker. This config loads them and
 * hands them to the test environment via `test.env`.
 *
 * It also forces `RLS_TESTS_REQUIRED=1` regardless of what `.env.local` sets, so
 * `npm run test:rls` FAILS LOUDLY when a credential is missing rather than
 * quietly skipping a security suite. `tests/rls/client.ts` reads this flag and
 * the test files throw on `!rlsConfigured && rlsRequired`.
 *
 * No secret is committed here: values are read from `.env.local` at runtime.
 */
const fileEnv = loadEnv('', process.cwd(), '');
const rlsEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'RLS_TEST_USER_A_EMAIL',
  'RLS_TEST_USER_A_PASSWORD',
  'RLS_TEST_USER_B_EMAIL',
  'RLS_TEST_USER_B_PASSWORD',
  // Fixture seeding only (tests/rls/business-evidence.test.ts) — never used by
  // an assertion about what a tenant can see.
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

// Vitest merges `test.env` over the inherited process environment in workers.
// Preserve the runner-provided values (including GitHub Actions secrets) over
// dotenv values so a local .env file cannot shadow CI configuration.
const runnerRlsEnv = Object.fromEntries(
  rlsEnvKeys.flatMap((key) => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value]];
  }),
);

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // The `test:rls` script narrows execution to tests/rls with a positional
      // filter; this config only supplies the environment those tests need.
      // Every test here makes real network calls (auth, PostgREST, Storage),
      // which from a CI runner routinely exceed Vitest's 5s default.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      env: {
        ...fileEnv,
        ...runnerRlsEnv,
        // A missing credential must fail this suite, never skip it.
        RLS_TESTS_REQUIRED: '1',
      },
    },
  }),
);

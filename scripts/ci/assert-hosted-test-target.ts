/**
 * CI step: refuse to continue unless the hosted Supabase target is the declared
 * non-production test project. See hosted-test-target.ts. Never prints the URL.
 *
 *   npx tsx scripts/ci/assert-hosted-test-target.ts
 */
import { hostedTestTargetError } from './hosted-test-target';

const error = hostedTestTargetError(
  process.env.SUPABASE_URL,
  process.env.HOSTED_DB_TEST_PROJECT_REF,
);

if (error) {
  console.error(`::error::Refusing to run hosted database tests: ${error}`);
  process.exit(1);
}

console.log('Hosted database tests target the declared non-production project.');

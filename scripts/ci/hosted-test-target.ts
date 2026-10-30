/**
 * Guard for CI jobs that sign in to, or write fixtures into, a hosted Supabase
 * project (risk A4 in the CSB assessment).
 *
 * Turning the hosted jobs on with the repository variable HOSTED_DB_TESTS is not
 * enough. They may run only when the repository variable
 * HOSTED_DB_TEST_PROJECT_REF explicitly names a non-production project and the
 * SUPABASE_URL secret points at exactly that project. Anything else — an unset
 * or malformed ref, the production ref, or a URL for any other project — fails
 * closed before a credential is used.
 */
import { PRODUCTION_PROJECT_REF } from '../../tests/rls/client';

const PROJECT_REF = /^[a-z0-9]{20}$/;

/** Why the hosted tests must not run against this target, or null if they may. */
export function hostedTestTargetError(
  supabaseUrl: string | undefined,
  declaredRef: string | undefined,
): string | null {
  const ref = (declaredRef ?? '').trim();
  if (!PROJECT_REF.test(ref)) {
    return 'HOSTED_DB_TEST_PROJECT_REF is not set to a Supabase project ref.';
  }
  if (ref === PRODUCTION_PROJECT_REF) {
    return 'HOSTED_DB_TEST_PROJECT_REF names the production project.';
  }

  let url: URL;
  try {
    url = new URL(supabaseUrl ?? '');
  } catch {
    return 'SUPABASE_URL is not a valid URL.';
  }
  if (url.hostname.includes(PRODUCTION_PROJECT_REF)) {
    return 'SUPABASE_URL points at the production project.';
  }
  if (url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co`) {
    return 'SUPABASE_URL does not point at HOSTED_DB_TEST_PROJECT_REF.';
  }
  return null;
}

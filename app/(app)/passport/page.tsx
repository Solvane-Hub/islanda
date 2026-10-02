import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { assembleBusinessPassport } from '@/services/passport';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { PassportExperience } from './_components/passport-experience';

export const metadata: Metadata = { title: 'Business Passport' };

/**
 * Business Passport (Phase 1 — Cover, Identity, Business).
 *
 * Current-business resolution is identical to `/dashboard` and `/welcome`:
 * the same cookie, the same `resolveCurrentBusiness`, no new selection
 * mechanism. `assembleBusinessPassport` is the sole data source — nothing
 * here re-derives identity/definition a second way, and nothing extends or
 * projects the Passport contract beyond what it already returns.
 *
 * `null` (no business, or the resolved business's Passport isn't
 * accessible — the same RLS-scoped convention `assembleBusinessPassport`
 * itself uses) sends the founder to `/dashboard`, which already owns the
 * "create your first business" empty state — Passport doesn't need a second
 * copy of it.
 */
export default async function PassportPage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) redirect('/dashboard');

  const passport = await assembleBusinessPassport(db, current.id);
  if (!passport) redirect('/dashboard');

  return <PassportExperience passport={passport} />;
}

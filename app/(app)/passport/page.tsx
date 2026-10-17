import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { assembleBusinessPassport } from '@/services/passport';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { PassportExperience } from './_components/passport-experience';

export const metadata: Metadata = { title: 'My Business' };

/**
 * My Business — the Business Passport, introduced by what it is for.
 *
 * "Business Passport" is not self-explanatory to someone new, so the page is
 * titled by its job and the Passport name is kept as the secondary label. The
 * header is deliberately one line of explanation and one action: the document
 * below already organises the detail into pages, and the way to change
 * anything is the existing validated intake flow.
 *
 * Current-business resolution is identical to `/dashboard` and `/welcome`:
 * the same cookie, the same `resolveCurrentBusiness`, no new selection
 * mechanism. `assembleBusinessPassport` is the sole data source.
 *
 * `null` (no business, or the resolved business's Passport isn't accessible —
 * the same RLS-scoped convention `assembleBusinessPassport` itself uses) sends
 * the founder to `/dashboard`, which already owns the "create your first
 * business" empty state.
 */
export default async function PassportPage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) redirect('/dashboard');

  const passport = await assembleBusinessPassport(db, current.id);
  if (!passport) redirect('/dashboard');

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
        <div className="min-w-0">
          <p className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
            Business Passport
          </p>
          <h1 className="text-on-ink mt-1 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            My Business
          </h1>
          <p className="text-on-ink-muted mt-1 hidden max-w-xl text-sm text-pretty sm:block">
            Your business information, goals and records in one place. Turn the pages to see each
            part.
          </p>
        </div>
        <Link
          href="/intake/review"
          className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium transition-colors duration-150"
        >
          <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Edit business details
        </Link>
      </header>

      <PassportExperience passport={passport} />
    </div>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo-mark';
import { createClient } from '@/lib/supabase/server';
import { getWaitlistAdminAccess } from '@/services/waitlist/recruitment';
import { StaffSignInForm } from '../_components/staff-sign-in-form';

export const metadata: Metadata = { title: 'Team sign in' };

/**
 * Staff entrance. Works whether or not WAITLIST_ONLY_MODE is on; a successful
 * sign-in that does not carry the waitlist_admin role is signed straight back
 * out by the service, so this is not a way into the founder product.
 */
export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const db = await createClient();
  const access = await getWaitlistAdminAccess(db);
  if (access.kind === 'admin') redirect('/admin/waitlist');

  const { next } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <span className="text-on-ink inline-flex w-fit">
          <Logo height={24} />
        </span>
        <h1 className="text-on-ink text-[1.75rem] font-semibold tracking-[-0.02em]">
          Team sign in
        </h1>
        <p className="text-foreground-muted text-sm text-pretty">
          For Solvane Hub team members with waitlist access. Founders do not need to sign in here.
        </p>
      </header>

      <StaffSignInForm {...(next ? { next } : {})} />
    </div>
  );
}

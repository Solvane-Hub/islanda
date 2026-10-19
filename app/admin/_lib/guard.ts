import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { newCorrelationId } from '@/lib/errors';
import { getAdminAccess, recordAdminPageDenied, type AdminIdentity } from '@/services/admin/access';
import type { RequestContext } from '@/services/auth';

/**
 * Page guard for the admin portal. Every admin page calls this itself —
 * layouts are not re-run on client navigation, so a layout check alone is
 * not enough. Postgres refuses the data anyway unless the caller is a
 * platform administrator on an MFA session.
 *
 *   signed out          → /admin/login
 *   temporary password  → /admin/account/password
 *   MFA not yet done    → /admin/mfa
 *   anyone else         → 404 (the page does not confirm it exists), audited
 */
export async function requireAdminPage(
  currentPath: string,
  options: { auditDenied?: boolean } = {},
): Promise<AdminIdentity> {
  const db = await createClient();
  const access = await getAdminAccess(db);
  switch (access.kind) {
    case 'admin':
      return { userId: access.userId, email: access.email, displayName: access.displayName };
    case 'signed_out':
      redirect(`/admin/login?next=${encodeURIComponent(currentPath)}`);
    case 'password_change':
      redirect('/admin/account/password');
    case 'mfa_enroll':
    case 'mfa_verify':
      redirect(`/admin/mfa?next=${encodeURIComponent(currentPath)}`);
    case 'denied':
      // The portal layout and the page both run this guard for one request;
      // only the page records the denial, so each attempt is audited once.
      if (options.auditDenied !== false) await recordAdminPageDenied(access.userId, currentPath);
      notFound();
  }
}

export async function adminRequestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    correlationId: newCorrelationId(),
    // Client-controllable; audit context only, never authorization.
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

/** Only same-origin admin paths are followed after sign-in or MFA. */
export function safeAdminNext(requested: string | null | undefined, fallback = '/admin'): string {
  const value = String(requested ?? '');
  if (
    !value.startsWith('/admin') ||
    value.startsWith('//') ||
    value.includes('://') ||
    value.includes('\\')
  ) {
    return fallback;
  }
  if (/^\/admin\/(login|mfa|forgot-password|reset-password)(\/|$|\?)/.test(value)) return fallback;
  return value;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import { isAllowlistedEmail } from '@/lib/admin/allowlist';
import { readAdminAccess } from '@/lib/db/admin';
import { recordAuditEvent } from '@/services/audit';
import type { RequestContext } from '@/services/auth';

/**
 * Owner-only admin access. The single decision point the admin pages, Server
 * Actions and route handlers all call — but NOT the security boundary on its
 * own: every admin query is also refused by Postgres unless
 * `app.is_platform_admin()` holds (provisioned id + unchanged confirmed
 * email + MFA session). A bug here therefore shows an empty page, not data.
 *
 * Order of checks for a signed-in user:
 *   1. verified session — `getUser()`, which revalidates with the auth server;
 *   2. allowlisted email (trusted server config) AND a provisioned
 *      `platform_admins` row whose identity still matches (database);
 *   3. a pending temporary-password change (server-controlled app_metadata);
 *   4. MFA: enrol a TOTP authenticator, or verify one, until the session is aal2.
 *
 * Never trusts a client value, a query parameter, user-editable metadata or
 * an email on its own.
 */

type Db = SupabaseClient<Database>;

export interface AdminIdentity {
  userId: string;
  email: string;
  displayName: string;
}

export type AdminAccess =
  | { kind: 'signed_out' }
  | { kind: 'denied'; userId: string }
  | ({ kind: 'password_change' } & AdminIdentity)
  | ({ kind: 'mfa_enroll' } & AdminIdentity)
  | ({ kind: 'mfa_verify'; factorId: string } & AdminIdentity)
  | ({ kind: 'admin' } & AdminIdentity);

/** Fails closed: any error while checking is treated as "denied". */
export async function getAdminAccess(db: Db): Promise<AdminAccess> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { kind: 'signed_out' };

  try {
    if (!isAllowlistedEmail(user.email) || !user.email_confirmed_at) {
      return { kind: 'denied', userId: user.id };
    }
    const row = await readAdminAccess(db);
    if (!row.allowlisted) return { kind: 'denied', userId: user.id };

    const identity: AdminIdentity = {
      userId: user.id,
      email: user.email!.toLowerCase(),
      displayName: row.display_name ?? user.email!,
    };

    if (user.app_metadata?.password_change_required === true) {
      return { kind: 'password_change', ...identity };
    }

    if (row.aal !== 'aal2') {
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) return { kind: 'denied', userId: user.id };
      const verified = data.totp.find((f) => f.status === 'verified');
      return verified
        ? { kind: 'mfa_verify', factorId: verified.id, ...identity }
        : { kind: 'mfa_enroll', ...identity };
    }

    return { kind: 'admin', ...identity };
  } catch {
    return { kind: 'denied', userId: user.id };
  }
}

/** For admin Server Actions and route handlers. Throws FORBIDDEN unless fully authorized. */
export async function requireAdmin(db: Db, ctx: RequestContext = {}): Promise<AdminIdentity> {
  const access = await getAdminAccess(db);
  if (access.kind === 'admin') {
    return { userId: access.userId, email: access.email, displayName: access.displayName };
  }
  if (access.kind === 'denied') {
    await recordAuditEvent({
      event: 'admin.access_denied',
      actorId: access.userId,
      correlationId: ctx.correlationId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { surface: 'action' },
    });
  }
  throw new AppError({
    code: 'FORBIDDEN',
    humanMessage: 'You do not have permission to do that.',
    correlationId: ctx.correlationId ?? newCorrelationId(),
  });
}

/** Audits a signed-in non-administrator reaching an admin page. Path only — no query string. */
export async function recordAdminPageDenied(userId: string, path: string): Promise<void> {
  await recordAuditEvent({
    event: 'admin.access_denied',
    actorId: userId,
    metadata: { path: path.split('?')[0]!.slice(0, 200) },
  });
}

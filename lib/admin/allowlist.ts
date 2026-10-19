/**
 * The owner-only administrator allowlist, as trusted server configuration.
 *
 * This is ONE of three independent checks, and the weakest on its own:
 *   1. `public.platform_admins` binds each administrator to an immutable auth
 *      user id, and its CHECK constraint permits only these two addresses;
 *   2. `app.is_platform_admin()` additionally requires the account's current
 *      email to equal the provisioned one, a confirmed email, and an MFA
 *      (aal2) session — every admin read and write in Postgres goes through it;
 *   3. this list, checked by the server before rendering anything.
 *
 * An email match alone grants nothing: someone who registers one of these
 * addresses still has no `platform_admins` row (rows are written only by the
 * provisioning script with the service role).
 *
 * Changing who is an administrator means changing this file AND the
 * migration's CHECK constraint — a deliberate, reviewed change, never a UI
 * action.
 */
export const ADMIN_EMAILS = ['jamilnash@solvanehub.us', 'jonathancash@solvanehub.us'] as const;

export function isAllowlistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

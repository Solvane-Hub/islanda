/**
 * Provision one of the two Islanda platform administrators.
 *
 *   npm run admin:provision -- --email jamilnash@solvanehub.us --name "Jamil Nash"
 *
 * What it does, in order:
 *   1. Refuses any email that is not on the owner allowlist (lib/admin/allowlist).
 *   2. Finds the Supabase Auth account for that email.
 *        - Exists           → binds it (no password is set or changed).
 *        - Missing + --invite
 *                           → sends Supabase Auth's own invitation email; the
 *                             person verifies their mailbox and chooses a password.
 *        - Missing + --temporary-password-stdin
 *                           → creates the account UNCONFIRMED with a temporary
 *                             password read from standard input (never from an
 *                             argument, file or environment variable, never printed),
 *                             sends Supabase's confirmation email, and marks the
 *                             password for a forced change at first sign-in.
 *        - Missing, neither → stops and explains.
 *   3. Writes / refreshes the `platform_admins` row bound to the account's user id.
 *      Access still requires a CONFIRMED email and an MFA session — the database
 *      enforces both, so a row for an unconfirmed account grants nothing yet.
 *   4. Records `admin.provisioned` in the audit log.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from
 * .env.local via `tsx --env-file`). The service role never leaves this machine.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { ADMIN_EMAILS, isAllowlistedEmail } from '@/lib/admin/allowlist';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error(
      'Pipe the temporary password on standard input, e.g. from a password manager CLI. It is never accepted as an argument.',
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  if (!email || !name) {
    throw new Error(
      'Usage: --email <address> --name "<display name>" [--invite | --temporary-password-stdin]',
    );
  }
  if (!isAllowlistedEmail(email)) {
    throw new Error(
      `Refused: ${email} is not on the administrator allowlist (${ADMIN_EMAILS.join(', ')}).`,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Emails must link to the deployed app, never a developer machine: an explicit
  // --app-url wins, then NEXT_PUBLIC_APP_URL unless it points at localhost.
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = (
    arg('app-url') ??
    (envUrl && !/localhost|127\.0\.0\.1/.test(envUrl) ? envUrl : 'https://www.islanda.app')
  ).replace(/\/+$/, '');
  if (!url || !key)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find the account. listUsers is paginated; the project is small, but page through anyway.
  let user: { id: string; email?: string; email_confirmed_at?: string | null } | undefined;
  for (let page = 1; page <= 50 && !user; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (data.users.length < 200) break;
  }

  let action: string;
  if (user) {
    action = 'bound_existing_account';
    console.log(
      `Found existing account ${user.id} (${user.email_confirmed_at ? 'email confirmed' : 'email NOT confirmed'}). No password was changed.`,
    );
  } else if (flag('invite')) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/admin/reset-password`,
    });
    if (error || !data.user) throw error ?? new Error('Invitation failed.');
    user = data.user;
    action = 'invited';
    console.log(
      `Supabase Auth reported the invitation as sent to ${email}. Confirm it arrived before relying on it.`,
    );
  } else if (flag('temporary-password-stdin')) {
    const password = await readStdin();
    if (password.length < 12)
      throw new Error('The temporary password must be at least 12 characters.');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      app_metadata: { password_change_required: true },
      user_metadata: { full_name: name },
    });
    if (error || !data.user) throw error ?? new Error('Account creation failed.');
    user = data.user;
    action = 'created_with_temporary_password';
    // Supabase sends its confirmation email for an unconfirmed account on resend.
    const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? key, {
      auth: { persistSession: false },
    });
    const { error: resendError } = await anon.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=/admin/login` },
    });
    console.log(
      resendError
        ? `Account created, but the confirmation email could not be sent (${resendError.message}). Confirm the email in the Supabase dashboard after verifying the person's identity.`
        : `Account created unconfirmed. Supabase Auth reported a confirmation email sent to ${email}. The temporary password must be changed at first sign-in.`,
    );
  } else {
    throw new Error(
      `No account exists for ${email}. Re-run with --invite (recommended) or --temporary-password-stdin.`,
    );
  }

  const { error: upsertError } = await admin
    .from('platform_admins')
    .upsert(
      { user_id: user.id, email, display_name: name, provisioned_by: 'scripts/provision-admin.ts' },
      { onConflict: 'user_id' },
    );
  if (upsertError) throw upsertError;

  await admin.from('audit_log').insert({
    event: 'admin.provisioned',
    actor_id: null,
    metadata: { subjectUserId: user.id, action },
  });

  console.log(
    `Bound ${email} to platform administrator user id ${user.id}. Access requires a confirmed email and two-step verification at sign-in (https://www.islanda.app/admin/login).`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Provisioning failed.');
  process.exit(1);
});

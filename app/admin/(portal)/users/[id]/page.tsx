import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { eventLabel, featureLabel } from '@/lib/admin/labels';
import { userDetailFor, type UserDetail } from '@/services/admin/reports';
import { DataTable, Panel, formatNumber } from '../../../_components/charts';
import { requireAdminPage } from '../../../_lib/guard';

export const metadata: Metadata = { title: 'User' };

function when(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '—';
}

/**
 * One user, for product administration. Shows account facts, the businesses
 * they own (names and progress — no document contents, identifiers, financial
 * figures or Nova questions) and which features they used, when. Never shows a
 * password, token or session.
 */
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/users/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  let user: UserDetail | null = null;
  let failed = false;
  try {
    user = await userDetailFor(await createClient(), id);
  } catch (error) {
    failed = true;
    logger.error('admin.user_detail_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }
  if (!failed && !user) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-foreground-muted text-xs">
        <Link href="/admin/users" className="underline underline-offset-2">
          Users
        </Link>{' '}
        / User
      </nav>
      {failed || !user ? (
        <Alert tone="error">
          <p>This user could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="text-on-ink flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-[-0.02em]">
              {user.full_name || user.email}
              {user.is_admin ? <Badge tone="brand">Admin</Badge> : null}
              {user.is_test ? <Badge tone="neutral">Test account</Badge> : null}
              {user.banned ? <Badge tone="danger">Suspended</Badge> : null}
            </h1>
            <p className="text-foreground-muted text-sm break-all">{user.email}</p>
          </header>

          <Panel title="Account">
            <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[12rem_1fr] sm:gap-x-3">
              <dt className="text-foreground-muted">Account created</dt>
              <dd>{when(user.created_at)}</dd>
              <dt className="text-foreground-muted">Last sign-in</dt>
              <dd>{when(user.last_sign_in_at)}</dd>
              <dt className="text-foreground-muted">Email confirmed</dt>
              <dd>{user.confirmed ? 'Yes' : 'No'}</dd>
              <dt className="text-foreground-muted">Authenticator (MFA)</dt>
              <dd>{user.mfa_factors > 0 ? 'Set up' : 'Not set up'}</dd>
            </dl>
          </Panel>

          <Panel title="Businesses" description="Names and progress only.">
            {user.businesses.length === 0 ? (
              <p className="text-foreground-muted text-sm">No businesses created.</p>
            ) : (
              <DataTable
                caption="Businesses"
                minWidth="56rem"
                headers={[
                  'Business',
                  'Industry',
                  'Country',
                  'Mode',
                  'Status',
                  'Created',
                  'Onboarding',
                  'Documents',
                  'Goals',
                ]}
                rows={user.businesses.map((b) => [
                  <span key="n" className="text-on-ink">
                    {b.name}
                    {b.archived ? (
                      <Badge tone="neutral" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                  </span>,
                  b.industry ?? '—',
                  b.country_code ?? '—',
                  b.mode ?? '—',
                  b.status.replace(/_/g, ' '),
                  b.created_at.slice(0, 10),
                  b.onboarding_completed_at
                    ? `Completed ${b.onboarding_completed_at.slice(0, 10)}`
                    : b.onboarding_step
                      ? `Step ${b.onboarding_step}`
                      : 'Not started',
                  formatNumber(b.documents),
                  formatNumber(b.goals),
                ])}
              />
            )}
          </Panel>

          <Panel title="Feature use" description="Recorded actions and app page views, all time.">
            {user.features.length === 0 ? (
              <p className="text-foreground-muted text-sm">No recorded activity.</p>
            ) : (
              <DataTable
                caption="Feature use"
                headers={['Feature', 'Recorded events', 'Last used']}
                rows={user.features.map((f) => [
                  featureLabel(f.feature),
                  formatNumber(f.actions),
                  when(f.last_at),
                ])}
              />
            )}
          </Panel>

          <Panel
            title="Recent activity"
            description="The 40 most recent recorded actions. Event names only — never content."
          >
            {user.recent_activity.length === 0 ? (
              <p className="text-foreground-muted text-sm">No recorded actions.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-white/8 text-sm">
                {user.recent_activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{eventLabel(a.event)}</span>
                    <span className="text-foreground-muted text-xs tabular-nums">{when(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

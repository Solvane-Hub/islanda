import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { parseDateRange, rangeQuery, rate } from '@/lib/admin/date-range';
import { userList, userOverview, type UserOverview, type UserRow } from '@/services/admin/reports';
import {
  BarList,
  DataTable,
  Panel,
  StatCard,
  TrendChart,
  formatNumber,
  formatPercent,
} from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Users & business profiles' };

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage('/admin/users');
  const raw = await searchParams;
  const range = parseDateRange(raw);
  const q = (one(raw.q) ?? '').slice(0, 100);
  const includeTest = one(raw.tests) === 'show';
  const page = Math.max(1, Math.min(10_000, Number(one(raw.page)) || 1));
  const db = await createClient();

  let overview: UserOverview | null = null;
  let list: Awaited<ReturnType<typeof userList>> | null = null;
  try {
    [overview, list] = await Promise.all([
      userOverview(db, range.from, range.to),
      userList(db, { search: q || null, includeTest, page }),
    ]);
  } catch (error) {
    logger.error('admin.users_failed', { code: error instanceof Error ? error.name : 'unknown' });
  }

  const pageHref = (n: number) => {
    const params = new URLSearchParams(rangeQuery(range));
    if (q) params.set('q', q);
    if (includeTest) params.set('tests', 'show');
    params.set('page', String(n));
    return `/admin/users?${params.toString()}`;
  };

  return (
    <>
      <PageHeading
        title="Users & Business Profiles"
        description="People with an Islanda account and the businesses they created. Waitlist contacts are not assumed to be users — the two lists are separate. An active user did at least one recorded action or viewed an app page while signed in during the period; having an account is not activity."
      >
        <Link
          href={`/admin/exports/users?${rangeQuery(range)}`}
          prefetch={false}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          Export CSV (no contact details)
        </Link>
      </PageHeading>
      <RangePicker action="/admin/users" range={range} showCompare={false} />

      {!overview || !list ? (
        <Alert tone="error">
          <p>Users could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Registered users"
              value={formatNumber(overview.totals.users)}
              hint={`${overview.totals.test_accounts_excluded} test accounts and the administrators excluded`}
            />
            <StatCard label="New in range" value={formatNumber(overview.totals.new_users)} />
            <StatCard label="Active in range" value={formatNumber(overview.totals.active_users)} />
            <StatCard
              label="DAU / WAU / MAU"
              value={`${overview.totals.dau} / ${overview.totals.wau} / ${overview.totals.mau}`}
              hint="Ending at the end of the range"
            />
            <StatCard
              label="Business profiles"
              value={formatNumber(overview.totals.businesses)}
              hint={`${overview.totals.businesses_created} created in range · ${overview.totals.businesses_archived} archived`}
            />
            <StatCard
              label="Onboarding completed"
              value={formatPercent(
                rate(overview.totals.onboarding_completed, overview.totals.businesses),
              )}
              hint={`${overview.totals.onboarding_completed} of ${overview.totals.businesses} businesses · ${overview.totals.onboarding_started} started`}
            />
            <StatCard
              label="Documents"
              value={formatNumber(overview.totals.documents)}
              hint={`${overview.totals.documents_created} added in range`}
            />
            <StatCard label="Goals" value={formatNumber(overview.totals.goals)} />
          </div>

          <Panel title="New and active users by day" description="UTC days.">
            <TrendChart
              title="New and active users by day"
              days={overview.daily.map((d) => ({
                day: d.day,
                values: { new_users: d.new_users, active_users: d.active_users },
              }))}
              series={[
                { key: 'new_users', label: 'New users' },
                { key: 'active_users', label: 'Active users' },
              ]}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Businesses per user">
              <BarList
                unit="users"
                items={overview.businesses_per_user.map((b) => ({
                  label: `${b.label} business${b.label === '1' ? '' : 'es'}`,
                  value: b.count,
                }))}
              />
            </Panel>
            <Panel title="Business countries" description="Country code on the business profile.">
              <BarList
                unit="businesses"
                items={overview.countries.map((c) => ({ label: c.label, value: c.count }))}
              />
            </Panel>
            <Panel title="Business industries" description="As entered by the founder.">
              <BarList
                unit="businesses"
                items={overview.industries.map((c) => ({ label: c.label, value: c.count }))}
              />
            </Panel>
          </div>

          <Panel
            title={`${list.total} ${list.total === 1 ? 'user' : 'users'}`}
            description="Newest accounts first."
          >
            <form method="get" action="/admin/users" className="flex flex-wrap items-end gap-3">
              {Object.entries(Object.fromEntries(new URLSearchParams(rangeQuery(range)))).map(
                ([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ),
              )}
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-foreground-muted font-medium">
                  Search email, name or business
                </span>
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  maxLength={100}
                  className="border-border-control bg-surface text-foreground h-10 w-72 max-w-full rounded-lg border px-3 text-sm"
                />
              </label>
              <label className="text-foreground inline-flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="tests"
                  value="show"
                  defaultChecked={includeTest}
                  className="size-4"
                />
                Show test accounts
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Search
              </button>
            </form>

            <DataTable
              caption="Registered users"
              minWidth="64rem"
              headers={[
                'User',
                'Created',
                'Last sign-in',
                'Last activity',
                'Businesses',
                'Onboarding done',
                'Documents',
                'Status',
              ]}
              rows={list.rows.map((u: UserRow) => [
                <span key="u" className="flex flex-col">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-on-ink underline underline-offset-2"
                  >
                    {u.full_name || u.email}
                  </Link>
                  {u.full_name ? (
                    <span className="text-foreground-muted text-xs break-all">{u.email}</span>
                  ) : null}
                </span>,
                day(u.created_at),
                day(u.last_sign_in_at),
                day(u.last_activity_at),
                formatNumber(u.businesses),
                formatNumber(u.onboarding_completed),
                formatNumber(u.documents),
                <span key="s" className="flex flex-wrap gap-1">
                  {u.is_admin ? <Badge tone="brand">Admin</Badge> : null}
                  {u.is_test ? <Badge tone="neutral">Test</Badge> : null}
                  {!u.confirmed ? <Badge tone="warning">Unconfirmed</Badge> : null}
                  {u.banned ? <Badge tone="danger">Suspended</Badge> : null}
                </span>,
              ])}
            />

            {list.pageCount > 1 ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-3">
                {list.page > 1 ? (
                  <Link
                    href={pageHref(list.page - 1)}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-foreground-muted text-xs">
                  Page {list.page} of {list.pageCount}
                </p>
                {list.page < list.pageCount ? (
                  <Link
                    href={pageHref(list.page + 1)}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    Next
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </Panel>
        </>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils/cn';
import { parseDateRange, rangeQuery } from '@/lib/admin/date-range';
import { eventLabel } from '@/lib/admin/labels';
import { auditLog, type AuditRow } from '@/services/admin/reports';
import { DataTable, Panel, formatNumber } from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Security & audit logs' };

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS = [
  { key: 'admin', label: 'Admin activity', prefix: 'admin.' },
  { key: 'waitlist', label: 'Recruitment changes', prefix: 'waitlist.' },
  { key: 'auth', label: 'Sign-ins (all users)', prefix: 'auth.' },
  { key: 'all', label: 'Everything', prefix: null },
] as const;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Shape-only metadata; long values are cut. Never contains secrets by construction (see lib/db/audit). */
function describe(row: AuditRow): string {
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
  return Object.entries(meta)
    .map(
      ([k, v]) =>
        `${k}: ${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v)?.slice(0, 60)}`,
    )
    .join(' · ');
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdminPage('/admin/security');
  const raw = await searchParams;
  const range = parseDateRange(raw);
  const view = VIEWS.find((v) => v.key === one(raw.view)) ?? VIEWS[0];
  const page = Math.max(1, Math.min(10_000, Number(one(raw.page)) || 1));

  let log: Awaited<ReturnType<typeof auditLog>> | null = null;
  try {
    log = await auditLog(await createClient(), {
      from: range.from,
      to: range.to,
      prefix: view.prefix,
      page,
    });
  } catch (error) {
    logger.error('admin.audit_failed', { code: error instanceof Error ? error.name : 'unknown' });
  }

  const href = (overrides: Record<string, string>) => {
    const params = new URLSearchParams(rangeQuery(range));
    params.set('view', view.key);
    for (const [k, v] of Object.entries(overrides)) params.set(k, v);
    return `/admin/security?${params.toString()}`;
  };

  return (
    <>
      <PageHeading
        title="Security & Audit Logs"
        description="The append-only audit trail and how access to this portal is protected. Audit rows cannot be edited or deleted by anyone through the application, including administrators."
      />

      <Panel title="How this portal is protected">
        <ul className="text-foreground-muted flex list-disc flex-col gap-1.5 pl-5 text-xs text-pretty">
          <li>
            Only two accounts can ever be administrators — Jamil Nash and Jonathan Cash. The
            allowlist is fixed in a database constraint and in server configuration; changing it
            needs a reviewed code change. There is no screen that adds administrators.
          </li>
          <li>
            Access is bound to each account&apos;s permanent user id, requires the account&apos;s
            email to be unchanged and confirmed, and requires two-step verification (an
            authenticator app) on every session. Registering one of the two email addresses grants
            nothing.
          </li>
          <li>
            Every admin page, action and export checks access on the server, and the database itself
            refuses admin data to anyone else — hiding a link is never the protection.
          </li>
          <li>
            Denied attempts, sign-ins, MFA events, password changes, recruitment edits and exports
            are recorded below with time, account and a safe summary — never passwords, tokens or
            personal answers.
          </li>
        </ul>
      </Panel>

      <RangePicker
        action="/admin/security"
        range={range}
        showCompare={false}
        hidden={{ view: view.key }}
      />

      <nav aria-label="Audit views" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={(() => {
              const params = new URLSearchParams(rangeQuery(range));
              params.set('view', v.key);
              return `/admin/security?${params.toString()}`;
            })()}
            aria-current={v.key === view.key ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-xs',
              v.key === view.key
                ? 'text-on-ink border-white/40 bg-white/[0.08]'
                : 'text-foreground border-white/20 hover:bg-white/[0.06]',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {!log ? (
        <Alert tone="error">
          <p>The audit log could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <Panel
          title={`${formatNumber(log.total)} events`}
          description="Newest first. Times in UTC."
        >
          {log.rows.length === 0 ? (
            <p className="text-foreground-muted text-sm">No events in this range.</p>
          ) : (
            <DataTable
              caption="Audit events"
              minWidth="64rem"
              headers={['Time (UTC)', 'Event', 'Account', 'IP', 'Details']}
              rows={log.rows.map((r) => [
                <span key="t" className="whitespace-nowrap tabular-nums">
                  {r.occurred_at.slice(0, 19).replace('T', ' ')}
                </span>,
                eventLabel(r.event),
                r.actor_id ? (
                  r.actor_id === admin.userId ? (
                    'You'
                  ) : (
                    <Link
                      key="a"
                      href={`/admin/users/${r.actor_id}`}
                      className="underline underline-offset-2"
                    >
                      {r.actor_id.slice(0, 8)}…
                    </Link>
                  )
                ) : (
                  '—'
                ),
                r.ip_address ?? '—',
                <span key="d" className="text-foreground-muted text-xs break-all">
                  {describe(r) || '—'}
                </span>,
              ])}
            />
          )}
          {log.pageCount > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              {log.page > 1 ? (
                <Link
                  href={href({ page: String(log.page - 1) })}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-foreground-muted text-xs">
                Page {log.page} of {log.pageCount}
              </p>
              {log.page < log.pageCount ? (
                <Link
                  href={href({ page: String(log.page + 1) })}
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
      )}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { selectionText } from '@/lib/admin/labels';
import { logger } from '@/lib/logger';
import { parseDateRange } from '@/lib/admin/date-range';
import { cn } from '@/lib/utils/cn';
import {
  RECRUITMENT_STATUS_OPTIONS,
  industryLabel,
  primaryGoalLabel,
  recruitmentStatusLabel,
  testingInterestLabel,
} from '@/lib/waitlist/options';
import { waitlistInsights, type WaitlistInsights } from '@/services/admin/reports';
import { listWaitlist, type WaitlistPage } from '@/services/waitlist/recruitment';
import { DataTable, Panel, formatNumber } from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RecruitmentEditor } from '../../_components/recruitment-editor';
import { requireAdminPage } from '../../_lib/guard';
import { filterQuery, hrefWith, parseWaitlistFilters } from '../../_lib/waitlist-filters';

export const metadata: Metadata = { title: 'Pilot recruitment & feedback' };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Pilot recruitment. Starts from the people who said yes or maybe to early
 * access (or to giving feedback). Nothing here contacts anyone or changes a
 * status automatically: every status, date and note is set by a person.
 */
export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/recruitment');
  const parsed = parseWaitlistFilters(await searchParams);
  const filters = { ...parsed, pool: parsed.pool ?? ('early_access' as const) };
  const db = await createClient();
  const allTime = parseDateRange({ range: 'all' });

  let pipeline: WaitlistInsights | null = null;
  let page: WaitlistPage | null = null;
  try {
    [pipeline, page] = await Promise.all([
      waitlistInsights(db, allTime.from, allTime.to),
      listWaitlist(db, filters),
    ]);
  } catch (error) {
    logger.error('admin.recruitment_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  const count = (status: string) =>
    pipeline?.recruitment.find((r) => r.value === status)?.count ?? 0;
  const interested = (pipeline?.testing_interest ?? [])
    .filter((t) => t.value === 'yes' || t.value === 'maybe')
    .reduce((n, t) => n + t.count, 0);

  return (
    <>
      <PageHeading
        title="Pilot Recruitment & Feedback"
        description="People who expressed interest in early access or in giving feedback. Their answers are interest, not consent: contact them personally, explain what testing involves, and record what happened here. Nothing on this page sends a message."
      >
        <Link
          href={`/admin/exports/recruitment?${filterQuery(filters)}`}
          prefetch={false}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          Export this list (CSV)
        </Link>
      </PageHeading>

      {!pipeline || !page ? (
        <Alert tone="error">
          <p>Recruitment could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <>
          <Panel
            title="Pipeline (all time)"
            description="Every signup, excluding automated test records."
          >
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <li className="rounded-xl border border-white/10 p-3">
                <p className="text-foreground-muted text-xs">Interested (yes or maybe)</p>
                <p className="text-on-ink text-xl font-semibold tabular-nums">
                  {formatNumber(interested)}
                </p>
              </li>
              {RECRUITMENT_STATUS_OPTIONS.map((s) => (
                <li key={s.value} className="rounded-xl border border-white/10 p-3">
                  <p className="text-foreground-muted text-xs">{s.label}</p>
                  <p className="text-on-ink text-xl font-semibold tabular-nums">
                    {formatNumber(count(s.value))}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <nav aria-label="Recruitment views" className="flex flex-wrap gap-2">
            {[
              {
                label: 'Early access: yes or maybe',
                params: { pool: 'early_access', recruitmentStatus: '' },
              },
              {
                label: 'Feedback: yes or maybe',
                params: { pool: 'feedback', recruitmentStatus: '' },
              },
              ...RECRUITMENT_STATUS_OPTIONS.map((s) => ({
                label: `${s.label}`,
                params: { pool: filters.pool, recruitmentStatus: s.value },
              })),
            ].map((view) => {
              const active =
                view.params.pool === filters.pool &&
                (view.params.recruitmentStatus || undefined) === filters.recruitmentStatus;
              return (
                <Link
                  key={view.label}
                  href={hrefWith('/admin/recruitment', { page: 1 }, view.params)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-full border px-3 text-xs',
                    active
                      ? 'text-on-ink border-white/40 bg-white/[0.08]'
                      : 'text-foreground border-white/20 hover:bg-white/[0.06]',
                  )}
                >
                  {view.label}
                </Link>
              );
            })}
          </nav>

          <Panel
            title={`${page.total} ${page.total === 1 ? 'person' : 'people'}`}
            description={`${filters.pool === 'feedback' ? 'Said yes or maybe to giving feedback' : 'Said yes or maybe to early access'}${
              filters.recruitmentStatus
                ? ` · ${recruitmentStatusLabel(filters.recruitmentStatus)}`
                : ''
            }. Open a person to record contact, confirmation and test dates and their feedback.`}
          >
            {page.entries.length === 0 ? (
              <p className="text-foreground-muted text-sm">No one matches this view yet.</p>
            ) : (
              <DataTable
                caption="Recruitment list"
                minWidth="72rem"
                headers={[
                  'Person',
                  'Based in',
                  'Industry · goal',
                  'Early access',
                  'Feedback',
                  'Status & notes',
                  'Dates',
                ]}
                rows={page.entries.map((e) => [
                  <span key="p" className="flex flex-col">
                    <Link
                      href={`/admin/waitlist/${e.id}`}
                      className="text-on-ink underline underline-offset-2"
                    >
                      {e.name || 'Unnamed signup'}
                    </Link>
                    <span className="text-foreground-muted text-xs break-all">{e.email}</span>
                    {e.phone ? (
                      <span className="text-foreground-muted text-xs">{e.phone}</span>
                    ) : null}
                  </span>,
                  [e.cityIsland, e.country].filter(Boolean).join(', ') || '—',
                  <span key="i" className="text-xs">
                    {[
                      e.industry ? industryLabel(e.industry) : null,
                      selectionText(e.primaryGoals, primaryGoalLabel) || null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>,
                  e.testingInterest ? testingInterestLabel(e.testingInterest) : '—',
                  e.feedbackInterest ? testingInterestLabel(e.feedbackInterest) : '—',
                  <RecruitmentEditor
                    key="r"
                    signupId={e.id}
                    personName={e.name}
                    status={e.recruitmentStatus}
                    notes={e.recruitmentNotes}
                  />,
                  <span
                    key="d"
                    className="text-foreground-muted flex flex-col text-xs whitespace-nowrap"
                  >
                    <span>Contacted {e.contactedOn ?? '—'}</span>
                    <span>Confirmed {e.confirmedOn ?? '—'}</span>
                    <span>Tested {e.testedOn ?? '—'}</span>
                    {e.feedbackSummary || e.feedbackLink ? (
                      <span className="text-success">Feedback recorded</span>
                    ) : null}
                  </span>,
                ])}
              />
            )}
            {page.pageCount > 1 ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-3">
                {page.page > 1 ? (
                  <Link
                    href={hrefWith('/admin/recruitment', filters, { page: String(page.page - 1) })}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-foreground-muted text-xs">
                  Page {page.page} of {page.pageCount}
                </p>
                {page.page < page.pageCount ? (
                  <Link
                    href={hrefWith('/admin/recruitment', filters, { page: String(page.page + 1) })}
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

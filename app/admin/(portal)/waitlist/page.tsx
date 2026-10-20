import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils/cn';
import type { WaitlistFilters } from '@/lib/validation/waitlist';
import {
  ALL_CHALLENGE_OPTIONS,
  BUSINESS_JOURNEY_OPTIONS,
  BUSINESS_STAGE_OPTIONS,
  INDUSTRY_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RECRUITMENT_STATUS_OPTIONS,
  TESTING_INTEREST_OPTIONS,
  businessJourneyLabel,
  challengeLabel,
  industryLabel,
  primaryGoalLabel,
  testingInterestLabel,
  type TestingInterest,
} from '@/lib/waitlist/options';
import {
  listWaitlist,
  type WaitlistEntry,
  type WaitlistPage,
} from '@/services/waitlist/recruitment';
import { RecruitmentEditor } from '../../_components/recruitment-editor';
import { SelectionList } from '../../_components/selection-list';
import { PageHeading } from '../../_components/page-heading';
import { requireAdminPage } from '../../_lib/guard';
import {
  FILTER_KEYS,
  filterQuery,
  hrefWith,
  parseWaitlistFilters,
} from '../../_lib/waitlist-filters';

export const metadata: Metadata = { title: 'Waitlist' };

/**
 * Waitlist management. Filtering, sorting and paging run in Postgres
 * (services → lib/db); the browser receives one page of matching rows.
 * Contact details and internal notes are visible to administrators only —
 * RLS refuses them to everyone else.
 */

type SearchParams = Record<string, string | string[] | undefined>;

const QUICK_VIEWS: { label: string; params: Record<string, string> }[] = [
  { label: 'Early access: yes or maybe', params: { pool: 'early_access' } },
  { label: 'Feedback: yes or maybe', params: { pool: 'feedback' } },
  {
    label: 'Bahamas · yes · not contacted',
    params: { country: 'Bahamas', testingInterest: 'yes', recruitmentStatus: 'not_contacted' },
  },
  { label: 'Confirmed for testing', params: { recruitmentStatus: 'confirmed' } },
  { label: 'Questionnaire not completed', params: { completed: 'no' } },
];

export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/waitlist');
  const filters = parseWaitlistFilters(await searchParams);
  const filtered = FILTER_KEYS.some(
    (key) => key !== 'sort' && key !== 'tests' && Boolean(filters[key]),
  );

  let page: WaitlistPage | null = null;
  try {
    page = await listWaitlist(await createClient(), filters);
  } catch (error) {
    logger.error('admin.waitlist_list_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  const exportQuery = filterQuery(filters);

  return (
    <>
      <PageHeading
        title="Waitlist"
        description="Everyone who joined the Islanda waitlist, with their optional questionnaire answers. “Early access” is what the person told us; “Recruitment” is what the team has done. Changing one never changes the other."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/exports/waitlist?${exportQuery}`}
            prefetch={false}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Export CSV (no contact details)
          </Link>
          <Link
            href={`/admin/exports/waitlist?${exportQuery}${exportQuery ? '&' : ''}contact=1`}
            prefetch={false}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Export CSV with contact details
          </Link>
        </div>
      </PageHeading>

      <section aria-labelledby="quick-views" className="flex flex-col gap-2">
        <h2 id="quick-views" className="text-foreground-muted text-xs font-medium">
          Quick views
        </h2>
        <ul className="flex flex-wrap gap-2">
          {QUICK_VIEWS.map((view) => (
            <li key={view.label}>
              <Link
                href={hrefWith('/admin/waitlist', { page: 1 }, view.params)}
                className="text-foreground inline-flex min-h-9 items-center rounded-full border border-white/20 px-3 text-xs hover:bg-white/[0.06]"
              >
                {view.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FilterForm filters={filters} filtered={filtered} />

      {page === null ? (
        <Alert tone="error">
          <p>The waitlist could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : page.total === 0 ? (
        <EmptyState
          title={filtered ? 'No signups match these filters' : 'No one has joined yet'}
          explanation={
            filtered
              ? 'Try removing a filter or widening the date range.'
              : 'Signups from the public waitlist will appear here as soon as people join.'
          }
          {...(filtered
            ? {
                action: (
                  <Link
                    href="/admin/waitlist"
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-5')}
                  >
                    Reset filters
                  </Link>
                ),
              }
            : {})}
        />
      ) : (
        <Results page={page} filters={filters} />
      )}
    </>
  );
}

function FilterForm({ filters, filtered }: { filters: WaitlistFilters; filtered: boolean }) {
  return (
    <form
      method="get"
      action="/admin/waitlist"
      aria-label="Filter the waitlist"
      className="grid grid-cols-1 gap-4 rounded-2xl border border-white/12 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
    >
      <Field id="filter-q" label="Search name, email, phone or business" className="sm:col-span-2">
        {(aria) => <Input {...aria} name="q" type="search" defaultValue={filters.q ?? ''} />}
      </Field>
      <Field id="filter-country" label="Country contains">
        {(aria) => (
          <Input
            {...aria}
            name="country"
            placeholder="e.g. Bahamas"
            defaultValue={filters.country ?? ''}
          />
        )}
      </Field>
      <Field id="filter-city" label="City, island or community contains">
        {(aria) => <Input {...aria} name="cityIsland" defaultValue={filters.cityIsland ?? ''} />}
      </Field>

      <SelectFilter
        id="filter-journey"
        label="Business journey"
        name="businessJourney"
        value={filters.businessJourney}
        options={BUSINESS_JOURNEY_OPTIONS}
      />
      <SelectFilter
        id="filter-industry"
        label="Industry"
        name="industry"
        value={filters.industry}
        options={INDUSTRY_OPTIONS}
      />
      <SelectFilter
        id="filter-goal"
        label="Wants help with (any selected)"
        name="primaryGoal"
        value={filters.primaryGoal}
        options={PRIMARY_GOAL_OPTIONS}
      />
      <SelectFilter
        id="filter-challenge"
        label="Challenge (any selected)"
        name="biggestChallenge"
        value={filters.biggestChallenge}
        options={ALL_CHALLENGE_OPTIONS}
      />
      <SelectFilter
        id="filter-stage"
        label="Business stage"
        name="businessStage"
        value={filters.businessStage}
        options={BUSINESS_STAGE_OPTIONS}
      />
      <SelectFilter
        id="filter-interest"
        label="Early access interest"
        name="testingInterest"
        value={filters.testingInterest}
        options={TESTING_INTEREST_OPTIONS}
      />
      <SelectFilter
        id="filter-feedback"
        label="Feedback willingness"
        name="feedbackInterest"
        value={filters.feedbackInterest}
        options={TESTING_INTEREST_OPTIONS}
      />
      <SelectFilter
        id="filter-status"
        label="Recruitment status"
        name="recruitmentStatus"
        value={filters.recruitmentStatus}
        options={RECRUITMENT_STATUS_OPTIONS}
      />
      <SelectFilter
        id="filter-completed"
        label="Questionnaire"
        name="completed"
        value={filters.completed}
        options={[
          { value: 'yes', label: 'Completed' },
          { value: 'no', label: 'Not completed' },
        ]}
      />
      <Field id="filter-from" label="Signed up from (UTC)">
        {(aria) => <Input {...aria} name="from" type="date" defaultValue={filters.from ?? ''} />}
      </Field>
      <Field id="filter-to" label="Signed up to (UTC)">
        {(aria) => <Input {...aria} name="to" type="date" defaultValue={filters.to ?? ''} />}
      </Field>
      <SelectFilter
        id="filter-sort"
        label="Sort by"
        name="sort"
        value={filters.sort}
        anyLabel="Newest signup first"
        options={[
          { value: 'oldest', label: 'Oldest signup first' },
          { value: 'name', label: 'Name (A–Z)' },
          { value: 'survey', label: 'Questionnaire completed (latest)' },
          { value: 'recruitment', label: 'Recruitment updated (latest)' },
        ]}
      />
      <label className="text-foreground inline-flex min-h-10 items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          name="tests"
          value="show"
          defaultChecked={filters.tests === 'show'}
          className="size-4"
        />
        Show automated test records
      </label>
      {filters.pool ? <input type="hidden" name="pool" value={filters.pool} /> : null}

      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" className={buttonVariants({ size: 'md' })}>
          Apply filters
        </button>
        {filtered ? (
          <Link href="/admin/waitlist" className={buttonVariants({ variant: 'ghost' })}>
            Reset filters
          </Link>
        ) : null}
        {filters.pool ? (
          <p className="text-foreground-muted text-xs">
            Showing {filters.pool === 'early_access' ? 'early-access' : 'feedback'} yes/maybe only.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SelectFilter({
  id,
  label,
  name,
  value,
  options,
  anyLabel = 'Any',
}: {
  id: string;
  label: string;
  name: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  anyLabel?: string;
}) {
  return (
    <Field id={id} label={label}>
      {(aria) => (
        <Select {...aria} name={name} defaultValue={value ?? ''}>
          <option value="">{anyLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function interestTone(value: TestingInterest | null) {
  if (value === 'yes') return 'success' as const;
  if (value === 'maybe') return 'warning' as const;
  return 'neutral' as const;
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

const HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Business',
  'Country',
  'City / island',
  'Journey',
  'Industry',
  'Wants help with',
  'Challenges',
  'Early access',
  'Feedback',
  'Recruitment',
  'Signed up',
  'Questionnaire',
];

function Results({ page, filters }: { page: WaitlistPage; filters: WaitlistFilters }) {
  const firstRow = (page.page - 1) * page.pageSize + 1;
  const lastRow = firstRow + page.entries.length - 1;

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="results-heading" className="text-on-ink text-base font-semibold">
          {page.total} {page.total === 1 ? 'signup' : 'signups'}
        </h2>
        <p className="text-foreground-muted text-xs">
          Showing {firstRow}–{lastRow}. Dates are in UTC.
          {filters.tests === 'show' ? '' : ' Automated test records hidden.'}
        </p>
      </div>

      <div
        role="region"
        aria-labelledby="results-heading"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-white/12 focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none"
      >
        <table className="w-full min-w-[110rem] border-collapse text-left text-sm">
          <thead className="text-foreground-muted text-xs">
            <tr className="border-b border-white/12">
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.entries.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      {page.pageCount > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page.page > 1 ? (
            <Link
              href={hrefWith('/admin/waitlist', filters, { page: String(page.page - 1) })}
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
              href={hrefWith('/admin/waitlist', filters, { page: String(page.page + 1) })}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function Row({ entry }: { entry: WaitlistEntry }) {
  const cell = 'px-3 py-3 align-top';
  const muted = <span className="text-foreground-subtle">—</span>;

  return (
    <tr className="border-b border-white/8 last:border-b-0">
      <th scope="row" className={cn(cell, 'text-on-ink font-medium whitespace-nowrap')}>
        <Link href={`/admin/waitlist/${entry.id}`} className="underline underline-offset-2">
          {entry.name || 'Unnamed signup'}
        </Link>
        {entry.isTest ? (
          <Badge tone="neutral" className="ml-2">
            Test
          </Badge>
        ) : null}
      </th>
      <td className={cell}>
        <a href={`mailto:${entry.email}`} className="break-all underline underline-offset-2">
          {entry.email}
        </a>
      </td>
      <td className={cn(cell, 'whitespace-nowrap')}>
        {entry.phone ? (
          <a
            href={`tel:${entry.phone.replace(/[^\d+]/g, '')}`}
            className="underline underline-offset-2"
          >
            {entry.phone}
          </a>
        ) : (
          muted
        )}
      </td>
      <td className={cell}>{entry.businessName ?? muted}</td>
      <td className={cell}>{entry.country ?? muted}</td>
      <td className={cell}>{entry.cityIsland ?? muted}</td>
      <td className={cn(cell, 'max-w-[14rem]')}>
        {entry.businessJourney ? businessJourneyLabel(entry.businessJourney) : muted}
      </td>
      <td className={cn(cell, 'max-w-[14rem]')}>
        {entry.industry ? industryLabel(entry.industry) : muted}
        {entry.industryOther ? (
          <span className="text-foreground-muted mt-1 block text-xs">
            &ldquo;{entry.industryOther}&rdquo;
          </span>
        ) : null}
      </td>
      <td className={cn(cell, 'max-w-[20rem] min-w-[14rem]')}>
        <SelectionList
          values={entry.primaryGoals}
          label={primaryGoalLabel}
          other={entry.goalOther}
          empty="—"
        />
      </td>
      <td className={cn(cell, 'max-w-[20rem] min-w-[14rem]')}>
        <SelectionList
          values={entry.challenges}
          label={challengeLabel}
          other={entry.challengeOther}
          empty="—"
        />
      </td>
      <td className={cell}>
        {entry.testingInterest ? (
          <Badge tone={interestTone(entry.testingInterest)}>
            {testingInterestLabel(entry.testingInterest)}
          </Badge>
        ) : (
          muted
        )}
      </td>
      <td className={cell}>
        {entry.feedbackInterest ? (
          <Badge tone={interestTone(entry.feedbackInterest)}>
            {testingInterestLabel(entry.feedbackInterest)}
          </Badge>
        ) : (
          muted
        )}
      </td>
      <td className={cell}>
        <RecruitmentEditor
          signupId={entry.id}
          personName={entry.name}
          status={entry.recruitmentStatus}
          notes={entry.recruitmentNotes}
        />
      </td>
      <td className={cn(cell, 'whitespace-nowrap')}>{day(entry.signedUpAt)}</td>
      <td className={cn(cell, 'whitespace-nowrap')}>
        {entry.surveyCompletedAt
          ? `Completed · ${day(entry.surveyCompletedAt)}`
          : entry.surveyStartedAt
            ? `Started · ${day(entry.surveyStartedAt)}`
            : 'Not answered'}
      </td>
    </tr>
  );
}

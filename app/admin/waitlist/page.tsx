import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Logo } from '@/components/brand/logo-mark';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils/cn';
import { waitlistFiltersSchema, type WaitlistFilters } from '@/lib/validation/waitlist';
import {
  BUSINESS_STAGE_OPTIONS,
  CHALLENGE_OPTIONS,
  RECRUITMENT_STATUS_OPTIONS,
  TESTING_INTEREST_OPTIONS,
  businessStageLabel,
  challengeLabel,
  recruitmentStatusLabel,
  testingInterestLabel,
  type TestingInterest,
} from '@/lib/waitlist/options';
import {
  getWaitlistAdminAccess,
  listWaitlist,
  type WaitlistEntry,
  type WaitlistPage,
} from '@/services/waitlist/recruitment';
import { staffSignOutAction } from '../actions';
import { RecruitmentEditor } from '../_components/recruitment-editor';

export const metadata: Metadata = { title: 'Waitlist & Pilot Recruitment' };

/**
 * Waitlist & Pilot Recruitment — team only.
 *
 * Signed out → staff sign-in. Signed in without the waitlist_admin role →
 * 404, so the page does not confirm its own existence to a founder account.
 * Filtering and paging run in Postgres (services → lib/db); the browser only
 * ever receives one page of matching rows.
 */

type SearchParams = Record<string, string | string[] | undefined>;

const FILTER_KEYS = [
  'q',
  'country',
  'cityIsland',
  'businessStage',
  'biggestChallenge',
  'testingInterest',
  'recruitmentStatus',
  'completed',
  'from',
  'to',
] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hrefWith(filters: WaitlistFilters, overrides: Partial<Record<string, string>>): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `/admin/waitlist?${query}` : '/admin/waitlist';
}

/** Common starting points for pilot recruitment. Plain links — no hidden state. */
const QUICK_VIEWS: { label: string; params: Record<string, string> }[] = [
  { label: 'Said yes to early testing', params: { testingInterest: 'yes' } },
  {
    label: 'Bahamas · said yes · not contacted',
    params: { country: 'Bahamas', testingInterest: 'yes', recruitmentStatus: 'not_contacted' },
  },
  { label: 'Confirmed for testing', params: { recruitmentStatus: 'confirmed' } },
  { label: 'Questions not answered', params: { completed: 'no' } },
];

export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const db = await createClient();
  const access = await getWaitlistAdminAccess(db);
  if (access.kind === 'signed_out') redirect('/admin/login?next=/admin/waitlist');
  if (access.kind === 'not_admin') notFound();

  const raw = await searchParams;
  const filters = waitlistFiltersSchema.parse(
    Object.fromEntries([...FILTER_KEYS, 'page'].map((key) => [key, first(raw[key])])),
  );
  const filtered = FILTER_KEYS.some((key) => Boolean(filters[key]));

  let page: WaitlistPage | null = null;
  try {
    page = await listWaitlist(db, filters);
  } catch (error) {
    logger.error('admin.waitlist_list_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <span className="text-on-ink inline-flex w-fit">
            <Logo height={20} />
          </span>
          <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
            Waitlist &amp; Pilot Recruitment
          </h1>
          <p className="text-foreground-muted max-w-2xl text-sm text-pretty">
            Everyone who joined the Islanda waitlist, with their optional answers. &ldquo;Early
            testing&rdquo; is what the person told us; &ldquo;Recruitment&rdquo; is what the team
            has done. Changing one never changes the other.
          </p>
        </div>
        <form action={staffSignOutAction}>
          <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Sign out
          </button>
        </form>
      </header>

      <section aria-labelledby="quick-views" className="flex flex-col gap-2">
        <h2 id="quick-views" className="text-foreground-muted text-xs font-medium">
          Quick views
        </h2>
        <ul className="flex flex-wrap gap-2">
          {QUICK_VIEWS.map((view) => (
            <li key={view.label}>
              <Link
                href={hrefWith({ page: 1 }, view.params)}
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
    </div>
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
      <Field id="filter-q" label="Search name or email" className="sm:col-span-2">
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
      <Field id="filter-city" label="City or island contains">
        {(aria) => <Input {...aria} name="cityIsland" defaultValue={filters.cityIsland ?? ''} />}
      </Field>

      <SelectFilter
        id="filter-stage"
        label="Business stage"
        name="businessStage"
        value={filters.businessStage}
        options={BUSINESS_STAGE_OPTIONS}
      />
      <SelectFilter
        id="filter-challenge"
        label="Biggest challenge"
        name="biggestChallenge"
        value={filters.biggestChallenge}
        options={CHALLENGE_OPTIONS}
      />
      <SelectFilter
        id="filter-interest"
        label="Early testing interest"
        name="testingInterest"
        value={filters.testingInterest}
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
        label="Questions answered?"
        name="completed"
        value={filters.completed}
        options={[
          { value: 'yes', label: 'Answered' },
          { value: 'no', label: 'Not answered' },
        ]}
      />
      <Field id="filter-from" label="Signed up from (UTC)">
        {(aria) => <Input {...aria} name="from" type="date" defaultValue={filters.from ?? ''} />}
      </Field>
      <Field id="filter-to" label="Signed up to (UTC)">
        {(aria) => <Input {...aria} name="to" type="date" defaultValue={filters.to ?? ''} />}
      </Field>

      <div className="flex items-end gap-3">
        <button type="submit" className={buttonVariants({ size: 'md' })}>
          Apply filters
        </button>
        {filtered ? (
          <Link href="/admin/waitlist" className={buttonVariants({ variant: 'ghost' })}>
            Reset filters
          </Link>
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
}: {
  id: string;
  label: string;
  name: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Field id={id} label={label}>
      {(aria) => (
        <Select {...aria} name={name} defaultValue={value ?? ''}>
          <option value="">Any</option>
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
  'Country',
  'City / island',
  'Business stage',
  'Biggest challenge',
  'Early testing?',
  'Recruitment status',
  'Signed up',
  'Questions answered?',
  'Last recruitment update',
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
          Showing {firstRow}–{lastRow}. Newest first. Dates are in UTC.
        </p>
      </div>

      {/* Focusable so keyboard users can scroll the wide table horizontally. */}
      <div
        role="region"
        aria-labelledby="results-heading"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-white/12 focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none"
      >
        <table className="w-full min-w-[80rem] border-collapse text-left text-sm">
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
              href={hrefWith(filters, { page: String(page.page - 1) })}
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
              href={hrefWith(filters, { page: String(page.page + 1) })}
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
        {entry.name || muted}
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
      <td className={cell}>{entry.country ?? muted}</td>
      <td className={cell}>{entry.cityIsland ?? muted}</td>
      <td className={cell}>
        {entry.businessStage ? businessStageLabel(entry.businessStage) : muted}
      </td>
      <td className={cn(cell, 'max-w-[16rem]')}>
        {entry.biggestChallenge ? challengeLabel(entry.biggestChallenge) : muted}
        {entry.challengeOther ? (
          <span className="text-foreground-muted mt-1 block text-xs text-pretty">
            &ldquo;{entry.challengeOther}&rdquo;
          </span>
        ) : null}
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
        <span className="sr-only">
          Currently {recruitmentStatusLabel(entry.recruitmentStatus)}.
        </span>
        <RecruitmentEditor
          signupId={entry.id}
          personName={entry.name}
          status={entry.recruitmentStatus}
          notes={entry.recruitmentNotes}
        />
      </td>
      <td className={cn(cell, 'whitespace-nowrap')}>{day(entry.signedUpAt)}</td>
      <td className={cn(cell, 'whitespace-nowrap')}>
        {entry.surveyCompletedAt ? `Yes · ${day(entry.surveyCompletedAt)}` : 'No'}
      </td>
      <td className={cn(cell, 'whitespace-nowrap')}>{day(entry.recruitmentUpdatedAt)}</td>
    </tr>
  );
}

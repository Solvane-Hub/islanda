import type { Metadata } from 'next';
import Link from 'next/link';
import { parseDateRange, rangeQuery } from '@/lib/admin/date-range';
import { Panel } from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Reports & exports' };

type SearchParams = Record<string, string | string[] | undefined>;

const REPORTS = [
  {
    group: 'Website',
    items: [
      {
        key: 'traffic-daily',
        title: 'Traffic by day',
        body: 'Page views, unique visitors and signups per UTC day, with the date analytics collection began.',
        view: '/admin/analytics',
      },
      {
        key: 'traffic-sources',
        title: 'Sources, landing pages and campaigns',
        body: 'Sessions and signups by referring site, landing page and UTM campaign.',
        view: '/admin/analytics',
      },
      {
        key: 'funnel',
        title: 'Signup conversion funnel',
        body: 'Visitors → form started → signed up → questionnaire → early-access interest → confirmed → tested.',
        view: '/admin/analytics',
      },
    ],
  },
  {
    group: 'Waitlist',
    items: [
      {
        key: 'waitlist',
        title: 'Waitlist records (no contact details)',
        body: 'Every signup with questionnaire answers and recruitment status. Use the Waitlist page filters to narrow it first.',
        view: '/admin/waitlist',
      },
      {
        key: 'questionnaire',
        title: 'Questionnaire summary',
        body: 'Counts per answer: locations, industries, goals, challenges, early-access and feedback interest.',
        view: '/admin/questionnaire',
      },
      {
        key: 'recruitment',
        title: 'Pilot recruitment list',
        body: 'People who said yes or maybe to early access, with contact details, status and dates. Personal data — handle with care.',
        view: '/admin/recruitment',
      },
    ],
  },
  {
    group: 'Product',
    items: [
      {
        key: 'users',
        title: 'Registered users (no contact details)',
        body: 'Account dates, businesses, onboarding, documents and last activity. Test accounts excluded.',
        view: '/admin/users',
      },
      {
        key: 'product-features',
        title: 'Feature adoption',
        body: 'Users, recorded actions and page views per feature in the range.',
        view: '/admin/usage',
      },
    ],
  },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/reports');
  const range = parseDateRange(await searchParams);
  const q = rangeQuery(range);

  return (
    <>
      <PageHeading
        title="Reports & Exports"
        description="Download CSV reports for the selected range. Every file is generated on demand for you alone, states its filters and data coverage at the top, protects against spreadsheet formula injection, and is recorded in the audit log. Internal notes, passwords and tokens are never exported."
      />
      <RangePicker action="/admin/reports" range={range} showCompare={false} />

      {REPORTS.map((group) => (
        <Panel key={group.group} title={group.group}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-2 rounded-xl border border-white/10 p-4"
              >
                <h3 className="text-on-ink text-sm font-semibold">{item.title}</h3>
                <p className="text-foreground-muted flex-1 text-xs text-pretty">{item.body}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <Link
                    href={`/admin/exports/${item.key}?${q}`}
                    prefetch={false}
                    className="text-on-ink font-medium underline underline-offset-2"
                  >
                    Download CSV
                  </Link>
                  <Link
                    href={`${item.view}?${q}`}
                    className="text-foreground-muted underline underline-offset-2"
                  >
                    View on screen
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <Panel title="Coverage">
        <ul className="text-foreground-muted flex list-disc flex-col gap-1.5 pl-5 text-xs text-pretty">
          <li>
            Website analytics exist only from the day this release was deployed; earlier traffic was
            never recorded.
          </li>
          <li>
            Product workflow actions come from the application audit log, recorded since August
            2026.
          </li>
          <li>
            Waitlist records are complete from the first signup; the expanded questionnaire
            questions exist only for answers given after 2026-10-18.
          </li>
          <li>
            Automated test records (reserved test email domains) are excluded from every aggregate.
          </li>
        </ul>
      </Panel>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { selectionText } from '@/lib/admin/labels';
import { logger } from '@/lib/logger';
import { parseDateRange, rangeQuery, rate } from '@/lib/admin/date-range';
import {
  businessJourneyLabel,
  businessStageLabel,
  challengeLabel,
  industryLabel,
  primaryGoalLabel,
  recruitmentStatusLabel,
  testingInterestLabel,
} from '@/lib/waitlist/options';
import { waitlistInsights, type WaitlistInsights } from '@/services/admin/reports';
import { listWaitlist, type WaitlistPage } from '@/services/waitlist/recruitment';
import {
  BarList,
  Panel,
  StatCard,
  TrendChart,
  formatNumber,
  formatPercent,
} from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Questionnaire responses' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Database values arrive as plain strings; each label helper maps its own enum. */
function counts(items: { value: string; count: number }[], label: (v: never) => string) {
  return items.map((i) => ({ label: label(i.value as never), value: i.count }));
}

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/questionnaire');
  const range = parseDateRange(await searchParams);
  const db = await createClient();

  let insights: WaitlistInsights | null = null;
  let recent: WaitlistPage | null = null;
  try {
    [insights, recent] = await Promise.all([
      waitlistInsights(db, range.from, range.to),
      listWaitlist(
        db,
        { completed: 'yes', sort: 'survey', from: range.fromDay, to: range.toDay, page: 1 },
        20,
      ),
    ]);
  } catch (error) {
    logger.error('admin.questionnaire_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  return (
    <>
      <PageHeading
        title="Questionnaire Responses"
        description="Answers to the optional questionnaire from people who signed up in the selected range. Every question is optional, so each chart counts only the people who answered it. Automated test records are excluded."
      >
        <Link
          href={`/admin/exports/questionnaire?${rangeQuery(range)}`}
          prefetch={false}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          Export summary CSV
        </Link>
      </PageHeading>
      <RangePicker action="/admin/questionnaire" range={range} showCompare={false} />

      {!insights ? (
        <Alert tone="error">
          <p>
            Questionnaire responses could not be loaded just now. Refresh the page to try again.
          </p>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Signups in range" value={formatNumber(insights.totals.signups)} />
            <StatCard
              label="Started the questionnaire"
              value={formatNumber(insights.totals.survey_started)}
              hint={
                formatPercent(rate(insights.totals.survey_started, insights.totals.signups)) +
                ' of signups'
              }
            />
            <StatCard
              label="Completed the questionnaire"
              value={formatNumber(insights.totals.survey_completed)}
              hint={
                formatPercent(rate(insights.totals.survey_completed, insights.totals.signups)) +
                ' of signups'
              }
            />
            <StatCard
              label="Gave a phone number"
              value={formatNumber(insights.totals.with_phone)}
            />
          </div>

          <Panel title="Signups by day" description="UTC days.">
            <TrendChart
              title="Signups by day"
              days={insights.daily.map((d) => ({ day: d.day, values: { signups: d.signups } }))}
              series={[{ key: 'signups', label: 'Signups' }]}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Where are you based? — country">
              <BarList
                unit="people"
                items={insights.countries.map((c) => ({ label: c.label, value: c.count }))}
              />
            </Panel>
            <Panel title="City, island or community">
              <BarList
                unit="people"
                items={insights.cities.map((c) => ({ label: c.label, value: c.count }))}
              />
            </Panel>
            <Panel title="Business journey">
              <BarList unit="people" items={counts(insights.journey, businessJourneyLabel)} />
            </Panel>
            <Panel title="Industry">
              <BarList unit="people" items={counts(insights.industry, industryLabel)} />
            </Panel>
            <Panel
              title="What they want Islanda to help with"
              description={`Select-all-that-apply. ${formatNumber(insights.totals.goal_respondents ?? 0)} respondents made ${formatNumber(insights.totals.goal_selections ?? 0)} selections, so the bars add up to more than the number of people.`}
            >
              <BarList unit="people" items={counts(insights.goal, primaryGoalLabel)} />
            </Panel>
            <Panel
              title="Challenges they face"
              description={`Select-all-that-apply. ${formatNumber(insights.totals.challenge_respondents ?? 0)} respondents made ${formatNumber(insights.totals.challenge_selections ?? 0)} selections. Answers from before multi-select count as one selection each.`}
            >
              <BarList unit="people" items={counts(insights.challenge, challengeLabel)} />
            </Panel>
            <Panel title="Business stage">
              <BarList unit="people" items={counts(insights.stage, businessStageLabel)} />
            </Panel>
            <Panel title="Interested in early access">
              <BarList
                unit="people"
                items={counts(insights.testing_interest, testingInterestLabel)}
              />
            </Panel>
            <Panel title="Willing to share feedback">
              <BarList
                unit="people"
                items={counts(insights.feedback_interest, testingInterestLabel)}
              />
            </Panel>
            <Panel title="Recruitment status (team)">
              <BarList unit="people" items={counts(insights.recruitment, recruitmentStatusLabel)} />
            </Panel>
          </div>

          <Panel
            title="Recent completed questionnaires"
            description="The 20 most recently completed in this range, with their own words. Open a person for every answer."
          >
            {!recent || recent.entries.length === 0 ? (
              <p className="text-foreground-muted text-sm">
                No completed questionnaires in this range.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-white/8">
                {recent.entries.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3 text-sm">
                    <Link
                      href={`/admin/waitlist/${e.id}`}
                      className="text-on-ink font-medium underline underline-offset-2"
                    >
                      {e.name || 'Unnamed signup'}
                    </Link>
                    <p className="text-foreground-muted text-xs">
                      {[
                        e.country,
                        e.industry ? industryLabel(e.industry) : null,
                        selectionText(e.primaryGoals, primaryGoalLabel) || null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No location, industry or goal given'}
                    </p>
                    {[e.goalOther, e.challengeOther, e.additionalInfo]
                      .filter(Boolean)
                      .map((text, i) => (
                        <p key={i} className="text-foreground text-pretty">
                          &ldquo;{text}&rdquo;
                        </p>
                      ))}
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

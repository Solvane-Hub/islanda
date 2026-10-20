import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  businessJourneyLabel,
  businessStageLabel,
  challengeLabel,
  industryLabel,
  primaryGoalLabel,
  testingInterestLabel,
} from '@/lib/waitlist/options';
import { getWaitlistDetail, type WaitlistEntry } from '@/services/waitlist/recruitment';
import { Panel } from '../../../_components/charts';
import { RecruitmentEditor } from '../../../_components/recruitment-editor';
import { SelectionList } from '../../../_components/selection-list';
import { requireAdminPage } from '../../../_lib/guard';

export const metadata: Metadata = { title: 'Waitlist signup' };

function when(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '—';
}

export default async function WaitlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/waitlist/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  let entry: WaitlistEntry | null = null;
  let failed = false;
  try {
    entry = await getWaitlistDetail(await createClient(), id);
  } catch (error) {
    failed = true;
    logger.error('admin.waitlist_detail_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }
  if (!failed && !entry) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-foreground-muted text-xs">
        <Link href="/admin/waitlist" className="underline underline-offset-2">
          Waitlist
        </Link>{' '}
        / Signup
      </nav>

      {failed || !entry ? (
        <Alert tone="error">
          <p>This signup could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <Detail entry={entry} />
      )}
    </>
  );
}

function Detail({ entry }: { entry: WaitlistEntry }) {
  const answer = (value: string | null | undefined, other?: string | null) =>
    value ? (
      <>
        {value}
        {other ? (
          <span className="text-foreground-muted block text-xs">&ldquo;{other}&rdquo;</span>
        ) : null}
      </>
    ) : (
      <span className="text-foreground-subtle">Not answered</span>
    );

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-on-ink flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-[-0.02em]">
          {entry.name || 'Unnamed signup'}
          {entry.isTest ? <Badge tone="neutral">Automated test record</Badge> : null}
        </h1>
        <p className="text-foreground-muted text-sm">
          Signed up {when(entry.signedUpAt)} ·{' '}
          {entry.surveyCompletedAt
            ? `Questionnaire completed ${when(entry.surveyCompletedAt)}`
            : entry.surveyStartedAt
              ? `Questionnaire started ${when(entry.surveyStartedAt)}, not completed`
              : 'Questionnaire not answered'}
          {entry.surveyUpdatedAt ? ` · answers last updated ${when(entry.surveyUpdatedAt)}` : ''}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Contact" description="Personal data — visible to administrators only.">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Email</dt>
            <dd>
              <a href={`mailto:${entry.email}`} className="break-all underline underline-offset-2">
                {entry.email}
              </a>
            </dd>
            <dt className="text-foreground-muted">Phone</dt>
            <dd>{entry.phone ?? <span className="text-foreground-subtle">Not given</span>}</dd>
            <dt className="text-foreground-muted">Business</dt>
            <dd>{answer(entry.businessName)}</dd>
          </dl>
          <p className="text-foreground-muted text-xs text-pretty">
            Their answers below express interest only. They are not consent to marketing, public
            testimonials or unrelated contact.
          </p>
        </Panel>

        <Panel title="Questionnaire answers">
          <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-[12rem_1fr] sm:gap-x-3">
            <dt className="text-foreground-muted">Based in</dt>
            <dd>{answer([entry.cityIsland, entry.country].filter(Boolean).join(', ') || null)}</dd>
            <dt className="text-foreground-muted">Business journey</dt>
            <dd>
              {answer(entry.businessJourney ? businessJourneyLabel(entry.businessJourney) : null)}
            </dd>
            <dt className="text-foreground-muted">Industry</dt>
            <dd>
              {answer(entry.industry ? industryLabel(entry.industry) : null, entry.industryOther)}
            </dd>
            <dt className="text-foreground-muted">Wants help with</dt>
            <dd>
              <SelectionList
                values={entry.primaryGoals}
                label={primaryGoalLabel}
                other={entry.goalOther}
              />
            </dd>
            <dt className="text-foreground-muted">Challenges</dt>
            <dd>
              <SelectionList
                values={entry.challenges}
                label={challengeLabel}
                other={entry.challengeOther}
              />
            </dd>
            <dt className="text-foreground-muted">Business stage</dt>
            <dd>{answer(entry.businessStage ? businessStageLabel(entry.businessStage) : null)}</dd>
            <dt className="text-foreground-muted">Early access</dt>
            <dd>
              {answer(entry.testingInterest ? testingInterestLabel(entry.testingInterest) : null)}
            </dd>
            <dt className="text-foreground-muted">Will share feedback</dt>
            <dd>
              {answer(entry.feedbackInterest ? testingInterestLabel(entry.feedbackInterest) : null)}
            </dd>
            <dt className="text-foreground-muted">Anything else</dt>
            <dd className="text-pretty whitespace-pre-line">{answer(entry.additionalInfo)}</dd>
          </dl>
        </Panel>
      </div>

      <Panel
        title="Pilot recruitment"
        description={`What the team has done. Last updated ${when(entry.recruitmentUpdatedAt)}. Saving records it in the audit log; nothing is sent to this person.`}
      >
        <RecruitmentEditor
          signupId={entry.id}
          personName={entry.name}
          status={entry.recruitmentStatus}
          notes={entry.recruitmentNotes}
          full={{
            contactedOn: entry.contactedOn,
            confirmedOn: entry.confirmedOn,
            testedOn: entry.testedOn,
            feedbackSummary: entry.feedbackSummary,
            feedbackLink: entry.feedbackLink,
          }}
        />
      </Panel>
    </>
  );
}

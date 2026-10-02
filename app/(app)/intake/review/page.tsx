import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight, Check, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries, listBusinesses, resolveCurrentBusiness } from '@/services/business';
import {
  getIntakeProfile,
  intakeProgress,
  hasDeclinedFunding,
  isKnowledgeEstablished,
  readKnowledge,
  type KnowledgeState,
} from '@/services/intake';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { BUSINESS_STAGE_LABELS, TOTAL_INTAKE_STEPS } from '@/lib/validation/intake';
import { cn } from '@/lib/utils/cn';
import { Alert } from '@/components/ui/alert';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { CompleteIntakeForm } from '../_components/complete-form';

export const metadata: Metadata = { title: 'Review your answers' };

/**
 * One of the five things Islanda knows.
 *
 * Blocks, not rows, and FIVE of them rather than six — the same five slots the
 * rail names and `readKnowledge()` computes. A screen that split stage and
 * location into two entries was describing the form, not the profile.
 *
 * A block can hold more than one line, because one piece of knowledge can have
 * more than one part: stage and location are two halves of one thing.
 */
interface Line {
  label?: string;
  value: string | null;
}

function Block({
  title,
  step,
  lines,
  state,
  /** Shown instead of the lines when the slot is known but holds no figure. */
  note,
  wide,
}: {
  title: string;
  step: number;
  lines: readonly Line[];
  state: KnowledgeState;
  note?: string;
  wide?: boolean;
}) {
  const established = isKnowledgeEstablished(state);
  const needsConfirmation = state === 'needs_confirmation';
  const action = established ? 'Edit' : needsConfirmation ? 'Review and confirm' : 'Answer this';
  const ariaAction = established ? 'Edit' : needsConfirmation ? 'Review and confirm' : 'Answer';
  return (
    <div className={cn('group flex flex-col gap-3', wide && 'sm:col-span-2')}>
      <SurfaceLabel as="dt" className="flex items-baseline justify-between gap-4">
        <span className="flex items-center gap-2">
          {/* Shape and colour, but the state is also written below. */}
          <span
            aria-hidden="true"
            className={cn(
              'flex size-3 shrink-0 items-center justify-center rounded-full',
              established ? 'bg-bahama-turquoise text-abyss' : 'ring-1 ring-white/44',
            )}
          >
            {established ? <Check className="size-1.5" strokeWidth={5} /> : null}
          </span>
          {title}
        </span>

        <Link
          href={`/intake?step=${step}`}
          aria-label={`${ariaAction} ${title.toLowerCase()}`}
          className="text-on-glass-subtle hover:text-bahama-turquoise inline-flex shrink-0 items-center gap-1.5 rounded-sm text-xs tracking-normal normal-case transition-colors duration-150 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {established ? (
            <>
              <Pencil aria-hidden="true" className="size-3" strokeWidth={1.75} />
              Edit
            </>
          ) : (
            <>
              {action}
              <ArrowRight aria-hidden="true" className="size-3" strokeWidth={2} />
            </>
          )}
        </Link>
      </SurfaceLabel>

      <dd className="flex min-w-0 flex-col gap-2">
        {note ? (
          <span className="text-on-ink-muted text-base text-pretty italic">{note}</span>
        ) : (
          lines.map((line) => (
            <span key={line.label ?? 'value'} className="flex min-w-0 flex-col gap-0.5">
              {line.label && line.value ? (
                <span className="text-2xs text-on-glass-subtle tracking-[0.1em] uppercase">
                  {line.label}
                </span>
              ) : null}
              <span
                className={cn(
                  'text-base whitespace-pre-wrap',
                  line.value ? 'text-on-ink' : 'text-on-glass-subtle',
                )}
              >
                {line.value ?? 'Not answered yet'}
              </span>
            </span>
          ))
        )}
      </dd>
    </div>
  );
}

/**
 * The business profile.
 *
 * Not "your form answers" — the founder's own words played back as the thing
 * Islanda holds about their business, headed by the business itself. There
 * is no analysis, no scoring and no interpretation on this page, because the
 * system has not performed any: the Knowledge and AI layers do not exist yet.
 * It says what it holds, and where it holds nothing it says that too.
 */
export default async function IntakeReviewPage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);
  if (!current) redirect('/intake');

  const [profile, countries] = await Promise.all([
    getIntakeProfile(db, current.id),
    getActiveCountries(db),
  ]);
  if (!profile) redirect('/intake');

  const progress = intakeProgress(profile);
  const knowledge = new Map(readKnowledge(profile).map((entry) => [entry.slot.id, entry]));
  const countryName =
    countries.find((c) => c.code === current.country_code)?.name ?? current.country_code;

  const stage = profile.business_stage
    ? (BUSINESS_STAGE_LABELS[profile.business_stage as keyof typeof BUSINESS_STAGE_LABELS] ??
      profile.business_stage)
    : null;
  const money =
    profile.funding_requirement_amount !== null
      ? `${profile.funding_requirement_currency ?? ''} ${Number(profile.funding_requirement_amount).toLocaleString()}`.trim()
      : null;
  const declinedFunding = hasDeclinedFunding(profile);

  const knownCount = progress.completed;
  // A profile the founder already finished stays finished even if a slot was
  // recorded before the funding question became explicit.
  const ready = knownCount >= TOTAL_INTAKE_STEPS || progress.isComplete;

  return (
    <div className="workspace-env flex flex-col gap-6 pt-4 sm:gap-8 sm:pt-8 lg:pt-10">
      <header className="flex flex-col gap-3 px-1">
        <p className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
          Business profile
        </p>
        <h1 className="text-on-ink text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
          {current.name}
        </h1>
        <p className="text-on-ink-muted flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <span>{countryName}</span>
          {current.industry ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{current.industry}</span>
            </>
          ) : null}
        </p>
      </header>

      <WorkspaceSurface className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-white/8 px-6 py-4 sm:px-9">
          <SurfaceLabel>What Islanda knows</SurfaceLabel>
          <p className="text-on-ink-muted text-xs">
            <span data-numeric className="text-on-ink font-medium">
              {knownCount}
            </span>{' '}
            of <span data-numeric>{TOTAL_INTAKE_STEPS}</span> established
          </p>
        </div>

        <dl className="grid gap-8 p-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-9 sm:p-9 lg:p-10">
          <Block
            title="What the business does"
            step={1}
            state={knowledge.get('business')?.state ?? 'unknown'}
            lines={[{ value: profile.description }]}
            wide
          />
          <Block
            title="Stage and location"
            step={2}
            state={knowledge.get('stage')?.state ?? 'unknown'}
            lines={[
              { label: 'Stage', value: stage },
              { label: 'Operating in', value: profile.location },
            ]}
          />
          <Block
            title="Team"
            step={3}
            state={knowledge.get('team')?.state ?? 'unknown'}
            lines={[
              {
                value:
                  profile.employee_count === null
                    ? null
                    : profile.employee_count === 1
                      ? 'Just you'
                      : `${profile.employee_count} people`,
              },
            ]}
          />
          <Block
            title="Funding"
            step={4}
            state={knowledge.get('funding')?.state ?? 'unknown'}
            lines={[{ value: money }]}
            // "Doesn't know yet" is a recorded answer, not an empty field.
            {...(money === null && declinedFunding
              ? { note: 'You said you don’t know a figure yet.' }
              : {})}
          />
          <Block
            title="Goals"
            step={5}
            state={knowledge.get('goals')?.state ?? 'unknown'}
            lines={[{ value: profile.founder_goals }]}
          />
        </dl>
      </WorkspaceSurface>

      {ready ? (
        <WorkspaceSurface
          as="section"
          tone="deep"
          aria-labelledby="finish-heading"
          className="flex flex-col gap-5 p-6 sm:p-9"
        >
          {progress.isComplete ? (
            <Alert tone="success" title="Intake complete">
              You can still edit any answer.
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3">
            <h2
              id="finish-heading"
              className="text-on-ink text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
            >
              Ready when you are
            </h2>
            <p className="text-on-ink-muted max-w-xl text-sm text-pretty">
              Islanda will use this profile to work out your requirements once the knowledge and AI
              layers are built. Nothing is submitted to any government agency.
            </p>
          </div>

          <CompleteIntakeForm />
        </WorkspaceSurface>
      ) : (
        <WorkspaceSurface tone="deep" className="p-6 sm:p-9">
          <Alert tone="info" title="A few things are still unanswered">
            Islanda needs all five before it can act on the profile.{' '}
            <Link href="/intake" className="text-bahama-turquoise underline underline-offset-4">
              Continue intake
            </Link>
          </Alert>
        </WorkspaceSurface>
      )}
    </div>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/services/auth';
import { getActiveCountries, listBusinesses, resolveCurrentBusiness } from '@/services/business';
import {
  startOrResumeIntake,
  intakeProgress,
  isSlotKnownForStep,
  isKnowledgeEstablished,
  readKnowledge,
  hasDeclinedFunding,
} from '@/services/intake';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import {
  BUSINESS_STAGES,
  BUSINESS_STAGE_LABELS,
  INTAKE_STEPS,
  stepFromParam,
  TOTAL_INTAKE_STEPS,
} from '@/lib/validation/intake';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WorkspaceCanvas } from '@/components/ui/workspace-canvas';
import { WorkspaceSurface } from '@/components/ui/workspace-surface';
import { StepForm } from './_components/step-form';
import { IntakeProgress, type RailSlot } from './_components/progress';
import type { IntakeValues, StageOption } from './_components/step-fields';

export const metadata: Metadata = { title: 'About your business' };

/**
 * Business intake — one question at a time.
 *
 * The focal question on each step is the field's own LABEL, set at display
 * size, rather than a headline above a small label. That keeps one accessible
 * name per control, keeps the exact question wording the flow has always used,
 * and means the biggest text on the page is the thing the founder has to
 * answer.
 *
 * This component reads state and hands `StepForm` plain values. It does NOT
 * build the fields: the fields depend on validation state that only exists
 * inside the client component, and a render prop reaching across that boundary
 * is not something React can serialise.
 *
 * Everything visible comes from the profile row or `INTAKE_STEPS`. The screen
 * makes no claim about what Islanda will do with an answer beyond what the
 * existing copy already said.
 */
export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const db = await createClient();
  const [user, businesses, store, params] = await Promise.all([
    getCurrentUser(db),
    listBusinesses(db),
    cookies(),
    searchParams,
  ]);

  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) {
    return (
      <WorkspaceCanvas>
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold tracking-tight">About your business</h1>
          <EmptyState
            title="Create your business first"
            explanation="These questions describe a business, so you need to create one first: its name, the country it operates in, and what it does."
            nextStep="Create your business to begin."
            action={
              <Link href="/businesses/new" className={buttonVariants()}>
                Create your business
              </Link>
            }
          />
        </div>
      </WorkspaceCanvas>
    );
  }

  // Creating the profile on load is what makes the flow resumable: the row must
  // exist before the first answer is submitted.
  const profile = await startOrResumeIntake(db, current.id, user!.id);
  const progress = intakeProgress(profile);
  const knowledge = readKnowledge(profile);
  const firstUnresolved = knowledge.find((entry) => !isKnowledgeEstablished(entry.state));
  const step = stepFromParam(params.step, (firstUnresolved?.slot.step ?? TOTAL_INTAKE_STEPS) - 1);
  const meta = INTAKE_STEPS[step - 1]!;
  const isLastStep = step === TOTAL_INTAKE_STEPS;

  // "Saved" is a fact about the row, not an optimistic UI state — and it asks
  // whether THIS slot is held, not how far the founder has walked. When Nova
  // can establish a fact, a step it filled reads as saved without the founder
  // having opened the page.
  const answered = isSlotKnownForStep(profile, step);

  // The currency is derived from the business's country by `saveStep`, never
  // typed in. Showing it is therefore a statement about what will be stored.
  const countries = step === 4 ? await getActiveCountries(db) : [];
  const currency = countries.find((c) => c.code === current.country_code)?.currency_code ?? null;

  // Short forms for the rail. The full question stays the page's headline.
  const RAIL_LABELS: Record<string, string> = {
    business: 'About',
    stage: 'Stage',
    team: 'Team',
    funding: 'Money',
    goals: 'Goals',
  };
  const slots: RailSlot[] = knowledge.map((k) => ({
    step: k.slot.step,
    label: RAIL_LABELS[k.slot.id] ?? k.slot.title,
    known: isKnowledgeEstablished(k.state),
  }));

  // Plain values only. Every prop below crosses into a Client Component.
  const values: IntakeValues = {
    description: profile.description ?? '',
    businessStage: profile.business_stage ?? '',
    location: profile.location ?? '',
    employeeCount: profile.employee_count ?? 0,
    fundingAmount:
      profile.funding_requirement_amount !== null &&
      profile.funding_requirement_amount !== undefined
        ? String(profile.funding_requirement_amount)
        : '',
    fundingUnknown: hasDeclinedFunding(profile),
    founderGoals: profile.founder_goals ?? '',
  };

  // Read here so the client bundle never has to import the Zod module the
  // vocabulary lives beside.
  const stages: StageOption[] = BUSINESS_STAGES.map((value) => ({
    value,
    label: BUSINESS_STAGE_LABELS[value],
  }));

  return (
    <div className="workspace-env flex flex-col gap-6 pt-4 sm:gap-8 sm:pt-8 lg:pt-10">
      <header className="flex flex-col gap-1.5 px-1">
        <p className="text-2xs text-champagne min-w-0 truncate font-medium tracking-[0.18em] uppercase">
          {current.name}
        </p>
        <h1 className="text-on-ink text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          About your business
        </h1>
        <p className="text-on-ink-muted max-w-xl text-sm text-pretty">
          Five short questions. Your answer is saved each time you continue, so you can stop and
          come back later.
        </p>
      </header>

      <WorkspaceSurface className="flex flex-col">
        <div className="border-b border-white/8 px-5 py-4 sm:px-9 lg:px-12">
          <IntakeProgress
            completed={progress.completed}
            total={progress.total}
            current={step}
            title={meta.title}
            slots={slots}
          />
        </div>

        {/* Keyed by step so each question gets a fresh form. Without it the
            instance survived the client navigation from step 4 to step 5 with
            step 4's successful save still in its action state; `isLastStep`
            flipping to true re-ran the redirect effect, and the founder was
            sent to the review page without ever seeing question 5. */}
        <StepForm
          key={step}
          step={step}
          totalSteps={TOTAL_INTAKE_STEPS}
          isLastStep={isLastStep}
          answered={answered}
          values={values}
          stages={stages}
          currency={currency}
        />
      </WorkspaceSurface>
    </div>
  );
}

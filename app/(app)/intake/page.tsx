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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WorkspaceCanvas } from '@/components/ui/workspace-canvas';
import { WorkspaceSurface } from '@/components/ui/workspace-surface';
import { StepForm } from './_components/step-form';
import { IntakeProgress, type RailSlot } from './_components/progress';
import type { IntakeValues, StageOption } from './_components/step-fields';

export const metadata: Metadata = { title: 'Business intake' };

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
          <h1 className="text-2xl font-semibold tracking-tight">Business intake</h1>
          <EmptyState
            title="No business yet"
            explanation="Intake collects the details Islanda needs to work out your requirements — so it needs a business first."
            nextStep="Create a business to begin."
            action={
              <Link href="/businesses/new">
                <Button>Create a business</Button>
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
    business: 'Business',
    stage: 'Stage',
    team: 'Team',
    funding: 'Funding',
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
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1">
        <h1 className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
          Business intake
        </h1>
        <p className="text-on-ink-muted min-w-0 truncate text-sm">{current.name}</p>
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

        <StepForm
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Plus, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/services/auth';
import { getOwnProfile } from '@/services/profile';
import {
  getActiveCountries,
  getBusinessIdentifiers,
  listBusinesses,
  resolveCurrentBusiness,
} from '@/services/business';
import {
  getIntakeProfile,
  intakeProgress,
  isKnowledgeEstablished,
  readKnowledge,
} from '@/services/intake';
import { getGoalProgress } from '@/services/goals';
import { getBusinessMetrics, getFinancialPeriods } from '@/services/financials';
import { getEvidenceForMetrics } from '@/services/evidence';
import { getBusinessDocuments } from '@/services/documents';
import { buildJourney, type Milestone } from '@/services/progress';
import { toNovaBusinessFacts } from '@/services/nova/business-awareness';
import type { BusinessPassport } from '@/services/passport';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  formatGoalValue,
} from '@/lib/business-intelligence/goal-display';
import { buildPerformanceView } from '@/lib/business-intelligence/performance';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { WorkspaceCanvas } from '@/components/ui/workspace-canvas';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { provenanceKindFor } from '@/components/ui/provenance-badge';
import { BusinessSnapshot, type SnapshotRow } from '../_components/business-snapshot';
import { BusinessCommandCenter } from '../_components/business-command-center';
import { DashboardPriorities, type PriorityItem } from '../_components/dashboard-priorities';
import { NovaInvite } from '../_components/nova-invite';
import { PerformanceModule } from '../_components/performance-module';
import { GoalsModule, type GoalItem } from '../_components/goals-module';
import { DocumentsModule } from '../_components/documents-module';
import { NovaFinance } from '../_components/nova-finance';
import { NAV_ITEMS } from '../_components/nav-items';

export const metadata: Metadata = { title: 'Home' };

/** Business lifecycle states, in the words a business owner would use. */
const STATUS: Record<string, string> = {
  draft: 'Getting started',
  intake_started: 'Answering questions',
  intake_complete: 'Questions answered',
  launch_plan_generated: 'Plan ready',
  active: 'Active',
  archived: 'Archived',
};

/**
 * Home — the business workspace.
 *
 * Answers three questions, in this order:
 *
 *   1. What do I need to do next?        → one primary action
 *   2. What is the state of my business? → what you've told Islanda, and progress
 *   3. Where do I go to do it?           → goals, documents, money; get help
 *
 * Everything comes from data the founder supplied, `buildJourney()`, or the
 * fixed foundational cascade below — no invented tasks, percentages, figures
 * or requirements. Surfaces that are not built are named once, quietly, at the
 * bottom, rather than as a grid of doors.
 *
 * Constitution, Truth Before Fluency: a fabricated requirement is
 * indistinguishable from a real one to a founder acting on it. Nothing here is
 * invented, and unanswered fields say so rather than being filled with dashes.
 */
export default async function DashboardPage() {
  const db = await createClient();
  const [user, businesses, store, profile] = await Promise.all([
    getCurrentUser(db),
    listBusinesses(db),
    cookies(),
    getOwnProfile(db),
  ]);

  const greeting = profile?.full_name?.split(' ')[0] ?? null;
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) {
    return (
      <WorkspaceCanvas>
        <div className="flex flex-col gap-8">
          <PageHeader
            title={greeting ? `Welcome, ${greeting}` : 'Welcome'}
            description={
              user?.email
                ? `This is your business workspace. You're signed in as ${user.email}.`
                : 'This is your business workspace.'
            }
          />
          <EmptyState
            icon={<Store aria-hidden="true" className="size-5" strokeWidth={1.75} />}
            title="Let's get your business information together"
            explanation="Start by creating your business: its name, the country it operates in, and what it does. Then a few short questions help you describe it. Your answers are saved as you go."
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

  const [intake, countries, identifiers, metrics, periods, documents] = await Promise.all([
    getIntakeProfile(db, current.id),
    getActiveCountries(db),
    getBusinessIdentifiers(db, current.id),
    getBusinessMetrics(db, current.id),
    getFinancialPeriods(db, current.id),
    getBusinessDocuments(db, current.id),
  ]);
  const goalsWithProgress = await getGoalProgress(db, current.id, metrics);
  // Evidence for whatever metrics exist — cheap at today's volumes (P8
  // activation, Milestone 3), and depends on knowing metric ids first, so it
  // cannot join the batch above.
  const evidenceByMetricId = await getEvidenceForMetrics(
    db,
    current.id,
    metrics.map((m) => m.id),
  );

  const isManage = current.business_mode === 'manage';
  const journey = buildJourney(current, intake);
  const progress = intakeProgress(intake);
  const status = STATUS[current.status] ?? current.status;

  // The country is stored as an ISO code; the founder should read the name.
  const countryName =
    countries.find((c) => c.code === current.country_code)?.name ?? current.country_code;

  // The resolved-value business facts, shaped exactly like `BusinessPassport`'s
  // own `identity`/`definition` (P7 Milestone 5) — `current` and `intake` are
  // already in hand, so this is the same derivation Passport composes from
  // (`toNovaBusinessFacts`), not a second query. Command Centre is the one
  // place these facts render; identifiers are never part of this shape.
  const passportFacts = toNovaBusinessFacts(current, intake);
  const commandCenterIdentity: BusinessPassport['identity'] = {
    legalName: passportFacts.legalName,
    tradingName: passportFacts.tradingName,
    businessType: passportFacts.businessType,
    industry: passportFacts.industry,
    countryCode: current.country_code,
    jurisdictionName: countryName,
    stage: passportFacts.stage,
    operatingStatus: passportFacts.operatingStatus,
  };
  const commandCenterDefinition: BusinessPassport['definition'] = {
    activities: passportFacts.activities,
    productsServices: passportFacts.productsServices,
    targetCustomers: passportFacts.targetCustomers,
    location: passportFacts.location,
    employeeCount: passportFacts.employeeCount,
    founderGoals: passportFacts.founderGoals,
  };

  const knowledge = new Map(readKnowledge(intake).map((entry) => [entry.slot.id, entry]));
  const stage = intake?.business_stage
    ? (BUSINESS_STAGE_LABELS[intake.business_stage as BusinessStage] ?? intake.business_stage)
    : undefined;
  const stageAndLocation = [stage, intake?.location].filter(Boolean).join(' · ') || undefined;
  const funding =
    intake?.funding_requirement_amount !== null && intake?.funding_requirement_amount !== undefined
      ? `${intake.funding_requirement_currency ?? ''} ${Number(
          intake.funding_requirement_amount,
        ).toLocaleString()}`.trim()
      : undefined;

  // The same five slots read by intake and review. Their state is shown even
  // when a value is absent, so incomplete knowledge never disappears from the
  // founder's understanding of the business.
  const rows: SnapshotRow[] = [
    {
      label: 'What it does',
      value: intake?.description ?? undefined,
      href: '/intake?step=1',
      state: knowledge.get('business')?.state ?? 'unknown',
    },
    {
      label: 'Stage and location',
      value: stageAndLocation,
      href: '/intake?step=2',
      state: knowledge.get('stage')?.state ?? 'unknown',
    },
    {
      label: 'Team',
      value:
        typeof intake?.employee_count === 'number'
          ? intake.employee_count === 1
            ? 'Just you'
            : `${intake.employee_count} people`
          : undefined,
      href: '/intake?step=3',
      state: knowledge.get('team')?.state ?? 'unknown',
    },
    {
      label: 'Money needed',
      value: funding,
      href: '/intake?step=4',
      state: knowledge.get('funding')?.state ?? 'unknown',
    },
    {
      label: 'Your goals',
      value: intake?.founder_goals ?? undefined,
      href: '/intake?step=5',
      state: knowledge.get('goals')?.state ?? 'unknown',
    },
  ];

  // What requires attention, from real state only: the intake slots that are
  // not yet established. Each links to the route that resolves it — no invented
  // tasks. The next move (below) is derived by buildJourney().
  const openItems: PriorityItem[] = rows
    .filter((row) => !isKnowledgeEstablished(row.state ?? 'unknown'))
    .map((row) => ({ label: row.label, href: row.href }));

  // The founder journey (`buildJourney`) only ever proposes two real moves —
  // create a business, complete intake — and falls silent once intake is
  // done, because roadmap/compliance/funding are deliberately `blocked` until
  // those capabilities exist (services/progress). That silence is real: once
  // intake is complete there is no deterministic "next move" today unless one
  // is derived from the other foundational state already on this page.
  //
  // This is a fixed, three-step cascade over existing state — not a
  // recommendation engine. Exactly one fires, in this order, and only once
  // intake is done (`journey.next` already owns the slot until then): record
  // a first financial figure, set a first goal, add a first document. Each
  // reuses the exact route/anchor its own module already offers.
  const foundationalPriority: Pick<
    Milestone,
    'title' | 'href' | 'description' | 'actionLabel'
  > | null = journey.next
    ? null
    : metrics.length === 0
      ? {
          title: 'Record your first sales or expense figure',
          href: '/dashboard#financials',
          description:
            'For example, what you sold or spent last month. It helps you see how the business is doing over time.',
          actionLabel: 'Record a figure',
        }
      : goalsWithProgress.length === 0
        ? {
            title: 'Set your first goal',
            href: '/dashboard#goals',
            description: 'Write down one thing you want the business to achieve.',
            actionLabel: 'Set a goal',
          }
        : documents.length === 0
          ? {
              title: 'Add your first document',
              href: '/documents',
              description:
                'Keep a receipt, licence or statement in private storage for your business.',
              actionLabel: 'Add a document',
            }
          : null;

  const nextMove: Milestone | null =
    journey.next ??
    (foundationalPriority
      ? {
          key: 'foundational-action',
          title: foundationalPriority.title,
          description: foundationalPriority.description,
          state: 'current',
          href: foundationalPriority.href,
          ...(foundationalPriority.actionLabel
            ? { actionLabel: foundationalPriority.actionLabel }
            : {}),
        }
      : null);

  // ── Command-centre modules — real P2 data only, never fabricated ──────────
  const performanceView = buildPerformanceView(periods, metrics);
  const periodOptions = periods.map((p) => ({ id: p.id, label: p.label ?? p.period_start }));
  const documentOptions = documents.map((d) => ({ id: d.id, title: d.title }));

  const goalItems: GoalItem[] = goalsWithProgress.map(({ goal, progress }) => ({
    id: goal.id,
    title: goal.title,
    typeLabel: GOAL_TYPE_LABELS[goal.goal_type],
    statusLabel: GOAL_STATUS_LABELS[goal.status],
    targetLabel:
      goal.target_value !== null
        ? formatGoalValue(Number(goal.target_value), goal.target_currency)
        : null,
    percent: progress.percent,
    currentLabel:
      progress.currentValue !== null
        ? formatGoalValue(progress.currentValue, goal.target_currency)
        : null,
    currentProvenanceKind: progress.currentValueProvenance
      ? provenanceKindFor(progress.currentValueProvenance, 'unverified')
      : null,
    // Only a regulatory question Nova can genuinely answer today.
    novaQuestion:
      goal.goal_type === 'obtain_licence'
        ? `What licence do I need for ${current.industry ? `a ${current.industry.toLowerCase()} business` : 'my business'} in ${countryName}?`
        : null,
  }));

  const comingLater = NAV_ITEMS.filter((item) => !item.available);
  const answeredCount = progress.completed;

  return (
    <div className="workspace-env flex flex-col gap-4 sm:gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-2 sm:pt-3">
        <div className="min-w-0">
          <p className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
            {greeting ? `Welcome back, ${greeting}` : 'Welcome back'}
          </p>
          <h1 className="text-on-ink mt-1.5 text-xl font-semibold tracking-[-0.02em] text-balance sm:text-2xl">
            {current.name}
          </h1>
          <p className="text-on-ink-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <span>{countryName}</span>
            {current.industry ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{current.industry}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="text-on-ink">{status}</span>
          </p>
        </div>

        <Link
          href="/businesses/new"
          className="text-on-ink-muted hover:text-on-ink inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm text-sm transition-colors duration-150"
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
          Add another business
        </Link>
      </header>

      {/* 1 — What to do next. One primary action. */}
      <DashboardPriorities nextMove={nextMove} openItems={openItems} />

      {/* 2 — The state of the business: what it has been told, and progress. */}
      <WorkspaceSurface
        as="section"
        tone="shell"
        aria-labelledby="snapshot-heading"
        className="flex flex-col gap-6 p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <SurfaceLabel as="h2" id="snapshot-heading">
              Your business information
            </SurfaceLabel>
            <p className="text-on-ink-muted text-sm">
              Based on what you told Islanda. Change anything at any time.
            </p>
          </div>
          <Link
            href="/passport"
            className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-11 items-center rounded-sm text-sm font-medium transition-colors duration-150"
          >
            See it all in My Business
          </Link>
        </div>

        <div className="flex max-w-md flex-col gap-2">
          {/* Counts, not a percentage: "3 of 5 questions" is the shape of the data. */}
          <Progress
            value={answeredCount}
            max={progress.total}
            showPercent={false}
            label="Questions answered"
            caption={`${answeredCount} of ${progress.total} questions answered`}
          />
        </div>

        {/* An existing business carries many more recorded details. They are
            one tap away rather than in front of the next step. */}
        {isManage ? (
          <details className="group rounded-xl border border-white/8">
            <summary className="text-on-ink flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
              Business setup details: name, type, registration
              <span
                aria-hidden="true"
                className="text-on-ink-muted transition-transform duration-200 group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="border-t border-white/8 p-4 sm:p-5">
              <BusinessCommandCenter
                identity={commandCenterIdentity}
                definition={commandCenterDefinition}
                identifiers={identifiers}
              />
            </div>
          </details>
        ) : null}

        <BusinessSnapshot rows={rows} unanswered={progress.total - progress.completed} />
      </WorkspaceSurface>

      {/* 3 — Where to do things: goals and documents, then money. */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <div id="goals" className="min-w-0 scroll-mt-4">
          <GoalsModule items={goalItems} />
        </div>
        <DocumentsModule documents={documents} />
      </div>

      <div id="financials" className="flex scroll-mt-4 flex-col gap-4 sm:gap-5">
        <PerformanceModule
          view={performanceView}
          periods={periodOptions}
          documents={documentOptions}
          evidenceByMetricId={evidenceByMetricId}
        />
        {/* Asking about figures only makes sense once there are figures. */}
        {performanceView.hasData ? <NovaFinance /> : null}
      </div>

      <NovaInvite />

      {/* Not built yet — named once, quietly, with no door to a dead end. */}
      {comingLater.length > 0 ? (
        <p className="text-on-ink-muted px-1 pb-2 text-sm text-pretty">
          <span className="text-on-ink font-medium">Coming later:</span>{' '}
          {comingLater.map((item) => item.label.toLowerCase()).join(', ')}. We&apos;re working on
          these, and they aren&apos;t available yet.
        </p>
      ) : null}
    </div>
  );
}

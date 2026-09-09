import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Plus, Rocket } from 'lucide-react';
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
import { getBusinessDocuments } from '@/services/documents';
import { buildJourney } from '@/services/progress';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  formatGoalValue,
} from '@/lib/business-intelligence/goal-display';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceCanvas } from '@/components/ui/workspace-canvas';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { provenanceKindFor } from '@/components/ui/provenance-badge';
import { BusinessSnapshot, type SnapshotRow } from '../_components/business-snapshot';
import { BusinessCommandCenter } from '../_components/business-command-center';
import { DashboardPriorities, type PriorityItem } from '../_components/dashboard-priorities';
import { DashboardQuickActions } from '../_components/dashboard-quick-actions';
import { IntakeDial } from '../_components/intake-dial';
import { NovaInvite } from '../_components/nova-invite';
import { RouteSummary } from '../_components/route-summary';
import { SurfaceTiles } from '../_components/surface-tiles';
import { PerformanceModule } from '../_components/performance-module';
import { GoalsModule, type GoalItem } from '../_components/goals-module';
import { DocumentsModule } from '../_components/documents-module';

export const metadata: Metadata = { title: 'Dashboard' };

const STATUS: Record<string, string> = {
  draft: 'Draft',
  intake_started: 'Intake in progress',
  intake_complete: 'Intake complete',
  launch_plan_generated: 'Launch plan ready',
  active: 'Active',
  archived: 'Archived',
};

/**
 * The founder briefing.
 *
 * Four questions in order: where am I, what do I do next, what does FoundryAI
 * know, where am I on the route. Everything on the page comes from data the
 * founder already supplied or from `buildJourney()` — no metrics, no activity,
 * no charts of nothing.
 *
 * The composition is one instrument panel, not a grid of cards. The identity
 * zone sits directly on the water; the shell below it holds four modules
 * separated by hairlines rather than by gaps, because they are sections of one
 * reading rather than four independent widgets. The tiles underneath are the
 * only free-standing objects, and that is deliberate — they are the surfaces
 * that are not part of the instrument yet.
 *
 * Constitution, Truth Before Fluency: a fabricated requirement is
 * indistinguishable from a real one to a founder acting on it. Nothing here is
 * invented, and unanswered fields are omitted rather than filled with dashes.
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
                ? `You're signed in as ${user.email}. Let's set up your first business.`
                : "Let's set up your first business."
            }
          />
          <EmptyState
            icon={<Rocket aria-hidden="true" className="size-5" strokeWidth={1.75} />}
            title="You haven't created a business yet"
            explanation="FoundryAI works out what your business needs — registrations, licences, permits and funding — from the country and industry you're operating in."
            nextStep="Start by telling us what you're building."
            action={
              <Link href="/businesses/new">
                <Button>Create your first business</Button>
              </Link>
            }
          />
        </div>
      </WorkspaceCanvas>
    );
  }

  const [intake, countries, identifiers, goalsWithProgress, metrics, periods, documents] =
    await Promise.all([
      getIntakeProfile(db, current.id),
      getActiveCountries(db),
      getBusinessIdentifiers(db, current.id),
      getGoalProgress(db, current.id),
      getBusinessMetrics(db, current.id),
      getFinancialPeriods(db, current.id),
      getBusinessDocuments(db, current.id),
    ]);
  const isManage = current.business_mode === 'manage';
  const journey = buildJourney(current, intake);
  const progress = intakeProgress(intake);
  const intakeComplete = Boolean(intake?.completed_at);
  const status = STATUS[current.status] ?? current.status;

  // The country is stored as an ISO code; the founder should read the name.
  const countryName =
    countries.find((c) => c.code === current.country_code)?.name ?? current.country_code;

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
      label: 'Business',
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
      label: 'Funding',
      value: funding,
      href: '/intake?step=4',
      state: knowledge.get('funding')?.state ?? 'unknown',
    },
    {
      label: 'Goals',
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

  // ── Command-centre modules (P3) — real P2 data only, never fabricated ──────
  const periodLabels = new Map(periods.map((p) => [p.id, p.label ?? p.period_start]));

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

  // Performance leads for a running (Manage) business, or once any figures exist.
  // For a brand-new Build business with no data it is not forced to the top.
  const showPerformance = isManage || metrics.length > 0;

  return (
    <div className="workspace-env flex flex-col gap-3 sm:gap-4">
      {/*
        Compact contextual header — "where am I" without the business name
        occupying half the viewport. The name moves into the context line; the
        heading names the surface, the way the reference's "Project Overview"
        does.
      */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-2 sm:pt-3">
        <div className="min-w-0">
          <p className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
            {greeting ? `${greeting}’s workspace` : 'Workspace'}
          </p>
          <h1 className="text-on-ink mt-1.5 text-xl font-semibold tracking-[-0.02em] text-balance sm:text-2xl">
            Business overview
          </h1>
          <p className="text-on-ink-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <span className="text-on-ink font-medium">{current.name}</span>
            <span aria-hidden="true" className="h-3 w-px bg-white/15" />
            <span>{countryName}</span>
            {current.industry ? (
              <>
                <span aria-hidden="true" className="text-on-glass-subtle">
                  ·
                </span>
                <span>{current.industry}</span>
              </>
            ) : null}
            <span aria-hidden="true" className="h-3 w-px bg-white/15" />
            <span className="text-on-ink">{status}</span>
          </p>
        </div>

        <Link href="/businesses/new" className="shrink-0">
          <Button variant="secondary" size="sm" className="rounded-full">
            <Plus aria-hidden="true" strokeWidth={2} />
            Add business
          </Button>
        </Link>
      </header>

      {/*
        Command centre — the imported business as a first-class object. Shown for
        Manage-mode businesses, where identity and records are the point; Build
        mode leads with the intake snapshot below instead.
      */}
      {isManage ? (
        <WorkspaceSurface
          as="section"
          tone="shell"
          aria-labelledby="command-center-heading"
          className="flex flex-col gap-7 p-6 sm:p-8"
        >
          <SurfaceLabel id="command-center-heading">
            Here&apos;s what I know about your business
          </SurfaceLabel>
          <BusinessCommandCenter
            object={{ business: current, profile: intake, identifiers }}
            countryName={countryName}
          />
        </WorkspaceSurface>
      ) : null}

      {/*
        The spatial workspace — not a stack of equal cards. A quiet secondary
        control column on the left (recessed inset surfaces), the dominant
        business-intelligence workspace on the right (a lifted shell), the
        founder journey sitting DIRECTLY on the workspace beneath it (no card),
        Nova as an atmospheric presence beside the journey, and one floating
        panel breaking the grid at the foreground. Materials differ by role, so
        the surfaces read at different depths rather than as one card grid.
      */}
      <div className="relative grid gap-3.5 sm:gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — secondary control column. Recessed, dense, quiet. */}
        <div className="flex flex-col gap-3.5 sm:gap-4">
          <DashboardPriorities nextMove={journey.next} openItems={openItems} className="flex-1" />
          <IntakeDial completed={progress.completed} total={progress.total} />
        </div>

        {/* RIGHT — the dominant workspace, then journey · Nova. */}
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          {/* PRIMARY — FoundryAI's understanding of the business. Lifted, spacious. */}
          <WorkspaceSurface
            as="section"
            tone="shell"
            aria-labelledby="snapshot-heading"
            className="flex flex-col gap-7 p-6 sm:p-8 lg:p-9"
          >
            <div className="flex flex-col gap-2.5">
              <SurfaceLabel id="snapshot-heading">What FoundryAI knows</SurfaceLabel>
              {intake?.description ? (
                <p className="text-on-ink max-w-2xl text-lg leading-relaxed text-pretty italic sm:text-xl">
                  “{intake.description}”
                </p>
              ) : null}
            </div>
            <BusinessSnapshot rows={rows} unanswered={progress.total - progress.completed} />
          </WorkspaceSurface>

          {/* JOURNEY (on the workspace) · NOVA (atmospheric presence). */}
          <div className="relative grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section
              aria-labelledby="route-heading"
              className="flex min-w-0 flex-col gap-6 px-1 pt-1"
            >
              <SurfaceLabel id="route-heading">Founder journey</SurfaceLabel>
              <RouteSummary milestones={journey.milestones} />
            </section>

            <NovaInvite />

            {/* FLOATING — foreground utility, overlapping the workspace edge. */}
            <DashboardQuickActions
              intakeComplete={intakeComplete}
              className="mt-1 lg:absolute lg:right-1 lg:-bottom-5 lg:z-20 lg:mt-0 lg:w-56"
            />
          </div>
        </div>
      </div>

      {/*
        Command centre modules — performance, goals and documents, from real P2
        data. Performance leads for a running business or once figures exist;
        goals and documents always show, with honest empty states and their own
        create/upload paths. No fabricated metrics, progress or records.
      */}
      <section
        aria-labelledby="command-modules-heading"
        className="mt-2 flex flex-col gap-3.5 sm:gap-4"
      >
        <SurfaceLabel id="command-modules-heading" className="px-1">
          Your business
        </SurfaceLabel>
        {showPerformance ? (
          <PerformanceModule metrics={metrics} periodLabels={periodLabels} />
        ) : null}
        <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
          <GoalsModule items={goalItems} />
          <DocumentsModule documents={documents} />
        </div>
      </section>

      {/* Directly on the workspace — the rooms that are coming online. */}
      <section aria-labelledby="surfaces-heading" className="mt-2 flex flex-col gap-3">
        <SurfaceLabel id="surfaces-heading" className="px-1">
          Coming online
        </SurfaceLabel>
        <SurfaceTiles intakeComplete={intakeComplete} />
      </section>
    </div>
  );
}

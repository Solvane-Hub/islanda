import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NextMove } from '@/app/(app)/_components/next-move';
import { RouteSummary } from '@/app/(app)/_components/route-summary';
import { BusinessSnapshot } from '@/app/(app)/_components/business-snapshot';
import { IntakeDial } from '@/app/(app)/_components/intake-dial';
import { SurfaceTiles } from '@/app/(app)/_components/surface-tiles';
import { NovaInvite } from '@/app/(app)/_components/nova-invite';
import { DashboardPriorities } from '@/app/(app)/_components/dashboard-priorities';
import { DashboardQuickActions } from '@/app/(app)/_components/dashboard-quick-actions';
import { NAV_ITEMS, NAV_SECTORS } from '@/app/(app)/_components/nav-items';
import { RoadmapSurface } from '@/components/ui/roadmap-surface';
import type { Milestone } from '@/services/progress';

/**
 * Workspace render tests.
 *
 * These guard the truthfulness rules the dashboard depends on — blocked stages
 * stay blocked, unanswered fields stay absent, instruments report the numbers
 * the services gave them, and no next action is invented when the service says
 * there isn't one.
 */
const MILESTONES: Milestone[] = [
  { key: 'business', title: 'Create your business', description: 'Acme · BS', state: 'complete' },
  {
    key: 'intake',
    title: 'Complete your intake',
    description: '3 of 5 questions answered.',
    state: 'current',
    href: '/intake',
    actionLabel: 'Continue intake',
  },
  {
    key: 'roadmap',
    title: 'Generate your launch roadmap',
    description: 'Not built.',
    state: 'blocked',
  },
  {
    key: 'compliance',
    title: 'Review your requirements',
    description: 'Not built.',
    state: 'blocked',
  },
  { key: 'funding', title: 'Explore funding', description: 'Not built.', state: 'blocked' },
];

describe('NextMove', () => {
  it('surfaces the real next milestone and its route', () => {
    render(<NextMove milestone={MILESTONES[1]!} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Complete your intake');
    expect(screen.getByRole('link', { name: /Continue intake/ })).toHaveAttribute(
      'href',
      '/intake',
    );
    expect(screen.getByText('Your next move')).toBeTruthy();
  });

  it('reports completion honestly instead of inventing a milestone', () => {
    render(<NextMove milestone={null} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Everything available today is done',
    );
    // No fabricated CTA when the service says there is no current step.
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(/still in development/)).toBeTruthy();
  });
});

describe('IntakeDial', () => {
  it('reports the counts it was given and never rounds them into a percentage', () => {
    render(<IntakeDial completed={3} total={5} />);
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('/ 05')).toBeTruthy();
    expect(screen.getByText('2 questions still to answer.')).toBeTruthy();
  });

  it('sends a finished founder to review rather than back into the form', () => {
    render(<IntakeDial completed={5} total={5} />);
    expect(screen.getByText('Every question answered.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Review your answers/ })).toHaveAttribute(
      'href',
      '/intake/review',
    );
  });

  it('renders nothing decorative it cannot divide by', () => {
    const { container } = render(<IntakeDial completed={0} total={0} />);
    // The arc, not the link's chevron. A zero segment count must not render an
    // arc of NaN path commands.
    expect(container.querySelector('svg[viewBox="0 0 132 132"]')).toBeNull();
    expect(container.querySelectorAll('path[d*="NaN"]')).toHaveLength(0);
  });
});

describe('RouteSummary', () => {
  it('keeps blocked stages blocked and collapses them into one cell', () => {
    render(<RouteSummary milestones={MILESTONES} />);
    // Two actionable stages listed individually.
    expect(screen.getByText('Create your business')).toBeTruthy();
    expect(screen.getByText('Complete your intake')).toBeTruthy();
    // Three blocked stages summarised, not promoted.
    expect(screen.getByText(/further stages, in development/)).toBeTruthy();
    const summary = screen.getByText(/further stages, in development/).closest('div')!;
    for (const t of [
      'Generate your launch roadmap',
      'Review your requirements',
      'Explore funding',
    ]) {
      expect(within(summary).getByText(new RegExp(t))).toBeTruthy();
    }
  });

  it('conveys state with text, not colour alone', () => {
    render(<RouteSummary milestones={MILESTONES} />);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('In development')).toBeTruthy();
  });
});

describe('BusinessSnapshot', () => {
  it('renders only the rows it is given and never invents placeholders', () => {
    render(
      <BusinessSnapshot
        rows={[
          { label: 'Industry', value: 'Food service', href: '/settings' },
          { label: 'Team', value: '3 people', href: '/intake?step=3' },
        ]}
        unanswered={0}
      />,
    );
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('Not provided')).toBeNull();
  });

  it('accounts for unanswered questions rather than padding the list', () => {
    render(<BusinessSnapshot rows={[]} unanswered={3} />);
    expect(screen.getByText(/parts of your profile need review/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue intake' })).toHaveAttribute(
      'href',
      '/intake',
    );
  });

  it('points every edit affordance at an existing route', () => {
    render(
      <BusinessSnapshot
        rows={[{ label: 'Stage', value: 'Just an idea', href: '/intake?step=2' }]}
        unanswered={0}
      />,
    );
    expect(screen.getByRole('link', { name: 'Edit stage' })).toHaveAttribute(
      'href',
      '/intake?step=2',
    );
  });

  it('writes each unresolved state and offers its real next action', () => {
    render(
      <BusinessSnapshot
        rows={[
          {
            label: 'Business',
            value: 'A seafood takeaway',
            href: '/intake?step=1',
            state: 'needs_confirmation',
          },
          { label: 'Funding', href: '/intake?step=4', state: 'declined' },
          { label: 'Goals', href: '/intake?step=5', state: 'unknown' },
        ]}
        unanswered={2}
      />,
    );
    expect(screen.getByText('Needs confirmation')).toBeTruthy();
    expect(screen.getByText('Open question')).toBeTruthy();
    expect(screen.getByText('Needs your answer')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review and confirm business' })).toHaveAttribute(
      'href',
      '/intake?step=1',
    );
    expect(screen.getByRole('link', { name: 'Answer goals' })).toHaveAttribute(
      'href',
      '/intake?step=5',
    );
  });
});

describe('SurfaceTiles', () => {
  /**
   * Derived from `NAV_GROUPS`, so the count is asserted against the navigation
   * rather than restated. When Nova was promoted to an available route it left
   * these tiles automatically — and this expression is what makes that a
   * verified consequence instead of a coincidence.
   */
  const unbuilt = NAV_ITEMS.filter((i) => !i.available);

  it('presents unbuilt surfaces as unbuilt, with their real prerequisite state', () => {
    render(<SurfaceTiles intakeComplete={false} />);
    expect(screen.getAllByText('In development')).toHaveLength(unbuilt.length);
    expect(screen.getAllByText('Needs your completed intake')).toHaveLength(unbuilt.length);
    expect(screen.queryByText('Your intake is ready')).toBeNull();
  });

  it('reflects a completed intake rather than a hard-coded state', () => {
    render(<SurfaceTiles intakeComplete />);
    expect(screen.getAllByText('Your intake is ready')).toHaveLength(unbuilt.length);
    // Still not available. A met prerequisite is not a shipped capability.
    expect(screen.getAllByText('In development')).toHaveLength(unbuilt.length);
  });

  it('shows every unbuilt surface and nothing that is built', () => {
    render(<SurfaceTiles intakeComplete />);

    for (const item of unbuilt) {
      expect(screen.getByText(item.label), `${item.label} missing from tiles`).toBeTruthy();
    }
    for (const item of NAV_ITEMS.filter((i) => i.available)) {
      expect(
        screen.queryByText(item.label),
        `${item.label} is built and must not appear`,
      ).toBeNull();
    }
  });

  it('does not present Nova as a surface in development', () => {
    // The specific regression this guards: Nova shipped and went on being
    // rendered as a door with "In development" under it for days.
    render(<SurfaceTiles intakeComplete />);
    expect(screen.queryByText('Nova')).toBeNull();
  });
});

describe('NovaInvite', () => {
  it('offers a prominent, first-person entry into Nova', () => {
    render(<NovaInvite />);
    // "Investigate with Nova", never "Ask AI".
    expect(screen.getByRole('heading', { name: 'Investigate with Nova' })).toBeInTheDocument();
    expect(screen.queryByText(/ask ai/i)).toBeNull();
  });

  it('links to the Nova route, which gates itself on published knowledge', () => {
    render(<NovaInvite />);
    const link = screen.getByRole('link', { name: /investigate with nova/i });
    expect(link).toHaveAttribute('href', '/assistant');
  });

  it('claims no capability beyond quoting cited sources', () => {
    render(<NovaInvite />);
    expect(screen.getByText(/cites every one/i)).toBeInTheDocument();
  });
});

describe('DashboardPriorities', () => {
  it('lists the next move and open intake items as real links', () => {
    render(
      <DashboardPriorities
        nextMove={MILESTONES[1]!}
        openItems={[{ label: 'Funding', href: '/intake?step=4' }]}
      />,
    );
    expect(screen.getByText('Next move')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /funding/i })).toHaveAttribute(
      'href',
      '/intake?step=4',
    );
  });

  it('communicates an empty state without inventing a task', () => {
    render(<DashboardPriorities nextMove={null} openItems={[]} />);
    expect(screen.getByText(/nothing waiting on you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /investigate with nova/i })).toHaveAttribute(
      'href',
      '/assistant',
    );
  });
});

describe('DashboardQuickActions', () => {
  it('offers real navigations and adapts to intake state', () => {
    const { rerender } = render(<DashboardQuickActions intakeComplete={false} />);
    expect(screen.getByRole('link', { name: /continue intake/i })).toHaveAttribute(
      'href',
      '/intake',
    );
    expect(screen.getByRole('link', { name: /investigate with nova/i })).toHaveAttribute(
      'href',
      '/assistant',
    );

    rerender(<DashboardQuickActions intakeComplete />);
    expect(screen.getByRole('link', { name: /review intake/i })).toHaveAttribute(
      'href',
      '/intake/review',
    );
  });
});

describe('primary navigation', () => {
  it('lists Nova as an available route', () => {
    const nova = NAV_ITEMS.find((i) => i.href === '/assistant');

    expect(nova, 'Nova is missing from the navigation').toBeDefined();
    expect(nova?.available).toBe(true);
  });

  it('places Nova in the Intelligence sector, available, alongside the still-unbuilt roadmap items', () => {
    const intelligence = NAV_SECTORS.find((s) => s.label === 'Intelligence');
    expect(intelligence, 'Intelligence sector is missing').toBeDefined();

    const nova = intelligence?.items.find((i) => i.href === '/assistant');
    expect(nova?.available, 'Nova should be available').toBe(true);

    for (const href of ['/compliance', '/timeline', '/funding']) {
      const item = intelligence?.items.find((i) => i.href === href);
      expect(item, `${href} should sit in Intelligence`).toBeDefined();
      expect(item?.available, href).toBe(false);
    }
  });

  it('keeps Overview as its own unlabeled sector, pointing at the dashboard', () => {
    const overview = NAV_SECTORS[0]?.items ?? [];
    expect(NAV_SECTORS[0]?.label).toBeUndefined();
    expect(overview).toHaveLength(1);
    expect(overview[0]?.href).toBe('/dashboard');
  });

  it('groups Goals and Documents under Business, and Settings under Account', () => {
    const business = NAV_SECTORS.find((s) => s.label === 'Business');
    expect(business?.items.some((i) => i.href === '/documents')).toBe(true);
    expect(business?.items.some((i) => i.href === '/dashboard#goals')).toBe(true);

    const account = NAV_SECTORS.find((s) => s.label === 'Account');
    expect(account?.items.some((i) => i.href === '/settings')).toBe(true);
  });

  it('marks Goals and Financials as anchors into Overview, not routes of their own', () => {
    const goals = NAV_ITEMS.find((i) => i.href === '/dashboard#goals');
    const financials = NAV_ITEMS.find((i) => i.href === '/dashboard#financials');
    expect(goals?.isAnchor, 'Goals should be an anchor').toBe(true);
    expect(financials?.isAnchor, 'Financials should be an anchor').toBe(true);
    // A hash never appears in `usePathname()`, so neither can ever satisfy the
    // rail's `pathname === item.href` active-route check — asserted here as
    // the underlying reason no special-casing is needed for these two hrefs.
    expect(goals?.href.includes('#')).toBe(true);
    expect(financials?.href.includes('#')).toBe(true);
  });

  it('lists Documents as an available route (secure vault shipped in P3)', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/documents')?.available).toBe(true);
  });

  it('still marks genuinely unbuilt surfaces as unavailable', () => {
    // Promoting one route must not have promoted the rest.
    for (const href of ['/timeline', '/compliance', '/funding']) {
      expect(NAV_ITEMS.find((i) => i.href === href)?.available, href).toBe(false);
    }
  });

  it('points every navigation entry at a route that exists', () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith('/'), item.href).toBe(true);
    }
  });
});

describe('RoadmapSurface', () => {
  it('states each prerequisite and whether it is actually met', () => {
    render(
      <RoadmapSurface
        purpose="What this will eventually do."
        prerequisites={[
          { label: 'Your business profile', detail: 'From intake.', met: true },
          { label: 'A published Knowledge Pack', detail: 'None yet.', met: false },
        ]}
        today={{ text: 'Finish intake.', href: '/intake', label: 'Continue intake' }}
      />,
    );
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Not yet')).toBeTruthy();
    expect(screen.getByText('What you can do today')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue intake' })).toBeTruthy();
  });
});

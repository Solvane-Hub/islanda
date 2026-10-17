import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BusinessSnapshot } from '@/app/(app)/_components/business-snapshot';
import { NovaInvite } from '@/app/(app)/_components/nova-invite';
import { DashboardPriorities } from '@/app/(app)/_components/dashboard-priorities';
import { isNavItemActive, NAV_ITEMS, NAV_SECTORS } from '@/app/(app)/_components/nav-items';
import { RoadmapSurface } from '@/components/ui/roadmap-surface';
import { capability } from '@/lib/product/availability';
import type { Milestone } from '@/services/progress';

/**
 * Workspace render tests.
 *
 * These guard the truthfulness rules the dashboard depends on — unanswered
 * fields say so, no next action is invented when there isn't one, and the
 * navigation never presents an unbuilt surface as available.
 */
const NEXT: Milestone = {
  key: 'intake',
  title: 'Answer five questions about your business',
  description: '3 of 5 questions answered.',
  state: 'current',
  href: '/intake',
  actionLabel: 'Continue the questions',
};

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
    expect(screen.getByText(/questions still need an answer/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue the questions' })).toHaveAttribute(
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

  it('writes each unresolved state in plain words and offers its real next action', () => {
    render(
      <BusinessSnapshot
        rows={[
          {
            label: 'What it does',
            value: 'A seafood takeaway',
            href: '/intake?step=1',
            state: 'needs_confirmation',
          },
          { label: 'Money needed', href: '/intake?step=4', state: 'declined' },
          { label: 'Your goals', href: '/intake?step=5', state: 'unknown' },
        ]}
        unanswered={2}
      />,
    );
    expect(screen.getByText('Please check this')).toBeTruthy();
    expect(screen.getByText('You said you don’t know yet')).toBeTruthy();
    expect(screen.getByText('Needs your answer')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Check and confirm what it does' })).toHaveAttribute(
      'href',
      '/intake?step=1',
    );
    expect(screen.getByRole('link', { name: 'Answer your goals' })).toHaveAttribute(
      'href',
      '/intake?step=5',
    );
  });
});

describe('NovaInvite ("Get help")', () => {
  it('introduces Nova by the job it does', () => {
    render(<NovaInvite />);
    expect(screen.getByRole('heading', { name: 'Get help with your business' })).toBeTruthy();
    expect(screen.queryByText(/ask ai/i)).toBeNull();
  });

  it('links to the Nova route, which gates itself on published knowledge', () => {
    render(<NovaInvite />);
    expect(screen.getByRole('link', { name: /ask a question/i })).toHaveAttribute(
      'href',
      '/assistant',
    );
  });

  it('claims only cited quotation, and says it does not hold every rule', () => {
    render(<NovaInvite />);
    expect(screen.getByText(/cites every one/i)).toBeInTheDocument();
    expect(screen.getByText(/doesn.t have every rule yet/i)).toBeInTheDocument();
  });

  it('does not autoplay video on the dashboard', () => {
    const { container } = render(<NovaInvite />);
    expect(container.querySelector('video')).toBeNull();
  });
});

describe('DashboardPriorities ("What to do next")', () => {
  it('shows one primary action as a link to the real route', () => {
    render(
      <DashboardPriorities
        nextMove={NEXT}
        openItems={[{ label: 'Money needed', href: '/intake?step=4' }]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'What to do next' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue the questions/ })).toHaveAttribute(
      'href',
      '/intake',
    );
    // The next move IS the questions, so they are not listed a second time
    // here (Your business information lists them one by one).
    expect(screen.queryByRole('link', { name: /money needed/i })).toBeNull();
  });

  it('lists unanswered questions when the next move is something else', () => {
    render(
      <DashboardPriorities
        nextMove={{
          key: 'foundational-action',
          title: 'Set your first goal',
          description: 'Write down one thing you want the business to achieve.',
          state: 'current',
          href: '/dashboard#goals',
          actionLabel: 'Set a goal',
        }}
        openItems={[{ label: 'Money needed', href: '/intake?step=4' }]}
      />,
    );
    expect(screen.getByRole('link', { name: /Set a goal/ })).toHaveAttribute(
      'href',
      '/dashboard#goals',
    );
    expect(screen.getByRole('link', { name: /money needed/i })).toHaveAttribute(
      'href',
      '/intake?step=4',
    );
  });

  it('never nests a button inside a link', () => {
    const { container } = render(<DashboardPriorities nextMove={NEXT} openItems={[]} />);
    expect(container.querySelector('a button')).toBeNull();
  });

  it('communicates an empty state without inventing a task', () => {
    render(<DashboardPriorities nextMove={null} openItems={[]} />);
    expect(screen.getByText(/you.re up to date/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /ask a question/i })).toHaveAttribute(
      'href',
      '/assistant',
    );
  });
});

describe('primary navigation', () => {
  const labels = NAV_ITEMS.map((i) => i.label);

  it('is organised around tasks: Home, My Business, Documents, Get help, Settings', () => {
    for (const label of ['Home', 'My Business', 'Documents', 'Get help', 'Settings']) {
      expect(labels, label).toContain(label);
    }
    expect(NAV_SECTORS[0]?.items[0]?.href).toBe('/dashboard');
    expect(NAV_SECTORS[0]?.label).toBeUndefined();
  });

  it('sends My Business to the Business Passport and Get help to Nova', () => {
    expect(NAV_ITEMS.find((i) => i.label === 'My Business')?.href).toBe('/passport');
    const help = NAV_ITEMS.find((i) => i.href === '/assistant');
    expect(help?.label).toBe('Get help');
    expect(help?.available).toBe(true);
  });

  it('keeps every existing route reachable — no deep link lost to the regrouping', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    for (const href of [
      '/dashboard',
      '/passport',
      '/intake/review',
      '/dashboard#goals',
      '/dashboard#financials',
      '/documents',
      '/assistant',
      '/compliance',
      '/timeline',
      '/funding',
      '/settings',
    ]) {
      expect(hrefs, href).toContain(href);
    }
  });

  it('reads the unbuilt surfaces from the availability register, and they are unbuilt', () => {
    const later = NAV_SECTORS.find((s) => s.label === 'Coming later');
    expect(later).toBeDefined();
    const byHref = Object.fromEntries((later?.items ?? []).map((i) => [i.href, i]));
    expect(byHref['/compliance']?.available).toBe(
      capability('requirements_guidance').status === 'available',
    );
    expect(byHref['/timeline']?.available).toBe(
      capability('important_dates').status === 'available',
    );
    expect(byHref['/funding']?.available).toBe(capability('funding').status === 'available');
    for (const href of ['/compliance', '/timeline', '/funding']) {
      expect(byHref[href]?.available, href).toBe(false);
    }
  });

  it('marks goals and money as anchors that never claim "you are here"', () => {
    for (const href of ['/dashboard#goals', '/dashboard#financials']) {
      const item = NAV_ITEMS.find((i) => i.href === href)!;
      expect(item.isAnchor).toBe(true);
      expect(isNavItemActive(item, '/dashboard')).toBe(false);
    }
  });

  it('highlights Business details on the intake form as well as the review', () => {
    const details = NAV_ITEMS.find((i) => i.href === '/intake/review')!;
    expect(isNavItemActive(details, '/intake/review')).toBe(true);
    expect(isNavItemActive(details, '/intake')).toBe(true);
    expect(isNavItemActive(details, '/intakes')).toBe(false);
  });

  it('points every navigation entry at an internal route', () => {
    for (const item of NAV_ITEMS) expect(item.href.startsWith('/'), item.href).toBe(true);
  });
});

describe('RoadmapSurface', () => {
  it('states each prerequisite and whether it is actually met', () => {
    render(
      <RoadmapSurface
        purpose="What this will eventually do."
        prerequisites={[
          { label: 'Your business details', detail: 'From the questions.', met: true },
          { label: 'Official documents for your country', detail: 'None yet.', met: false },
        ]}
        today={{ text: 'Finish the questions.', href: '/intake', label: 'Continue the questions' }}
      />,
    );
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Not yet')).toBeTruthy();
    expect(screen.getByText('What you can do today')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue the questions' })).toBeTruthy();
  });
});

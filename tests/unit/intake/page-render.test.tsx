import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessProfile } from '@/types/business';
import type * as IntakeService from '@/services/intake';

/**
 * The intake route actually renders.
 *
 * This exists because the redesign shipped a page that threw at render time
 * and was caught by the segment's error boundary — every gate passed, because
 * no gate rendered the page. `tsc` checks types, `eslint` checks patterns and
 * the component tests exercise the pieces in isolation; nothing composed them.
 *
 * The Server Component is invoked directly and its returned tree is rendered,
 * so an import that does not resolve, a component that is undefined, or a
 * crash inside any step fails here rather than in the browser.
 *
 * Services are mocked at the module boundary — the point is the composition,
 * not Supabase. Nothing about the service contracts changes.
 */
const business = {
  id: 'b1',
  name: 'Solvane Hub',
  country_code: 'BS',
  industry: 'Food service',
  status: 'intake_started',
};

let profile: BusinessProfile;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'b1' }) }),
}));
// jsdom has no app-router context; `redirect` keeps throwing so a redirecting
// branch cannot silently pass as a successful render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/services/auth', () => ({ getCurrentUser: async () => ({ id: 'u1' }) }));
vi.mock('@/services/business', () => ({
  listBusinesses: async () => [business],
  resolveCurrentBusiness: () => business,
  getActiveCountries: async () => [{ code: 'BS', name: 'The Bahamas', currency_code: 'BSD' }],
}));
vi.mock('@/services/intake', async (importOriginal) => {
  const actual = await importOriginal<typeof IntakeService>();
  return {
    ...actual,
    startOrResumeIntake: async () => profile,
    getIntakeProfile: async () => profile,
  };
});

const { default: IntakePage } = await import('@/app/(app)/intake/page');
const { default: ReviewPage } = await import('@/app/(app)/intake/review/page');

beforeEach(() => {
  profile = {
    business_id: 'b1',
    description: 'A seafood restaurant in Nassau serving locally caught fish.',
    business_stage: 'idea',
    location: 'Nassau, New Providence',
    employee_count: 3,
    funding_requirement_amount: 150000,
    funding_requirement_currency: 'BSD',
    founder_goals: 'Open a second location within a year.',
    last_completed_step: 5,
    completed_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  } as unknown as BusinessProfile;
});

describe('/intake renders every step', () => {
  const QUESTIONS: Record<number, RegExp> = {
    1: /What does the business do\?/,
    2: /Where are you today\?/,
    3: /How many people/,
    4: /How much money/,
    5: /What do you want to achieve\?/,
  };

  for (const step of [1, 2, 3, 4, 5]) {
    it(`step ${step} mounts and asks its question`, async () => {
      const ui = await IntakePage({ searchParams: Promise.resolve({ step: String(step) }) });
      render(ui);
      expect(screen.getByLabelText(QUESTIONS[step]!)).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Intake progress' })).toBeTruthy();
    });
  }

  it('honours a direct link to a requested knowledge slot', async () => {
    profile = { ...profile, last_completed_step: 1 };
    const ui = await IntakePage({ searchParams: Promise.resolve({ step: '5' }) });
    render(ui);
    expect(screen.getByLabelText(/What do you want to achieve\?/)).toBeTruthy();
  });

  it('shows the currency the service will store, not a typed-in one', async () => {
    const ui = await IntakePage({ searchParams: Promise.resolve({ step: '4' }) });
    render(ui);
    expect(screen.getByText('BSD')).toBeTruthy();
  });

  it('offers "I don\u2019t know yet" as a real answer on the funding step', async () => {
    const ui = await IntakePage({ searchParams: Promise.resolve({ step: '4' }) });
    render(ui);
    const box = screen.getByRole('checkbox', { name: /I don.t know yet/ });
    expect(box).toHaveAttribute('name', 'fundingUnknown');
    expect(box).not.toBeChecked();
  });

  it('reflects a recorded decline back to the founder', async () => {
    profile = {
      ...profile,
      funding_requirement_amount: null,
      funding_requirement_currency: null,
      responses: { knowledge: { funding: { declined: true } } },
    };
    const ui = await IntakePage({ searchParams: Promise.resolve({ step: '4' }) });
    render(ui);
    expect(screen.getByRole('checkbox', { name: /I don.t know yet/ })).toBeChecked();
  });

  it('names the five slots and links only what is already established', async () => {
    profile = { ...profile, employee_count: null, founder_goals: null };
    const ui = await IntakePage({ searchParams: Promise.resolve({ step: '3' }) });
    render(ui);
    const rail = screen.getByRole('navigation', { name: 'Intake sections' });
    for (const label of ['About', 'Stage', 'Team', 'Money', 'Goals']) {
      expect(within(rail).getByText(label)).toBeTruthy();
    }
    // Established slots are reachable; unknown ones are not offered as links.
    expect(within(rail).getByRole('link', { name: /About/ })).toHaveAttribute(
      'href',
      '/intake?step=1',
    );
    expect(within(rail).queryByRole('link', { name: /Goals/ })).toBeNull();
  });
});

describe('/intake/review renders', () => {
  it('leads with the business, then plays back the founder’s own answers', async () => {
    const ui = await ReviewPage();
    render(ui);
    // The profile is headed by the business itself, not by "your answers".
    expect(screen.getByRole('heading', { level: 1, name: 'Solvane Hub' })).toBeTruthy();
    expect(screen.getByText('The Bahamas')).toBeTruthy();
    expect(screen.getByText(/seafood restaurant/)).toBeTruthy();
    expect(screen.getByText('Nassau, New Providence')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finish and go to Home/ })).toBeTruthy();
  });

  it('records a decline as an answer rather than an empty field', async () => {
    profile = {
      ...profile,
      funding_requirement_amount: null,
      funding_requirement_currency: null,
      responses: { knowledge: { funding: { declined: true } } },
    } as unknown as BusinessProfile;
    const ui = await ReviewPage();
    render(ui);
    expect(screen.getByText(/don.t know a figure yet/)).toBeTruthy();
    expect(screen.queryByText('Not answered yet')).toBeNull();
  });

  it('marks an unestablished slot and offers a way to answer it', async () => {
    profile = { ...profile, founder_goals: null } as unknown as BusinessProfile;
    const ui = await ReviewPage();
    render(ui);
    expect(screen.getByText('Not answered yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Answer goals' })).toHaveAttribute(
      'href',
      '/intake?step=5',
    );
  });

  it('keeps an unfinished intake unfinished', async () => {
    profile = { ...profile, last_completed_step: 2, founder_goals: null };
    const ui = await ReviewPage();
    render(ui);
    expect(screen.getByText(/still need an answer/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Finish and go to Home/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Continue the questions' })).toBeTruthy();
  });
});

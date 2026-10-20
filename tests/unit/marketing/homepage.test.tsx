import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The homepage, composed — rendered as the Server Component it is, in both
 * access modes.
 *
 * The component tests check each section; this checks the page a visitor gets:
 * five sections in order, one primary action, no door that the waitlist gate
 * would slam, and nothing that is not released. The waitlist action is mocked at the module boundary (the
 * form's submission is covered by tests/unit/marketing/waitlist-form.test.tsx).
 */
const env = vi.hoisted(() => ({ WAITLIST_ONLY_MODE: true }));
vi.mock('@/lib/env', () => ({ serverEnv: env }));
vi.mock('@/app/waitlist-actions', () => ({ joinWaitlistAction: vi.fn() }));

const { default: HomePage } = await import('@/app/page');
const { CAPABILITIES, isReleased } = await import('@/lib/product/availability');

/**
 * Unfinished-feature messaging. The public site describes only what works;
 * it never announces what does not (build privately, release deliberately).
 */
const COMING_SOON =
  /coming soon|coming later|not ready yet|not available yet|under development|in development|still being built|working on (it|this)|we.re building|building next|available soon|launching soon|stay tuned|under construction|placeholder|demo only|\bsoon\b/i;

async function renderHome(access?: string) {
  const ui = await HomePage({ searchParams: Promise.resolve(access ? { access } : {}) });
  return render(ui);
}

describe('homepage', () => {
  beforeEach(() => {
    env.WAITLIST_ONLY_MODE = true;
  });

  it('presents five sections after the hero, in order', async () => {
    await renderHome();
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([
      "Starting a business shouldn't feel like guesswork.",
      'What you can do in Islanda today',
      'A small food business, start to first step',
      'Common questions',
      'Join the early-access waitlist',
    ]);
  });

  it.each([true, false])(
    'never announces unfinished features (waitlist mode: %s)',
    async (waitlistOnly) => {
      env.WAITLIST_ONLY_MODE = waitlistOnly;
      const { container } = await renderHome();
      // <details> answers are in the DOM even when collapsed, so this covers the FAQ too.
      const text = container.textContent ?? '';
      expect(text).not.toMatch(COMING_SOON);
      for (const c of CAPABILITIES.filter((c) => !isReleased(c.id))) {
        expect(text, c.id).not.toContain(c.name);
      }
    },
  );

  it.each([true, false])(
    'links only to the page itself or to routes that exist publicly (waitlist mode: %s)',
    async (waitlistOnly) => {
      env.WAITLIST_ONLY_MODE = waitlistOnly;
      const { container } = await renderHome();
      const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      const UNRELEASED_ROUTES = ['/assistant', '/compliance', '/timeline', '/funding'];
      for (const href of hrefs) {
        expect(href, 'every link has a destination').toBeTruthy();
        expect(
          UNRELEASED_ROUTES.some((r) => href!.startsWith(r)),
          href!,
        ).toBe(false);
      }
    },
  );

  it('has one h1, and the waitlist form is real', async () => {
    await renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Join the waitlist/i })).toBeTruthy();
  });

  it('waitlist mode: no link anywhere leads to sign-in or sign-up', async () => {
    const { container } = await renderHome();
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/login');
    expect(hrefs).not.toContain('/signup');
  });

  it('waitlist mode: a visitor bounced from sign-in is told why, and where to go', async () => {
    await renderHome('waitlist');
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/Sign-in isn.t open yet/);
    expect(status.querySelector('a')?.getAttribute('href')).toBe('#waitlist');
  });

  it('open mode: offers sign-in and sign-up, and shows no gate notice', async () => {
    env.WAITLIST_ONLY_MODE = false;
    const { container } = await renderHome('waitlist');
    expect(screen.queryByRole('status')).toBeNull();
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/login');
    expect(hrefs).toContain('/signup');
  });

  it('never presents itself as a government service or claims completeness', async () => {
    const { container } = await renderHome();
    const text = container.textContent ?? '';
    expect(text).toMatch(/not a government service/);
    expect(text).not.toMatch(/everything you need|your complete requirements/i);
    expect(text).not.toMatch(/FoundryAI/);
  });
});

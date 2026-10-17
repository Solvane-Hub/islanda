import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The homepage, composed — rendered as the Server Component it is, in both
 * access modes.
 *
 * The component tests check each section; this checks the page a visitor gets:
 * six sections in order, one primary action, and no door that the waitlist
 * gate would slam. The waitlist action is mocked at the module boundary (the
 * form's submission is covered by tests/unit/marketing/waitlist-form.test.tsx).
 */
const env = vi.hoisted(() => ({ WAITLIST_ONLY_MODE: true }));
vi.mock('@/lib/env', () => ({ serverEnv: env }));
vi.mock('@/app/waitlist-actions', () => ({ joinWaitlistAction: vi.fn() }));

const { default: HomePage } = await import('@/app/page');

async function renderHome(access?: string) {
  const ui = await HomePage({ searchParams: Promise.resolve(access ? { access } : {}) });
  return render(ui);
}

describe('homepage', () => {
  beforeEach(() => {
    env.WAITLIST_ONLY_MODE = true;
  });

  it('presents six sections after the hero, in order', async () => {
    await renderHome();
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([
      "Starting a business shouldn't feel like guesswork.",
      'What you can do in Islanda today',
      'A small food business, start to first step',
      "What we're building next",
      'Common questions',
      'Join the early-access waitlist',
    ]);
  });

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

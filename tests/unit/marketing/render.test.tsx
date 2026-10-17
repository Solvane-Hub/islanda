import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from '@/components/marketing/hero';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { SectionHeading } from '@/components/marketing/section';
import { Problem } from '@/components/marketing/problem';
import { AvailableToday } from '@/components/marketing/available-today';
import { ExampleBusiness } from '@/components/marketing/example-business';
import { ComingNext } from '@/components/marketing/coming-next';
import { Faq } from '@/components/marketing/faq';
import { WaitlistCta } from '@/components/marketing/waitlist-cta';
import { availableToday, comingNext } from '@/lib/product/availability';

/**
 * Render tests for the public homepage.
 *
 * They assert the two things the page is accountable for: it describes only
 * what the availability register says works, and every door it offers matches
 * the access mode — no "Sign in" or "Create an account" while the waitlist gate
 * would bounce the visitor straight back. Structure and accessibility, not
 * appearance.
 */

describe('access mode — the page never offers a door that does not open', () => {
  it('waitlist mode: header points at the waitlist, not at a sign-in that redirects away', () => {
    render(<SiteHeader mode="waitlist" />);
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute(
      'href',
      '#waitlist',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('open mode: header offers sign-in', () => {
    render(<SiteHeader mode="open" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('waitlist mode: the hero has one action and says access is closed', () => {
    render(<Hero mode="waitlist" />);
    expect(screen.getByRole('link', { name: /Join the early-access waitlist/ })).toHaveAttribute(
      'href',
      '#waitlist',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByText(/not open to the public yet/)).toBeTruthy();
  });

  it('open mode: the hero adds sign-in for people who already have access', () => {
    render(<Hero mode="open" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/in early access/)).toBeTruthy();
  });

  it('waitlist mode: the footer and waitlist section offer no account links', () => {
    render(
      <>
        <WaitlistCta mode="waitlist" />
        <SiteFooter mode="waitlist" />
      </>,
    );
    expect(screen.queryByRole('link', { name: /Create an account/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('open mode: the footer and waitlist section name the real sign-up route', () => {
    render(
      <>
        <WaitlistCta mode="open" />
        <SiteFooter mode="open" />
      </>,
    );
    for (const link of screen.getAllByRole('link', { name: /Create an account/ })) {
      expect(link).toHaveAttribute('href', '/signup');
    }
  });

  it('the FAQ answer to "Can I use it today?" follows the access mode', () => {
    const { unmount } = render(<Faq mode="waitlist" />);
    expect(screen.getByText(/Not yet\. Islanda is in early access/)).toBeTruthy();
    unmount();
    render(<Faq mode="open" />);
    expect(screen.getByText(/Yes\. During early access you can create an account/)).toBeTruthy();
  });
});

describe('the hero', () => {
  it('renders one h1 that says who it is for, and both art-directed images', () => {
    const { container } = render(<Hero mode="waitlist" />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]!.textContent).toBe('Starting a business in The Bahamas? Start here.');
    expect(screen.getByText('The Bahamas business pilot')).toBeTruthy();

    const imgs = Array.from(container.querySelectorAll('img'));
    const backgroundFrames = imgs.filter((img) => (img.getAttribute('src') ?? '').includes('hero'));
    expect(backgroundFrames.length).toBeGreaterThanOrEqual(2);
    for (const img of backgroundFrames) {
      expect(img.getAttribute('alt')!.length).toBeGreaterThan(30);
    }
    expect(screen.getByRole('img', { name: 'Islanda' })).toBeTruthy();
  });

  it('nests no button inside a link', () => {
    const { container } = render(<Hero mode="open" />);
    expect(container.querySelector('a button')).toBeNull();
  });
});

describe('what works today, and what does not yet', () => {
  it('lists exactly the capabilities the register marks available and public', () => {
    render(<AvailableToday />);
    const items = availableToday();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(screen.getByRole('heading', { level: 3, name: item.name })).toBeTruthy();
      expect(item.status).toBe('available');
    }
  });

  it('states plainly that Islanda files nothing and does not yet say what applies', () => {
    render(<AvailableToday />);
    expect(screen.getByText(/does not register your business/)).toBeTruthy();
  });

  it('puts every capability not public today in one "coming next" list, none marked available', () => {
    render(<ComingNext />);
    const items = comingNext();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(items.length);
    for (const li of listItems) {
      expect(within(li).queryByText(/^Available/)).toBeNull();
    }
    expect(screen.getAllByText("We're working on this").length).toBeGreaterThan(0);
  });

  it('never lists the same capability as both available and coming next', () => {
    const today = new Set(availableToday().map((c) => c.id));
    for (const c of comingNext()) expect(today.has(c.id)).toBe(false);
  });

  it('names the guidance people most want as not ready', () => {
    const names = comingNext().map((c) => c.id);
    expect(names).toContain('requirements_guidance');
    expect(names).toContain('cited_answers');
  });
});

describe('the example', () => {
  it('is labelled as made up, on the card and in its caption', () => {
    render(<ExampleBusiness />);
    expect(screen.getByText('Made-up example')).toBeTruthy();
    expect(screen.getByText(/not a real business or customer/)).toBeTruthy();
    expect(screen.getByText(/nothing here\s+is official advice/)).toBeTruthy();
  });

  it('shows the five questions the app actually asks, in order', () => {
    render(<ExampleBusiness />);
    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual([
      'What does the business do?',
      'Where are you today, and where will it operate?',
      'How many people will work in it?',
      'How much money do you think you need?',
      'What do you want to achieve?',
    ]);
  });

  it('says what the example business cannot get yet', () => {
    render(<ExampleBusiness />);
    expect(screen.getByText(/still being built/)).toBeTruthy();
  });
});

describe('the problem section', () => {
  it('asks questions and answers none of them', () => {
    render(<Problem />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    // Every listed line is a question — this section must never state a requirement.
    const lines = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
      .filter((t) => !/Selling|Opening|Turning/.test(t));
    for (const line of lines) expect(line.trim().endsWith('?')).toBe(true);
  });
});

describe('the FAQ', () => {
  it('answers the questions a first-time visitor asks, in native disclosures', () => {
    const { container } = render(<Faq mode="waitlist" />);
    for (const q of [
      'Who is Islanda for?',
      'Can I use it today?',
      'Is access open to everyone?',
      'Does Islanda register my business for me?',
      'Is Islanda a government website?',
      'How does Islanda use my business information?',
      'What happens after I join the waitlist?',
      'Where should I check official requirements?',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: q })).toBeTruthy();
    }
    // Native <details>: operable without client JavaScript.
    expect(container.querySelectorAll('details')).toHaveLength(8);
  });

  it('says Islanda is not a government service and is not legal advice', () => {
    render(<Faq mode="waitlist" />);
    expect(screen.getByText(/It is not a government service/)).toBeTruthy();
    expect(screen.getByText(/Islanda is not legal advice/)).toBeTruthy();
  });
});

describe('page furniture', () => {
  it('SectionHeading renders an h2', () => {
    render(<SectionHeading index="02" eyebrow="The journey" title="One route" />);
    expect(screen.getByRole('heading', { level: 2, name: 'One route' })).toBeTruthy();
  });

  it('SiteFooter mentions Solvane Hub exactly once and says it is not a government service', () => {
    render(<SiteFooter mode="waitlist" />);
    const body = document.body.textContent ?? '';
    expect(body.match(/Solvane Hub/g)).toHaveLength(1);
    expect(screen.getByText(/It is not a government service\./)).toBeTruthy();
  });

  it('SiteHeader carries no logo', () => {
    render(<SiteHeader mode="open" />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('reduced motion collapses transitions rather than removing them', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('transition-duration: 0.01ms !important');
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).not.toMatch(/transition:\s*none/);
    expect(block).not.toMatch(/animation:\s*none/);
  });
});

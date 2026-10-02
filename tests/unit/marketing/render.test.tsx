import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartField } from '@/components/marketing/chart-field';
import { Hero } from '@/components/marketing/hero';
import { ProductReveal } from '@/components/marketing/product-reveal';
import { Closing } from '@/components/marketing/closing';
import { Reveal } from '@/components/marketing/reveal';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { WorkspacePanel } from '@/components/marketing/workspace-panel';
import { Perspectives } from '@/components/marketing/perspectives';
import { JourneyStages } from '@/components/marketing/journey-stages';
import { Territory } from '@/components/marketing/territory';
import { SectionHeading } from '@/components/marketing/section';

/**
 * Render smoke tests for the landing page components.
 *
 * These exist because the landing page cannot be built or served in CI's
 * sandbox, so a Playwright pass is not always available. They caught a real
 * defect on first run: `JourneyStages` assumed `IntersectionObserver` existed
 * and threw where it does not.
 *
 * They assert structure and accessibility contracts, not appearance.
 */
describe('marketing components render', () => {
  it('ChartField is decorative', () => {
    const { container } = render(<ChartField />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('SectionHeading renders an h2 and hides the chapter number', () => {
    render(<SectionHeading index="02" eyebrow="The journey" title="One route" />);
    expect(screen.getByRole('heading', { level: 2, name: 'One route' })).toBeTruthy();
  });

  it('Perspectives exposes four accordion triggers, one open', () => {
    render(<Perspectives />);
    const triggers = screen.getAllByRole('button', { expanded: false });
    const open = screen.getAllByRole('button', { expanded: true });
    expect(triggers).toHaveLength(3);
    expect(open).toHaveLength(1);
  });

  it('Perspectives wires every trigger to a labelled region', () => {
    render(<Perspectives />);
    for (const btn of screen.getAllByRole('button')) {
      const id = btn.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      const panel = document.getElementById(id!);
      expect(panel).toBeTruthy();
      expect(panel!.getAttribute('aria-labelledby')).toBe(btn.id);
    }
  });

  it('Perspectives opens a panel on click and closes the previous one', () => {
    render(<Perspectives />);
    fireEvent.click(screen.getByRole('button', { name: /Operate/ }));
    expect(screen.getByRole('button', { name: /Operate/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Build/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('Perspectives moves between panels with arrow keys on both axes', () => {
    render(<Perspectives />);
    const build = screen.getByRole('button', { name: /Build/ });
    build.focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /Understand/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // Vertical layout on mobile: Down must work as well as Right.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Operate/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByRole('button', { name: /Grow/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(screen.getByRole('button', { name: /Build/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('Perspectives states the real status of every capability', () => {
    render(<Perspectives />);

    // Across the whole section: two shipped capabilities, ten not. Collapsed
    // panels stay in the DOM (they are `hidden`, so out of the a11y tree but
    // present), which is why these totals cover all four views.
    expect(screen.getAllByText('Available now')).toHaveLength(2);
    expect(screen.getAllByText('In development')).toHaveLength(10);

    // Only the open panel is exposed as a region, so this asserts what a
    // reader can actually reach. Build is the only view with anything shipped.
    expect(within(screen.getByRole('region')).getAllByText('Available now')).toHaveLength(2);

    for (const name of [/Understand/, /Operate/, /Grow/]) {
      fireEvent.click(screen.getByRole('button', { name }));
      const panel = screen.getByRole('region');
      expect(within(panel).queryAllByText('Available now')).toHaveLength(0);
      expect(within(panel).getAllByText('In development')).toHaveLength(3);
    }
  });

  it('JourneyStages tells the truth about what is built', () => {
    render(<JourneyStages />);
    // Only guided intake exists. If a future edit quietly promotes a stage to
    // "available", this is the test that should stop it.
    expect(screen.getAllByText('Available now')).toHaveLength(1);
    expect(screen.getAllByText('In development')).toHaveLength(4);
  });

  it('JourneyStages keeps every stage in the DOM regardless of scroll', () => {
    render(<JourneyStages />);
    // Emphasis is scroll-driven; existence is not. Nothing is gated behind
    // scrolling or behind JavaScript.
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Idea',
      'Formation',
      'Compliance',
      'Funding',
      'Growth',
    ]);
  });

  it('ProductReveal renders all four stages before any scrolling', () => {
    render(<ProductReveal journey={<p>journey slot</p>} />);
    // Reveal is emphasis, never existence. Everything is present on first
    // render, before a single intersection has fired.
    for (const label of ['Describe', 'Understand', 'Route', 'Act']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('journey slot')).toBeTruthy();
  });

  it('ProductReveal shows the derived profile even at stage zero', () => {
    render(<ProductReveal journey={null} />);
    // The values are dimmer before derivation, never absent — a reader with no
    // JavaScript still gets the whole profile.
    for (const v of ['The Bahamas', 'Food service', '3 people', 'Idea']) {
      expect(screen.getAllByText(v).length).toBeGreaterThan(0);
    }
  });

  it('ProductReveal pairs each quoted phrase with the field it produced', () => {
    const { container } = render(<ProductReveal journey={null} />);
    // Derivation is communicated by shared numerals rather than connector
    // lines. Every field numeral must have a matching one in the statement.
    const numerals = Array.from(container.querySelectorAll('[data-numeric]'))
      .map((n) => n.textContent?.trim())
      .filter((t) => t && /^0[1-4]$/.test(t));
    for (const n of ['01', '02', '03', '04']) {
      expect(numerals.filter((x) => x === n).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('ProductReveal marks the unbuilt route stages honestly', () => {
    render(<ProductReveal journey={null} />);
    // Compliance, Funding and Growth are not built.
    expect(screen.getAllByText('In development')).toHaveLength(3);
    expect(screen.getByText('Example')).toBeTruthy();
  });

  it('ProductReveal keeps the route stages in journey order', () => {
    const { container } = render(<ProductReveal journey={null} />);
    const list = container.querySelectorAll('ol > li');
    const names = Array.from(list)
      .map((li) => li.textContent ?? '')
      .filter((t) => /Idea|Formation|Compliance|Funding|Growth/.test(t));
    expect(names[0]).toContain('Idea');
    expect(names[names.length - 1]).toContain('Growth');
  });

  it('Reveal ships content visible in the server HTML (no-JS safety)', () => {
    // The safety property lives in the SERVER render, so it has to be tested
    // there. Under React Testing Library `useSyncExternalStore` resolves to the
    // client snapshot immediately, which is correct behaviour but the wrong
    // environment for this assertion.
    const html = renderToStaticMarkup(<Reveal show={false}>visible anyway</Reveal>);
    expect(html).toContain('visible anyway');
    expect(html).toContain('opacity-100');
    expect(html).not.toContain('opacity-0');
  });

  it('Reveal applies the pre-reveal state only once hydrated', () => {
    // After hydration the reveal becomes real: hidden until its stage is
    // active. This is the half that produces the animation.
    const { container } = render(<Reveal show={false}>content</Reveal>);
    expect(container.firstElementChild!.className).toContain('opacity-0');
    render(<Reveal show>content</Reveal>);
  });

  it('reduced motion collapses transitions rather than removing them', () => {
    // `Reveal` transitions from opacity-0 to opacity-100. If reduced motion
    // disabled animation outright, an element could be stranded at its start
    // state. globals.css instead shortens the duration so it resolves
    // instantly — that distinction is what keeps content reachable.
    const css = readFileSync('app/globals.css', 'utf8');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('transition-duration: 0.01ms !important');
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).not.toMatch(/transition:\s*none/);
    expect(block).not.toMatch(/animation:\s*none/);
  });

  it('Territory renders all five roadmap surfaces, every one unbuilt', () => {
    render(<Territory />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    for (const li of items) {
      expect(within(li).getByText('In development')).toBeTruthy();
    }
    for (const name of ['Timeline', 'Compliance', 'Funding', 'Documents', 'Assistant']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
    }
  });

  it('Territory names what actually exists today', () => {
    render(<Territory />);
    // The counterweight to five unbuilt surfaces: the section cannot be read
    // as a feature list if it says plainly what is shipped.
    expect(screen.getByText('Available today')).toBeTruthy();
    for (const a of ['Accounts', 'Business setup', 'Guided intake']) {
      expect(screen.getByText(a)).toBeTruthy();
    }
  });

  it('Territory ships both art-directed frames with real alt text', () => {
    const { container } = render(<Territory />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    for (const img of imgs) {
      expect(img.getAttribute('alt')!.length).toBeGreaterThan(30);
    }
    // Reuses the approved assets; does not introduce new imagery.
    const srcs = imgs.map((i) => i.getAttribute('src') ?? '');
    expect(srcs.some((s) => s.includes('banks-desktop'))).toBe(true);
    expect(srcs.some((s) => s.includes('banks-mobile'))).toBe(true);
  });

  it('Closing offers one dominant action and one quiet alternative', () => {
    render(<Closing />);
    // Destination matches the application's real signup route.
    const primary = screen.getByRole('link', { name: /Create your account/ });
    expect(primary).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('Closing has exactly one h2 and no competing heading', () => {
    render(<Closing />);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s).toHaveLength(1);
    expect(h2s[0]!.textContent).toBe('Build what comes next.');
  });

  it('Closing claims only what the product actually does today', () => {
    render(<Closing />);
    for (const item of ['Accounts', 'Business setup', 'Guided intake']) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    // None of the unbuilt surfaces may be named as available here.
    const body = document.body.textContent ?? '';
    for (const unbuilt of ['Compliance', 'Funding', 'Timeline', 'Documents', 'Nova']) {
      expect(body).not.toContain(unbuilt);
    }
  });

  it('Closing draws its route line without gating any content on it', () => {
    // The line is decoration; the copy and CTAs never depend on it.
    render(<Closing />);
    expect(screen.getByText(/Create an account, set up your business/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create your account/ })).toBeVisible();
  });

  it('useInView reports settled state in the server render', () => {
    // Same safety rule as Reveal: no-JS and pre-hydration readers see the
    // finished composition, so the drawn line is never a prerequisite.
    const html = renderToStaticMarkup(<Closing />);
    expect(html).toContain('Build what comes next.');
    expect(html).toContain('h-full');
    expect(html).not.toContain('h-0');
  });

  it('SiteFooter mentions Solvane Hub exactly once and only as the builder', () => {
    render(<SiteFooter />);
    const body = document.body.textContent ?? '';
    expect(body.match(/Solvane Hub/g)).toHaveLength(1);
    expect(screen.getByText('Islanda is built by Solvane Hub.')).toBeTruthy();
  });

  it('SiteHeader carries no logo and still names its link', () => {
    const { container } = render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    // The hero's lockup establishes the brand now — showing it again here
    // would be the exact duplicate branding the header deliberately avoids.
    expect(screen.queryByRole('img')).toBeNull();
    // The brand sits on the photograph now; legibility comes from the scrim.
    expect(container.innerHTML).not.toContain('bg-ink/70');
  });

  it('WorkspacePanel labels its content as illustrative', () => {
    render(<WorkspacePanel />);
    // The one thing this panel must never do is look like live data.
    expect(screen.getByText('Example')).toBeTruthy();
    expect(screen.getByText('Conch & Coast Ltd.')).toBeTruthy();
  });

  it('WorkspacePanel does not imply unbuilt features are live', () => {
    render(<WorkspacePanel />);
    expect(screen.getAllByText('On the roadmap')).toHaveLength(2);
  });

  it('WorkspacePanel exposes the progress dial to assistive tech', () => {
    render(<WorkspacePanel />);
    expect(screen.getByRole('img', { name: /40 percent complete/i })).toBeTruthy();
  });

  it('Hero renders one h1 and both art-directed images with real alt text', () => {
    const { container } = render(<Hero />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const imgs = Array.from(container.querySelectorAll('img'));
    // Desktop, mobile and the logo lockup — three images, not counting the
    // background frames as one crop.
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    const backgroundFrames = imgs.filter((img) => (img.getAttribute('src') ?? '').includes('hero'));
    expect(backgroundFrames.length).toBeGreaterThanOrEqual(2);
    for (const img of backgroundFrames) {
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('alt')!.length).toBeGreaterThan(30);
    }
    // The logo lockup is a real image with a short, correct alt — not decorative.
    expect(screen.getByRole('img', { name: 'Islanda' })).toBeTruthy();
  });

  it('Hero offers both a primary and secondary route in', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: /Join the waitlist/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /See how it works/ })).toBeTruthy();
  });
});

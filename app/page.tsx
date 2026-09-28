import type { Metadata } from 'next';
import type { Milestone } from '@/services/progress';
import { Journey } from '@/app/(app)/_components/journey';
import { Hero } from '@/components/marketing/hero';
import { EnterIslanda } from '@/components/marketing/enter-islanda';
import { SiteHeader } from '@/components/marketing/site-header';
import { Problem } from '@/components/marketing/problem';
import { JourneyStages } from '@/components/marketing/journey-stages';
import { Perspectives } from '@/components/marketing/perspectives';
import { ProductReveal } from '@/components/marketing/product-reveal';
import { MeetNova } from '@/components/marketing/meet-nova';
import { SectionHeading } from '@/components/marketing/section';
import { Territory } from '@/components/marketing/territory';
import { WaitlistCta } from '@/components/marketing/waitlist-cta';
import { Closing } from '@/components/marketing/closing';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: "Islanda — Navigate What's Next.",
  description:
    'Islanda helps businesses understand their context, turn fragmented information into intelligence, and navigate what comes next.',
  openGraph: {
    title: "Islanda — Navigate What's Next.",
    description:
      'Islanda helps businesses understand their context, turn fragmented information into intelligence, and navigate what comes next.',
    type: 'website',
  },
};

/**
 * Islanda public launch page.
 *
 * The hero and `EnterIslanda` open the page unnumbered — environment, then
 * the Islanda identity, then the first look at the real workspace — before
 * the eight numbered chapters begin, which alternate between ink and canvas:
 * deep water, then the chart. The champagne editorial accent (chapter
 * numbers, small caps) still carries that alternation's argument even though
 * the header/closing mark is now the 2026 asset. The problem (§02) and the
 * waitlist (§08) were added for the public launch; §03–§07 are the original
 * six-chapter page, renumbered and otherwise unchanged.
 *
 * This file is a Server Component and stays one. The only client code on the
 * page is leaf components that genuinely need state — the scroll-driven stage
 * rail, the perspectives tablist, and the waitlist form.
 *
 * `EXAMPLE_MILESTONES` is illustrative content, clearly labelled as such
 * wherever it renders. It is shaped as real `Milestone` values so the marketing
 * page renders the *actual* Journey component: if the product changes, this
 * page changes with it rather than drifting into fiction.
 */
const EXAMPLE_MILESTONES: Milestone[] = [
  {
    key: 'business',
    title: 'Create your business',
    description: 'Conch & Coast Ltd. · BS',
    state: 'complete',
  },
  {
    key: 'intake',
    title: 'Complete your intake',
    description: '3 of 5 questions answered.',
    state: 'current',
    href: '/signup',
    actionLabel: 'Continue intake',
  },
  {
    key: 'requirements',
    title: 'Requirements we found',
    description:
      'What your business needs to register, licence and file — each one cited to its source.',
    state: 'upcoming',
  },
  {
    key: 'plan',
    title: 'Your launch plan',
    description: 'Arriving in a later phase of the roadmap.',
    state: 'blocked',
  },
];

export default function HomePage() {
  return (
    <>
      {/* The landing page has no app chrome, so it carries its own skip link. */}
      <a
        href="#main"
        className="bg-on-ink text-ink sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* The header is absolutely positioned over the hero photograph but stays
          a sibling of `main`, so it keeps its `banner` role and no content sits
          outside a landmark (axe `region`). */}
      <div className="relative">
        <SiteHeader />
        <main id="main">
          <Hero />

          <EnterIslanda />

          {/* 02 — the problem, named plainly before the product is shown. */}
          <section className="bg-abyss text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading
                tone="ink"
                index="02"
                eyebrow="The problem"
                title="Your business already knows the answer. It's just scattered."
              />
              <div className="mt-14 lg:mt-16">
                <Problem />
              </div>
            </div>
          </section>

          {/* 03 — the route. Ink after the problem: the chapter break is
              the move from THE PROBLEM to THE ROUTE. */}
          <section id="journey" className="bg-ink text-on-ink relative isolate overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(90% 55% at 15% 0%, oklch(76% 0.127 203 / 0.10) 0%, transparent 62%)',
              }}
            />
            <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36">
              <SectionHeading
                tone="ink"
                index="03"
                eyebrow="How Islanda works"
                title="One route, from idea to operating business."
                lede="Islanda holds the whole path and works out which parts of it apply to you. Guided intake is available today; the stages beyond it are in development, and each one below says which it is."
              />
              <div className="mt-20 lg:mt-28">
                <JourneyStages />
              </div>
            </div>
          </section>

          {/* 04 — inside the system. Stays in the ink/marine family: §03 and
              §04 are the same environment at different depths, not two themes.
              The route line from §03 continues down this section's gutter. */}
          <section className="bg-marine text-on-ink relative isolate overflow-hidden">
            {/* Seam from §03's ink, and back down to ink for §05 — the section
                is a tonal band rather than a flat block. */}
            <div
              aria-hidden="true"
              className="from-ink pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b to-transparent"
            />
            <div
              aria-hidden="true"
              className="to-ink pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent"
            />
            {/* Light from the water surface far above. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(80% 45% at 30% 0%, oklch(76% 0.127 203 / 0.07) 0%, transparent 60%)',
              }}
            />

            <div className="mx-auto w-full max-w-[84rem] px-6 py-24 sm:px-8 lg:px-12 lg:py-36">
              <SectionHeading
                tone="ink"
                index="04"
                eyebrow="See it work"
                title="Watch it work through the route."
                lede="The same journey, now from the inside. Your words go in, structure comes out, and the route resolves into one thing to do next."
              />
              <div className="mt-16 lg:mt-24">
                <ProductReveal journey={<Journey milestones={EXAMPLE_MILESTONES} />} />
              </div>
            </div>
          </section>

          {/* 05 — meet Nova. Islanda's assistant, introduced as working WITH
              the business context above it — never as a synonym for Islanda. */}
          <section className="bg-ink text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
              <SectionHeading
                tone="ink"
                index="05"
                eyebrow="Meet Nova"
                title="Islanda's intelligent business assistant."
              />
              <div className="mt-14 lg:mt-16">
                <MeetNova />
              </div>
            </div>
          </section>

          {/* 06 — four instruments. Stays in the ink family; the variation is
              horizontal composition and a marine → abyss descent across the
              four panels rather than a change of tone for the section. */}
          <section className="bg-ink text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-[88rem] px-6 py-24 sm:px-8 lg:px-12 lg:py-36">
              <SectionHeading
                tone="ink"
                index="06"
                eyebrow="Perspectives"
                title="Four ways to look at the same system."
                lede="Build, understand, operate, grow. Not four products — four views of one, and each says plainly which parts exist today."
              />
              <div className="mt-14 lg:mt-20">
                <Perspectives />
              </div>
            </div>
          </section>

          {/* 07 — over the territory. The environment returns: a marine
              intro, then the approved photograph as a sticky stage the roadmap
              travels across. Relief for the lower half of the page without
              leaving the visual language. */}
          <section className="bg-marine text-on-ink relative isolate">
            <div
              aria-hidden="true"
              className="from-ink pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b to-transparent"
            />
            <div className="mx-auto w-full max-w-6xl px-6 pt-24 pb-16 sm:px-8 lg:px-12 lg:pt-36 lg:pb-24">
              <SectionHeading
                tone="ink"
                index="07"
                eyebrow="Who it's for"
                title="Built for the place it operates in."
                lede="Entrepreneurs, founders, existing businesses and the advisors who work with them. Islanda exists for businesses forming in The Bahamas today — what follows is where the product is going, described as direction, not as capability."
              />
            </div>

            <Territory />
          </section>

          {/* 08 — the waitlist. The primary conversion point for a visitor who
              isn't ready to create an account today. */}
          <section id="waitlist" className="bg-abyss text-on-ink relative isolate overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(85% 55% at 50% 0%, oklch(76% 0.127 203 / 0.10) 0%, transparent 62%)',
              }}
            />
            <div className="mx-auto w-full max-w-4xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
              <WaitlistCta />
            </div>
          </section>

          <Closing />
        </main>
      </div>

      <SiteFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { SiteHeader } from '@/components/marketing/site-header';
import { Problem } from '@/components/marketing/problem';
import { AvailableToday } from '@/components/marketing/available-today';
import { ExampleBusiness } from '@/components/marketing/example-business';
import { ComingNext } from '@/components/marketing/coming-next';
import { Faq } from '@/components/marketing/faq';
import { SectionHeading } from '@/components/marketing/section';
import { WaitlistCta } from '@/components/marketing/waitlist-cta';
import { SiteFooter } from '@/components/marketing/site-footer';
import { serverEnv } from '@/lib/env';
import { accessModeFrom } from '@/lib/product/availability';

const DESCRIPTION =
  'Starting a business in The Bahamas? Islanda is being built to help you organize your business idea and take a clearer first step. Join the early-access waitlist.';

export const metadata: Metadata = {
  title: 'Islanda — Starting a business in The Bahamas? Start here.',
  description: DESCRIPTION,
  openGraph: {
    title: 'Islanda — Starting a business in The Bahamas? Start here.',
    description: DESCRIPTION,
    type: 'website',
  },
};

/**
 * Islanda public homepage.
 *
 * Built to be understood in about ten seconds by someone with a business idea
 * and no background in business software: who it is for, what problem it
 * addresses, what works today, whether they can get in, and what to do next.
 * Six sections after the hero, one primary action (the waitlist):
 *
 *   A  the problem, in situations people recognise
 *   B  what Islanda helps with today       ← availability register
 *   C  one example, labelled as made up
 *   D  what we are building next          ← availability register
 *   E  straight answers
 *   F  early access (the waitlist)
 *
 * Every statement about who can get in comes from the access mode
 * (`WAITLIST_ONLY_MODE`), and every statement about what works comes from
 * `lib/product/availability.ts`, so this page, the auth pages and the app
 * describe one product.
 *
 * A Server Component; the waitlist form is the only client code on the page.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  const { access } = await searchParams;
  const mode = accessModeFrom(serverEnv.WAITLIST_ONLY_MODE);
  // Set by every sign-in, sign-up and app route the waitlist gate redirects.
  const redirectedByGate = mode === 'waitlist' && access === 'waitlist';

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
        <SiteHeader mode={mode} />
        <main id="main">
          {redirectedByGate ? (
            <p role="status" className="bg-abyss text-on-ink px-6 py-4 text-center text-sm">
              Sign-in isn&apos;t open yet. Islanda is in early access and not open to the public.{' '}
              <Link href="#waitlist" className="font-semibold underline underline-offset-4">
                Join the waitlist
              </Link>{' '}
              and we&apos;ll email you when access opens.
            </p>
          ) : null}

          <Hero mode={mode} />

          {/* A — the problem */}
          <section className="bg-abyss text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading
                tone="ink"
                index="01"
                eyebrow="The problem"
                title="Starting a business shouldn't feel like guesswork."
              />
              <div className="mt-10 lg:mt-12">
                <Problem />
              </div>
            </div>
          </section>

          {/* B — what works today */}
          <section
            id="today"
            className="bg-ink text-on-ink relative isolate overflow-hidden"
            aria-labelledby="today-heading"
          >
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading
                tone="ink"
                index="02"
                eyebrow="Available to early-access users"
                title={<span id="today-heading">What you can do in Islanda today</span>}
                lede="Islanda gives your business idea a home: one private place for what your business is, what you want, and the files that go with it."
              />
              <div className="mt-10 lg:mt-12">
                <AvailableToday />
              </div>
            </div>
          </section>

          {/* C — an example */}
          <section className="bg-marine text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading
                tone="ink"
                index="03"
                eyebrow="An example"
                title="A small food business, start to first step"
                lede="Here is how someone with a food-stand idea might use Islanda today."
              />
              <div className="mt-10 lg:mt-12">
                <ExampleBusiness />
              </div>
            </div>
          </section>

          {/* D — coming next, one list */}
          <section className="bg-ink text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading
                tone="ink"
                index="04"
                eyebrow="Not ready yet"
                title="What we're building next"
                lede="These are in progress and not available today. We will only switch each one on when its information is current and checked against official sources."
              />
              <div className="mt-10 lg:mt-12">
                <ComingNext />
              </div>
            </div>
          </section>

          {/* E — questions */}
          <section className="bg-abyss text-on-ink relative isolate overflow-hidden">
            <div className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <SectionHeading tone="ink" index="05" eyebrow="Questions" title="Common questions" />
              <div className="mt-10">
                <Faq mode={mode} />
              </div>
            </div>
          </section>

          {/* F — the waitlist. The page's one conversion point. */}
          <section id="waitlist" className="bg-ink text-on-ink relative isolate overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(85% 55% at 50% 0%, oklch(76% 0.127 203 / 0.10) 0%, transparent 62%)',
              }}
            />
            <div className="mx-auto w-full max-w-4xl scroll-mt-4 px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
              <WaitlistCta mode={mode} />
            </div>
          </section>
        </main>
      </div>

      <SiteFooter mode={mode} />
    </>
  );
}

'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo-mark';
import { cn } from '@/lib/utils/cn';
import { ChartField } from './chart-field';
import { useInView } from './reveal';

/**
 * Section 06 — the close.
 *
 * The payoff of the descent. Deepest surface on the page, the most negative
 * space, and one thing to do.
 *
 * THE LINE CLOSES THE PAGE. The turquoise rail that started in §02 and carried
 * through §03 returns here, descends the left gutter, and terminates in a live
 * node beside the primary action. The route the page has been describing ends
 * at the button. That is the whole composition, and it is why the CTA sits
 * where it does rather than centred.
 *
 * MOTION IS A NEW MECHANISM. §02–§05 all track scroll position. This draws once
 * on arrival and stops — `useInView` latches, so nothing recomputes afterwards.
 *
 * TRUTHFULNESS. The value line names only what exists today: accounts,
 * business setup, guided intake. Everything past that is stated as forthcoming,
 * and the citation promise is written as a constraint on the product rather
 * than as a feature it already ships.
 */
export function Closing() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="bg-abyss text-on-ink relative isolate flex min-h-[92svh] items-center overflow-hidden">
      {/* Topographic texture, well under the content. */}
      <ChartField tone="ink" flip className="opacity-[0.18]" />

      {/* Light from far above the water, and the deep floor below it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(85% 55% at 22% 108%, oklch(76% 0.127 203 / 0.10) 0%, transparent 62%)',
        }}
      />
      <div
        aria-hidden="true"
        className="from-ink pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b to-transparent"
      />

      <div
        ref={ref}
        className="relative mx-auto w-full max-w-6xl px-6 py-28 sm:px-8 lg:px-12 lg:py-40"
      >
        <div className="grid max-w-2xl grid-cols-[auto_minmax(0,1fr)] gap-x-7 sm:gap-x-10">
          {/* The route, arriving. */}
          <div aria-hidden="true" className="relative w-px justify-self-center">
            <div className="absolute inset-0 bg-white/10" />
            <div
              className={cn(
                'bg-bahama-turquoise absolute inset-x-0 top-0 origin-top',
                'transition-[height] duration-[1400ms] ease-out',
                inView ? 'h-full' : 'h-0',
              )}
            />
            {/* Terminus. Sits level with the primary action. */}
            <span
              className={cn(
                'absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full',
                'transition-[background-color,box-shadow] delay-[1200ms] duration-500',
                inView
                  ? 'bg-bahama-turquoise shadow-[0_0_0_5px_oklch(76%_0.127_203_/_0.18)]'
                  : 'bg-white/20',
              )}
            />
          </div>

          <div className="pb-1">
            <LogoMark height={40} />

            <h2 className="mt-9 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
              Build what comes next.
            </h2>

            <p className="text-on-ink-muted mt-6 max-w-lg text-base text-pretty sm:text-lg">
              Create an account, set up your business and work through guided intake. Islanda builds
              a structured picture of what you are starting — and will only ever show you a
              requirement it can cite.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-on-ink text-ink hover:bg-champagne shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Create your account
                  <ArrowRight aria-hidden="true" strokeWidth={2} />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-ink-line-strong text-on-ink hover:bg-ink-raised hover:border-ink-line-strong bg-transparent"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          {/* Second grid row, so this tracks the content column exactly rather
              than guessing a padding that has to follow the gap. */}
          <div className="col-start-2 mt-10 flex flex-wrap items-center gap-2">
            <span className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
              Available today
            </span>
            {['Accounts', 'Business setup', 'Guided intake'].map((item) => (
              <span
                key={item}
                className="border-bahama-turquoise/35 bg-bahama-turquoise/12 text-bahama-turquoise text-2xs inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
              >
                <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

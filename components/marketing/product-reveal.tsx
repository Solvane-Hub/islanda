'use client';

import { ArrowUpRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AppWindow, type WindowStage } from './app-window';
import { RouteLine } from './route-line';
import { Reveal } from './reveal';
import { useActiveStage } from './use-active-stage';

/**
 * Section 03 — inside the system.
 *
 * §02 says "here is the route". This says "here is the system working through
 * it". The window constructs itself in four stages: the founder's words, the
 * structure derived from them, the route that follows, and the one thing to do
 * next.
 *
 * DERIVATION, SHOWN NOT DRAWN. The proposal called for connector lines running
 * from phrases in the statement to the fields they produce. Built and
 * reconsidered: crossing lines across a two-column grid need runtime geometry,
 * break at every breakpoint, and read as clutter rather than as causation.
 * Instead each phrase and its field share a numeral and light up together —
 * same information, no crossing lines, nothing to measure. Clarity over
 * animation complexity, as instructed.
 *
 * TRUTHFULNESS: every stage past Formation is marked in development, the
 * window is labelled Example throughout, and the `journey` slot is the real
 * application component passed down from the Server Component so `components/`
 * never reaches into `services/`.
 */

const STAGES: readonly WindowStage[] = [
  { index: '01', label: 'Describe' },
  { index: '02', label: 'Understand' },
  { index: '03', label: 'Route' },
  { index: '04', label: 'Act' },
];

/** Phrase fragments of the intake statement, tagged with the field they feed. */
const STATEMENT: readonly { text: string; field?: number }[] = [
  { text: 'We’re opening a small ' },
  { text: 'seafood counter and takeaway', field: 1 },
  { text: ' in ' },
  { text: 'The Bahamas', field: 0 },
  { text: '. ' },
  { text: 'Three of us', field: 2 },
  { text: ' to start, one location, and we ' },
  { text: 'haven’t registered anything yet', field: 3 },
  { text: ' — we want to know what we need before we sign a lease.' },
];

const FIELDS = [
  { n: '01', label: 'Jurisdiction', value: 'The Bahamas' },
  { n: '02', label: 'Industry', value: 'Food service' },
  { n: '03', label: 'Team', value: '3 people' },
  { n: '04', label: 'Stage', value: 'Idea' },
];

const ROUTE = [
  { name: 'Idea', state: 'done' as const },
  { name: 'Formation', state: 'current' as const },
  { name: 'Compliance', state: 'planned' as const },
  { name: 'Funding', state: 'planned' as const },
  { name: 'Growth', state: 'planned' as const },
];

export function ProductReveal({ journey }: { journey: React.ReactNode }) {
  const { active, register, progress } = useActiveStage(STAGES.length);

  return (
    <div className="relative grid gap-8 lg:grid-cols-[1.75rem_minmax(0,1fr)] lg:gap-12">
      {/* The line from §02, continuing down this section. */}
      <div className="hidden lg:block">
        <div className="sticky top-24 h-[60vh]">
          <RouteLine
            progress={progress}
            nodes={[0.05, 0.35, 0.65, 0.95]}
            active={active}
            className="mx-auto h-full"
          />
        </div>
      </div>

      <div className="min-w-0">
        <AppWindow stages={STAGES} active={active}>
          <div className="flex flex-col gap-10">
            {/* ---- 01 / 02 — words in, structure out ---- */}
            <div ref={register(0)} className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
              <figure className="m-0">
                <figcaption className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                  From your intake
                </figcaption>
                <blockquote className="border-bahama-turquoise/40 mt-3 border-l-2 pl-4">
                  <p className="text-on-ink text-base text-pretty sm:text-lg">
                    {STATEMENT.map((part, i) =>
                      part.field === undefined ? (
                        <span key={i}>{part.text}</span>
                      ) : (
                        <span
                          key={i}
                          className={cn(
                            'relative rounded-sm px-0.5 transition-colors duration-500',
                            active >= 1
                              ? 'bg-bahama-turquoise/15 text-on-ink decoration-bahama-turquoise/70 underline decoration-2 underline-offset-4'
                              : 'bg-transparent',
                          )}
                        >
                          {part.text}
                          <span
                            data-numeric
                            aria-hidden="true"
                            className={cn(
                              'text-bahama-turquoise ml-1 align-super text-[0.5625rem] font-semibold tabular-nums transition-opacity duration-500',
                              active >= 1 ? 'opacity-100' : 'opacity-0',
                            )}
                          >
                            {FIELDS[part.field]!.n}
                          </span>
                        </span>
                      ),
                    )}
                  </p>
                </blockquote>
              </figure>

              <div ref={register(1)}>
                <p className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                  Business profile
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2.5">
                  {FIELDS.map((f, i) => {
                    const filled = active >= 1;
                    return (
                      <div
                        key={f.label}
                        className={cn(
                          'rounded-lg border px-3 py-3 transition-colors duration-500',
                          filled
                            ? 'border-bahama-turquoise/30 bg-bahama-turquoise/[0.07]'
                            : 'border-marine-line/70 border-dashed',
                        )}
                        style={filled ? { transitionDelay: `${i * 90}ms` } : undefined}
                      >
                        <dt className="flex items-center gap-1.5">
                          <span
                            data-numeric
                            aria-hidden="true"
                            className={cn(
                              'text-2xs font-semibold tabular-nums transition-colors duration-500',
                              filled ? 'text-bahama-turquoise' : 'text-on-ink-subtle',
                            )}
                          >
                            {f.n}
                          </span>
                          <span className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                            {f.label}
                          </span>
                        </dt>
                        <dd
                          className={cn(
                            'mt-1.5 text-sm font-medium transition-colors duration-500',
                            filled ? 'text-on-ink' : 'text-on-ink-subtle',
                          )}
                          style={filled ? { transitionDelay: `${i * 90 + 60}ms` } : undefined}
                        >
                          {f.value}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="text-on-ink-subtle mt-3 text-xs">
                  Derived from your answers, not asked for separately.
                </p>
              </div>
            </div>

            {/* ---- 03 — the route ---- */}
            <div ref={register(2)}>
              <Reveal show={active >= 2}>
                <div className="border-marine-line/60 border-t pt-8">
                  <p className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                    Your route
                  </p>

                  <ol className="relative mt-6 grid grid-cols-2 gap-y-7 sm:grid-cols-5 sm:gap-y-0">
                    {/* Track, and the fill that advances with the reader. */}
                    <span
                      aria-hidden="true"
                      className="bg-marine-line absolute top-[7px] right-0 left-0 hidden h-px sm:block"
                    />
                    <span
                      aria-hidden="true"
                      className="bg-bahama-turquoise absolute top-[7px] left-0 hidden h-px transition-[width] duration-700 ease-out sm:block"
                      style={{ width: active >= 2 ? '30%' : '0%' }}
                    />

                    {ROUTE.map((step) => (
                      <li key={step.name} className="relative flex flex-col gap-2.5 sm:pr-4">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'relative z-10 flex size-[15px] items-center justify-center rounded-full border-2 transition-colors duration-500',
                            step.state === 'done' &&
                              'border-bahama-turquoise bg-bahama-turquoise text-abyss',
                            step.state === 'current' &&
                              'border-bahama-turquoise bg-abyss ring-bahama-turquoise/20 ring-4',
                            step.state === 'planned' && 'border-marine-line bg-abyss',
                          )}
                        >
                          {step.state === 'done' ? (
                            <Check className="size-2" strokeWidth={4} />
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            step.state === 'planned' ? 'text-on-ink-muted' : 'text-on-ink',
                          )}
                        >
                          {step.name}
                        </span>
                        <span className="text-on-ink-subtle text-2xs font-medium tracking-wide uppercase">
                          {step.state === 'done'
                            ? 'Complete'
                            : step.state === 'current'
                              ? 'Next'
                              : 'In development'}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            </div>

            {/* ---- 04 — the payoff ---- */}
            <div ref={register(3)}>
              <Reveal show={active >= 3}>
                <div className="border-marine-line/60 flex flex-col gap-7 border-t pt-8">
                  <div>
                    <p className="text-on-ink-subtle text-2xs mb-4 font-medium tracking-wide uppercase">
                      Your next steps
                    </p>
                    <div className="marketing-journey">{journey}</div>
                  </div>

                  {/* The one thing to do next, lifted above the window plane. */}
                  <div className="border-bahama-turquoise/25 bg-bahama-turquoise/[0.08] flex items-center gap-4 rounded-xl border p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-bahama-turquoise text-2xs font-medium tracking-wide uppercase">
                        Do this next
                      </p>
                      <p className="text-on-ink mt-1 text-sm font-medium">
                        Finish intake to continue
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="bg-on-ink text-abyss flex size-8 shrink-0 items-center justify-center rounded-full"
                    >
                      <ArrowUpRight className="size-4" strokeWidth={2.25} />
                    </span>
                  </div>

                  <p className="text-on-ink-subtle text-xs">
                    Compliance, funding and growth are in development. Islanda will show a
                    requirement only when it can cite the legislation behind it.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
}

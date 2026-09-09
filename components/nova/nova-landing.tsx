import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { NovaField } from '@/components/nova/nova-field';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';
import { currentNovaUpdate } from '@/lib/nova/updates';

/**
 * What a founder sees before they have asked anything.
 *
 * ## The fragmentation story, told without a diagram
 *
 * The problem Foundry exists to solve is that the information a founder needs
 * is scattered across separate Acts, regulations and agency notices that do not
 * refer to one another. The temptation is to draw that: three boxes, an arrow,
 * a funnel.
 *
 * Instead the MARK carries it. At rest its nine points are scattered — that is
 * the fragmentation. When a question is asked they converge onto a single axis
 * — that is the answer. The story is told by the thing the founder is already
 * watching, driven by real request state, and it costs no screen space.
 *
 * The copy underneath names the problem once, in a sentence, and then gets out
 * of the way. Everything else on this screen is either the composer or a fact
 * about what Foundry actually holds.
 */

export function NovaLanding({
  businessName,
  knowledgeLine,
  contextLine,
  hero,
  children,
}: {
  businessName: string;
  /**
   * What Foundry holds for this jurisdiction, in one line.
   *
   * ⚠ Computed by the page from the database. Never a claim this component
   *   invents — if there is nothing to say, the caller passes null.
   */
  knowledgeLine: string | null;
  /**
   * A subtle acknowledgement that Nova is working with the business the founder
   * just brought in (§10/§11). Computed by the page from the Business Object;
   * null when there is not yet enough context to say so. Makes no legal claim.
   */
  contextLine?: string | null;
  /**
   * Nova's presence, at rest. Supplied by the console (a client component that
   * can resolve motion preference); when absent the landing falls back to the
   * illustrative constellation scatter, which keeps this component usable and
   * server-renderable on its own.
   */
  hero?: React.ReactNode;
  /** The composer and its starting points. */
  children: React.ReactNode;
}) {
  const update = currentNovaUpdate();

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section aria-labelledby="nova-intro-heading" className="flex flex-col gap-5 px-1">
        {/*
          Nova's presence at rest — the physical instrument, quietly breathing,
          particles loosely held. This is the "before" of the story the whole
          surface tells, and it is the same object that gathers and converges
          once a question is asked.

          Falls back to the constellation scatter when no hero is supplied, so
          the landing still reads on its own. Both are decorative here — the
          "Nova" heading below carries the identity to assistive technology.
        */}
        {hero ?? <NovaField state="idle" nodes={[]} className="-mb-2 opacity-70" />}

        <div className="flex items-start gap-5 sm:gap-6">
          <div className="min-w-0">
            <SurfaceLabel as="p" id="nova-intro-heading">
              Nova
            </SurfaceLabel>
            <h1 className="text-on-ink mt-3 text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl lg:text-4xl">
              What do you want to understand about {businessName}?
            </h1>
            <p className="text-on-ink-muted mt-3 max-w-xl text-sm text-pretty sm:text-base">
              What applies to your business is spread across separate Acts, regulations and agency
              notices. Nova searches the published sources Foundry holds for your jurisdiction and
              quotes what it finds — with the provision it came from.
            </p>

            {contextLine ? (
              <p className="text-champagne-dim mt-3 max-w-xl text-sm text-pretty">{contextLine}</p>
            ) : null}

            <Link
              href="/assistant/about"
              className="text-bahama-turquoise hover:text-on-ink mt-4 inline-flex items-center gap-1.5 rounded-sm text-xs transition-colors duration-150"
            >
              How Nova works
              <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {children}

      <div className="grid gap-3 sm:grid-cols-2">
        {knowledgeLine ? (
          <WorkspaceSurface
            as="section"
            tone="inset"
            aria-labelledby="nova-knowledge-heading"
            className="flex flex-col gap-2 p-5"
          >
            <div className="flex items-center gap-2.5">
              <Layers aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
              <SurfaceLabel as="h2" id="nova-knowledge-heading">
                Knowledge
              </SurfaceLabel>
            </div>
            <p className="text-on-ink-muted text-xs text-pretty">{knowledgeLine}</p>
          </WorkspaceSurface>
        ) : null}

        {update ? (
          <WorkspaceSurface
            as="section"
            tone="inset"
            aria-labelledby="nova-update-heading"
            className="flex flex-col gap-2 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <SurfaceLabel as="h2" id="nova-update-heading">
                What&rsquo;s new in Nova
              </SurfaceLabel>
              <span className="text-on-glass-subtle text-2xs">{update.period}</span>
            </div>

            <p className="text-on-ink text-xs font-medium text-pretty">{update.headline}</p>

            <details className="group mt-1">
              <summary className="text-bahama-turquoise hover:text-on-ink cursor-pointer list-none rounded-sm text-xs underline underline-offset-4 transition-colors duration-150 marker:content-none">
                <span className="group-open:hidden">Read more</span>
                <span className="hidden group-open:inline">Show less</span>
              </summary>

              <div className="mt-3 flex flex-col gap-3">
                <p className="text-on-ink-muted text-xs text-pretty">{update.what}</p>

                <div>
                  <SurfaceLabel as="p" className="text-on-glass-subtle">
                    Why this matters
                  </SurfaceLabel>
                  <p className="text-on-ink-muted mt-1.5 text-xs text-pretty">{update.why}</p>
                </div>

                <div>
                  <SurfaceLabel as="p" className="text-on-glass-subtle">
                    What we&rsquo;re working on
                  </SurfaceLabel>
                  <ul className="text-on-ink-muted mt-1.5 flex flex-col gap-1 text-xs">
                    {update.next.map((item) => (
                      <li key={item} className="flex gap-2 text-pretty">
                        <span aria-hidden="true" className="text-champagne shrink-0">
                          ·
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </WorkspaceSurface>
        ) : null}
      </div>
    </div>
  );
}

import { WorkspacePanel } from './workspace-panel';

/**
 * The arrival beat — environment, then Islanda, then the door in.
 *
 * Sits directly under the hero, unnumbered (it is not one of the page's eight
 * chapters — §02 still opens with "the problem"), because its only job is to
 * hold the real workspace preview the hero used to carry. The hero states the
 * identity; this section is where the visitor first sees the product itself.
 *
 * The five areas listed below name what Islanda organizes a business's
 * information into. They are labels, not a claim that every one is fully
 * built today — the panel above them is the one sanctioned product preview,
 * and the areas describe its scope rather than adding screens that don't
 * exist yet.
 */
const AREAS = ['Business context', 'Financials', 'Goals', 'Documents', 'Regulatory'];

export function EnterIslanda() {
  return (
    <section className="bg-ink text-on-ink relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(80% 50% at 50% 0%, oklch(76% 0.127 203 / 0.09) 0%, transparent 60%)',
        }}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 py-24 text-center sm:px-8 lg:px-12 lg:py-32">
        <div className="flex max-w-xl flex-col items-center gap-4">
          <span className="text-champagne-dim text-2xs font-medium tracking-[0.18em] uppercase">
            The Islanda workspace
          </span>
          <p className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
            Your business information shouldn&apos;t live in fragments.
          </p>
        </div>

        <div className="hero-panel w-full max-w-lg">
          <WorkspacePanel />
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {AREAS.map((area) => (
            <li key={area} className="text-on-ink-muted text-sm">
              {area}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

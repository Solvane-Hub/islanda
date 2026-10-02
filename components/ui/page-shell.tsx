import { cn } from '@/lib/utils/cn';

/**
 * The header every workspace route shares.
 *
 * The dashboard already had the right treatment — an eyebrow for context, a
 * large balanced title, a meta row of separated facts, an optional action —
 * and it was written inline, so no other route could use it. Meanwhile
 * `PageHeader` gave every other screen a flat `text-2xl`. The product had two
 * competing header languages and was using the weaker one almost everywhere.
 *
 * This is the dashboard's version, promoted. `PageHeader` stays for the light
 * canvas routes, which have different density needs and are not part of the
 * water composition.
 *
 * ## Why the header sits directly on the environment
 *
 * Nothing wraps it in a surface. The identity zone is meant to be ON the
 * water, with the working surfaces suspended below it — that separation is
 * what makes the shell read as spatial rather than as a stack of cards. The
 * `Environment` scrim carries a heavier wash across the top precisely so text
 * here stays legible without needing a panel behind it.
 */

export function PageShell({
  eyebrow,
  title,
  description,
  meta,
  action,
  children,
  className,
}: {
  /** Context — the business name, the section. Lets the title stay short. */
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  /** Facts under the title. Separated by hairlines, not commas. */
  meta?: React.ReactNode;
  /** One action, right-aligned on wide screens. Two is a toolbar, not a header. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('workspace-env flex flex-col gap-6 sm:gap-8', className)}>
      <header className="flex flex-col gap-5 px-1 pt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:pt-8 lg:pt-10">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-2xs text-champagne font-medium tracking-[0.18em] uppercase">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="text-on-ink mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h1>

          {description ? (
            <p className="text-on-ink-muted mt-3 max-w-2xl text-sm text-pretty sm:text-base">
              {description}
            </p>
          ) : null}

          {meta ? (
            <div className="text-on-ink-muted mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
              {meta}
            </div>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {children}
    </div>
  );
}

/**
 * A hairline between two facts in the meta row.
 *
 * A rule rather than a middot: at this size a middot reads as punctuation
 * inside the sentence, and these are separate facts, not a list.
 */
export function MetaDivider() {
  return <span aria-hidden="true" className="h-3 w-px bg-white/20" />;
}

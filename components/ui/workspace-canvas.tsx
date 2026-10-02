import { cn } from '@/lib/utils/cn';

/**
 * A primary working panel, floating in the environment.
 *
 * ## Dark, like everything else
 *
 * The whole application is one deep-water intelligence environment: the shell,
 * the dashboard, Nova, intake and review all sit on the abyss under the same
 * glass. This panel is where the remaining long-form surfaces live — settings,
 * creating a business, error and empty fallbacks — and it now shares that DNA
 * rather than being a light card pasted onto the water.
 *
 * It carries `.workspace-env`, so every primitive inside it — `PageHeader`,
 * `Input`, `Select`, `Textarea`, `Button`, badges, focus rings — resolves
 * against the dark-surface token remap automatically. The contrast figures for
 * that scope are the audited ones in `app/globals.css` (`on-ink` 17:1 on glass,
 * placeholders 6.45:1), so a form is as readable here as on the old canvas
 * without any per-page colour.
 *
 * ## Material
 *
 * Deep translucent glass, a hairline border and the shell's soft depth shadow,
 * blurred so the environment reads through it as atmosphere rather than as a
 * background image. It is a PRIMARY information surface — solid enough to hold a
 * form — where the rail and contextual modules are the lighter, secondary glass.
 *
 * Each route opts in; the layout deliberately does not apply it, so a route can
 * still compose directly on the environment (the dashboard, Nova) when it wants
 * the water visible around its own modules.
 */
export function WorkspaceCanvas({
  children,
  className,
  /** Wider than prose, for pages that lay out in columns. */
  width = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'default' | 'wide';
}) {
  return (
    <div
      className={cn(
        'workspace-env bg-glass-deep/80 shadow-glass rounded-2xl border border-white/8 backdrop-blur-xl sm:rounded-3xl',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto w-full px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12',
          width === 'wide' ? 'max-w-5xl' : 'max-w-3xl',
        )}
      >
        {children}
      </div>
    </div>
  );
}

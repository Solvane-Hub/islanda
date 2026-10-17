import { cn } from '@/lib/utils/cn';

/**
 * Accessible form field wrapper.
 *
 * Wires label, description and error to the control via aria-describedby and
 * aria-invalid so screen readers announce validation failures. Accessibility is
 * a core requirement, not an enhancement (Frontend Architecture).
 */
export function Field({
  id,
  label,
  error,
  description,
  optional,
  required,
  size = 'default',
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  description?: string | undefined;
  optional?: boolean;
  /** Shows a visible "Required" tag. Use where some fields on the form are optional and some are not. */
  required?: boolean;
  /**
   * `question` sets the label at display size and the description at reading
   * size, for a screen that asks one thing.
   *
   * This is a size variant, not a second component, and specifically not a
   * second heading: the intake's focal question IS the field's label, so the
   * control keeps exactly one accessible name and there is no decorative
   * headline repeating it above.
   */
  size?: 'default' | 'question';
  children: (aria: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const errorId = `${id}-error`;
  const descId = `${id}-description`;
  const describedBy =
    [error ? errorId : null, description ? descId : null].filter(Boolean).join(' ') || undefined;
  const question = size === 'question';

  return (
    <div className={cn('flex flex-col', question ? 'gap-5' : 'gap-2', className)}>
      <div
        className={cn(
          'flex gap-3',
          question ? 'flex-col items-start gap-2' : 'items-baseline justify-between',
        )}
      >
        <label
          htmlFor={id}
          className={cn(
            'text-foreground',
            question
              ? 'max-w-xl text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl'
              : 'text-sm font-medium',
          )}
        >
          {label}
        </label>
        {optional || required ? (
          <span
            className={cn(
              'text-foreground-subtle font-normal',
              question ? 'text-2xs tracking-[0.14em] uppercase' : 'text-xs',
            )}
          >
            {optional ? 'Optional' : 'Required'}
          </span>
        ) : null}
      </div>
      {/* Description sits ABOVE the control: guidance a founder needs in order to
          answer is useless underneath the box they have already filled in. */}
      {description ? (
        <p
          id={descId}
          className={cn(
            'text-foreground-muted',
            question ? '-mt-2 max-w-xl text-base text-pretty' : '-mt-0.5 text-xs',
          )}
        >
          {description}
        </p>
      ) : null}
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error ? (
        <p
          id={errorId}
          className={cn('text-danger font-medium', question ? 'text-sm' : 'text-xs')}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

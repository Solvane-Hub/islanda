import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Styling is expressed entirely in design tokens, so a palette change lands in
 * app/globals.css alone — no component hard-codes a colour.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md text-sm font-medium',
    'transition-[background-color,border-color,color,box-shadow] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    // Icons inside buttons should never be resized by the caller.
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-foreground shadow-xs hover:bg-brand-hover',
        secondary:
          'border-border bg-surface text-foreground shadow-xs border hover:bg-surface-muted hover:border-border-strong',
        ghost: 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        danger:
          'border-danger-border bg-surface text-danger border shadow-xs hover:bg-danger-subtle',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5',
        full: 'h-10 w-full px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

/**
 * For a navigation styled as a button. A `<Link>` wrapping a `<Button>` nests
 * a button inside a link, which is invalid HTML and announces two controls for
 * one action; put these classes on the link instead.
 */
export { buttonVariants };

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Renders a loading state and blocks interaction. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      // Frontend Architecture — users should always understand when the system is working.
      aria-busy={loading || undefined}
      {...props}
    >
      {/* The label stays put. Swapping it for "Working…" changed the button's
          accessible name mid-action and shifted the layout under the cursor. */}
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  );
}

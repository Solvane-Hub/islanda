import { cn } from '@/lib/utils/cn';

/**
 * Includes `ref`. React 19 passes refs as ordinary props to function
 * components, but `TextareaHTMLAttributes` does not declare one, so a caller
 * that legitimately needs the element — the Nova composer, to restore focus —
 * would fail to typecheck. `ComponentPropsWithRef` is the superset that says so.
 */
export type TextareaProps = React.ComponentPropsWithRef<'textarea'>;

/**
 * Extracted from two copy-pasted blocks in the intake flow. Mirrors Input's
 * treatment exactly so a form never mixes two field languages.
 */
export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'border-border-control bg-surface text-foreground placeholder:text-foreground-subtle',
        'w-full rounded-md border px-3 py-2.5 text-sm shadow-xs',
        'transition-colors outline-none',
        'hover:border-border-control-hover',
        'focus-visible:border-brand focus-visible:ring-brand/15 focus-visible:ring-[3px]',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/15',
        'disabled:bg-surface-muted disabled:cursor-not-allowed',
        'resize-y',
        className,
      )}
      {...props}
    />
  );
}

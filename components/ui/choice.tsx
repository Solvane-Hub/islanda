'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Structured answers.
 *
 * Intake currently asks five questions and answers two of them with open
 * textareas. Free text is the worst of both worlds here: it is more work for
 * the founder AND less useful to the system, because `business_stage` already
 * has a controlled vocabulary that a paragraph has to be mapped back onto.
 *
 * These primitives make the structured answer the default and keep text for
 * the one or two places it genuinely carries meaning.
 *
 * ## Native inputs, always
 *
 * Every control here is a real `<input>` inside a `<label>`, styled with
 * `has-[:checked]`. Not a div with `role="radio"` and a keydown handler.
 *
 * That buys arrow-key roving focus, form association, `:focus-visible`, screen
 * reader group semantics and browser autofill — for free and correctly —
 * rather than reimplementing them approximately. The pattern is already used
 * once in `intake/step-fields.tsx`; this generalises it instead of adding a
 * second way to do the same thing.
 */

/* ── Grid ─────────────────────────────────────────────────────────────── */

export function ChoiceGrid({
  label,
  description,
  columns = 2,
  children,
  className,
}: {
  /** The question. Rendered as the group's accessible name. */
  label: string;
  /**
   * Why Islanda is asking.
   *
   * Optional in the type and expected in practice. A founder handing over
   * business facts is owed a reason, and "this helps Islanda narrow down which
   * requirements may apply" is a better answer than a tooltip.
   */
  description?: string;
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-4', className)}>
      <legend className="flex flex-col gap-1.5">
        <span className="text-on-ink text-lg font-medium text-balance sm:text-xl">{label}</span>
        {description ? (
          <span className="text-on-ink-muted block max-w-prose text-sm text-pretty">
            {description}
          </span>
        ) : null}
      </legend>

      <div
        className={cn(
          'grid gap-2.5',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */

export function ChoiceCard({
  name,
  value,
  label,
  hint,
  type = 'radio',
  defaultChecked,
  className,
}: {
  name: string;
  value: string;
  label: string;
  /** One short line. Two would make this a paragraph with a radio beside it. */
  hint?: string;
  type?: 'radio' | 'checkbox';
  defaultChecked?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'group border-border-control bg-surface relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4',
        'transition-[background-color,border-color] duration-150',
        'hover:border-white/28 hover:bg-white/[0.06]',
        'has-[:checked]:border-bahama-turquoise/70 has-[:checked]:bg-bahama-turquoise/[0.08]',
        'has-[:focus-visible]:ring-bahama-turquoise/40 has-[:focus-visible]:ring-[3px]',
        className,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        // The native control is the source of truth for state, focus and
        // keyboard behaviour; it is visually replaced, never removed.
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center border border-white/40 transition-colors duration-150',
          type === 'radio' ? 'rounded-full' : 'rounded-[5px]',
          'peer-checked:border-bahama-turquoise peer-checked:bg-bahama-turquoise',
        )}
      >
        <span
          className={cn(
            'bg-abyss scale-0 transition-transform duration-150 peer-checked:scale-100',
            type === 'radio' ? 'size-1.5 rounded-full' : 'size-2 rounded-[2px]',
          )}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-on-ink block text-sm font-medium text-pretty">{label}</span>
        {hint ? (
          <span className="text-on-ink-muted mt-1 block text-xs text-pretty">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

/* ── Segmented control ────────────────────────────────────────────────── */

/**
 * For three to five short, mutually exclusive options that read as a scale —
 * team size, a range, a frequency. Radios again, laid out as one track.
 *
 * Not for anything needing a hint per option: at this density the hint has
 * nowhere to go, and that is the signal to use `ChoiceCard` instead.
 */
export function SegmentedControl({
  name,
  label,
  options,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <legend className="text-on-ink text-sm font-medium">{label}</legend>

      <div className="border-border-control bg-surface flex min-w-0 gap-1 rounded-xl border p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'group relative flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg px-2 py-2',
              'text-on-ink-muted text-xs font-medium transition-colors duration-150',
              'hover:text-on-ink hover:bg-white/[0.06]',
              'has-[:checked]:bg-bahama-turquoise has-[:checked]:text-abyss',
              'has-[:focus-visible]:ring-bahama-turquoise/40 has-[:focus-visible]:ring-[3px]',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="sr-only"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────── */

/**
 * A small, non-form affordance — a suggested research topic, a filter.
 *
 * A real `<button>`. Chips that are `<div>`s with click handlers are the most
 * common keyboard trap in interfaces that otherwise look finished.
 */
export function Chip({
  children,
  onClick,
  selected,
  tone = 'default',
  className,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  /**
   * `outline` marks a chip whose purpose is to demonstrate a boundary rather
   * than to succeed — the question Nova is expected to decline. Dashed, so it
   * reads as deliberately different before it is read at all.
   */
  tone?: 'default' | 'outline';
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'className'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs transition-colors duration-150',
        'text-on-ink-muted hover:text-on-ink border border-white/12 hover:border-white/28',
        tone === 'outline' && 'border-dashed',
        selected && 'border-bahama-turquoise/60 bg-bahama-turquoise/10 text-on-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

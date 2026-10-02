'use client';

import { useId, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NovaMark } from '@/components/ui/nova-mark';

/**
 * The composer.
 *
 * ## Not a chat input
 *
 * A messaging composer says "say something to me". This one says "hand this
 * question to the system to investigate", and the difference is carried by
 * three decisions:
 *
 *   • The mark sits INSIDE the field, on the left, the way an instrument's
 *     indicator sits on its face. It is not an avatar and there is no bubble.
 *   • The field grows with the question instead of scrolling inside a fixed
 *     box — a founder should see their whole question while writing it.
 *   • Submitting is called "Investigate", not "Send". Nothing is being sent to
 *     anyone.
 *
 * ## Focus
 *
 * Focus turns on `nova-beam` — one rotating conic gradient masked to the
 * border. It marks the boundary where a question leaves the founder and enters
 * the system, which is the one moment in this product worth marking. It is
 * applied ALONGSIDE the real focus ring, never instead of it: replacing a
 * focus indicator with a decorative animation would fail SC 2.4.7.
 *
 * ## Auto-grow without a layout thrash
 *
 * Height is set from `scrollHeight` on input. The alternative — a hidden
 * mirror element — is more code for the same result, and `field-sizing:
 * content` is not yet safe to rely on across the browsers this has to work in.
 */

const MAX_LENGTH = 500;
const MIN_ROWS_HEIGHT = 56;
const MAX_HEIGHT = 220;

export function NovaComposer({
  placeholder = 'Ask about a licence, a registration, or an obligation…',
  disabled,
  error,
  onChangeText,
  inputRef,
  className,
}: {
  placeholder?: string;
  disabled?: boolean;
  /** Field-level validation message from the server action. */
  error?: string;
  /** Called as the founder types, so the surface can enter `listening`. */
  onChangeText?: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(true);
  const formRef = useRef<HTMLFormElement | null>(null);
  const id = useId();

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_ROWS_HEIGHT), MAX_HEIGHT)}px`;
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="sr-only">
        What do you want to understand about your business?
      </label>

      <div
        className={cn(
          'nova-beam bg-glass-deep/88 shadow-glass rounded-2xl border transition-colors duration-150',
          focused ? 'border-white/28' : 'border-white/10',
        )}
        data-beam={focused ? 'on' : 'off'}
      >
        <div className="flex items-start gap-3 p-3 sm:gap-3.5 sm:p-4">
          {/*
            The indicator on the instrument's face. `idle` here regardless of
            request state — the surface-level mark carries activity, and two
            marks animating at once would compete.
          */}
          <span className="mt-2 shrink-0">
            <NovaMark state={focused && !empty ? 'listening' : 'idle'} size={20} label="Nova" />
          </span>

          <textarea
            ref={inputRef}
            id={id}
            name="question"
            required
            rows={1}
            maxLength={MAX_LENGTH}
            disabled={disabled}
            placeholder={placeholder}
            aria-describedby={error ? errorId : hintId}
            aria-invalid={error ? true : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onInput={(event) => {
              const element = event.currentTarget;
              grow(element);
              setEmpty(element.value.trim().length === 0);
              onChangeText?.(element.value);
            }}
            onKeyDown={(event) => {
              // Enter investigates, Shift+Enter breaks the line. The hint below
              // says so rather than assuming the convention is known.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                formRef.current = event.currentTarget.closest('form') as HTMLFormElement | null;
                formRef.current?.requestSubmit();
              }
            }}
            className={cn(
              'text-on-ink placeholder:text-on-glass-subtle min-w-0 flex-1 resize-none bg-transparent',
              'text-base leading-relaxed outline-none sm:text-lg',
              'disabled:opacity-60',
            )}
            style={{ height: MIN_ROWS_HEIGHT }}
          />

          <button
            type="submit"
            disabled={disabled}
            className={cn(
              'mt-1 grid size-9 shrink-0 place-items-center rounded-full transition-all duration-150',
              'focus-visible:ring-bahama-turquoise/50 focus-visible:ring-2 focus-visible:outline-none',
              empty || disabled
                ? 'text-on-glass-subtle cursor-not-allowed bg-white/8'
                : 'bg-bahama-turquoise text-abyss hover:brightness-110',
            )}
          >
            <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
            <span className="sr-only">Investigate this question</span>
          </button>
        </div>
      </div>

      {error ? (
        <p id={errorId} className="text-danger px-1 text-xs">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-on-glass-subtle px-1 text-xs text-pretty">
          Press Enter to investigate, Shift + Enter for a new line. Nova quotes published sources
          and does not give legal advice.
        </p>
      )}
    </div>
  );
}

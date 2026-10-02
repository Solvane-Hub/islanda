'use client';

import { createContext, useContext, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { usePrefersReducedMotion } from '@/lib/design/motion';
import type { NovaState } from '@/components/ui/nova-mark';

/**
 * Nova's state, shared by every part of the surface that has to respond to it.
 *
 * ## Why a provider and not a prop
 *
 * The composer, the mark, the status line and the answer all react to the same
 * state, and they are not siblings. Threading a prop through would work and
 * would also mean that adding a fourth consumer requires editing three
 * components that do not care. More importantly it would let two parts of one
 * surface disagree — a mark that says `searching` above an answer that has
 * already arrived — which is exactly the kind of incoherence that makes an
 * interface feel unfinished.
 *
 * `shouldMove` is resolved ONCE here rather than per component. That idea is
 * from the receipt-printer experiment, and the reason is the same: if each
 * component reads `prefers-reduced-motion` independently, a mid-session change
 * can leave half a composition animating and half static, which is worse than
 * either.
 *
 * ## What this is not
 *
 * ⚠ Not conversation state. ADR-0017 stands: Nova holds no memory across
 *   turns, and nothing in this context survives a question. It carries the
 *   status of the request currently in flight and nothing else — no question
 *   text, no previous answer, no accumulated context. A future contributor
 *   reaching for "just put the last answer in here" should read this and stop.
 */

interface NovaStateValue {
  state: NovaState;
  /** False when the person has asked for reduced motion. */
  shouldMove: boolean;
}

const NovaStateContext = createContext<NovaStateValue | null>(null);

/**
 * Read the current Nova state.
 *
 * Returns a safe default outside a provider rather than throwing: a mark
 * rendered on its own — in the navigation, say — is a legitimate use, and
 * should show `idle` rather than crash the route.
 */
export function useNovaState(): NovaStateValue {
  return useContext(NovaStateContext) ?? { state: 'idle', shouldMove: true };
}

export function NovaStateProvider({
  state,
  children,
  className,
  ...rest
}: {
  state: NovaState;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'>) {
  const reduced = usePrefersReducedMotion();

  const value = useMemo<NovaStateValue>(() => ({ state, shouldMove: !reduced }), [state, reduced]);

  return (
    <NovaStateContext.Provider value={value}>
      {/*
        `data-nova-state` on the wrapper drives every descendant through CSS
        attribute selectors, so a state change is one attribute write rather
        than a re-render of everything that cares. It is also inspectable: the
        current system state is visible in devtools without opening React.
      */}
      <div data-nova-state={state} className={cn('contents', className)} {...rest}>
        {children}
      </div>
    </NovaStateContext.Provider>
  );
}

/**
 * The status line beside the mark.
 *
 * ⚠ This is the element that actually carries the state to assistive
 *   technology. `aria-live="polite"` announces each transition without
 *   interrupting, and the wording is plain system status — "searching the
 *   published sources", never "thinking" or "considering", which would
 *   describe deliberation this system does not do.
 *
 *   The mark itself is decorative next to this. If the two ever disagree, this
 *   one is right.
 */
export function NovaStatusLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p role="status" aria-live="polite" className={cn('text-on-ink-muted text-xs', className)}>
      {children}
    </p>
  );
}

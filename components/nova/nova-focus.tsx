'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * The claim ↔ evidence relationship, made navigable.
 *
 * ## What this is
 *
 * A founder reading a finding should be able to see, without clicking through
 * anything, which sources support it — and looking at a source should show
 * which finding rests on it. That relationship already exists perfectly in the
 * data: a `NovaClaimView` carries citations, each with a `chunkId`, and the
 * chunk ids are the same identities the retrieval run returned.
 *
 * This context is the smallest thing that makes that relationship visible: one
 * focused chunk id, published to everything that might want to highlight.
 *
 * ## Why not a graph visualisation
 *
 * Because a force-directed graph of nine nodes is a toy, and of nine hundred is
 * unreadable. The relationship worth showing is local — this finding, these
 * sources — and it is better shown by the two things lighting up together than
 * by a separate diagram the founder has to map back onto the answer.
 *
 * ## ⚠ Not state, not memory
 *
 * `focusedChunk` is a pointer at something already on screen. It survives no
 * request, is never sent anywhere, and is cleared when the answer is replaced.
 * ADR-0017 is untouched: this is hover state, not context.
 *
 * ## Accessibility
 *
 * Driven by focus as well as hover, so a keyboard user gets the same
 * relationship a mouse user does. The highlight is decorative — every finding
 * already names its own sources in text — so nothing is lost when it is not
 * perceived.
 */

interface NovaFocusValue {
  /** `chunk_id` currently under the pointer or keyboard focus. */
  focusedChunk: string | null;
  /** Chunk ids belonging to the focused finding, so its sources light up too. */
  relatedChunks: readonly string[];
  focus: (chunkId: string | null, related?: readonly string[]) => void;
}

const NovaFocusContext = createContext<NovaFocusValue | null>(null);

const EMPTY: readonly string[] = [];

/** Safe outside a provider: nothing is focused, and `focus` is a no-op. */
export function useNovaFocus(): NovaFocusValue {
  return (
    useContext(NovaFocusContext) ?? {
      focusedChunk: null,
      relatedChunks: EMPTY,
      focus: () => {},
    }
  );
}

export function NovaFocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ chunk: string | null; related: readonly string[] }>({
    chunk: null,
    related: EMPTY,
  });

  const focus = useCallback((chunkId: string | null, related: readonly string[] = EMPTY) => {
    setState({ chunk: chunkId, related });
  }, []);

  const value = useMemo<NovaFocusValue>(
    () => ({ focusedChunk: state.chunk, relatedChunks: state.related, focus }),
    [state.chunk, state.related, focus],
  );

  return <NovaFocusContext.Provider value={value}>{children}</NovaFocusContext.Provider>;
}

/**
 * Whether a chunk should render as related to whatever currently has focus.
 *
 * Returns false when nothing is focused, so the resting state is "everything
 * equal" rather than "everything dimmed" — an interface that dims itself until
 * you point at something is exhausting to read.
 */
export function useIsRelated(chunkId: string | null | undefined): boolean {
  const { focusedChunk, relatedChunks } = useNovaFocus();
  if (!chunkId || !focusedChunk) return false;
  return chunkId === focusedChunk || relatedChunks.includes(chunkId);
}

/** True when something is focused, so surfaces can recede rather than compete. */
export function useHasFocus(): boolean {
  return useNovaFocus().focusedChunk !== null;
}

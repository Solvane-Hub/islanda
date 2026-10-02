'use client';

import { useEffect, useState } from 'react';
import { NovaMark, type NovaState } from '@/components/ui/nova-mark';
import { NovaStatusLine } from '@/components/nova/nova-state';
import type { NovaAnswerView } from '@/types/nova';

/**
 * Nova's activity, while a question is in flight and after it lands.
 *
 * ## ⚠ What is real here, and what is presentation
 *
 * This distinction is the most important thing in this file, so it is stated
 * before anything else.
 *
 * **REAL — observed from the system:**
 *   • that a request is in flight at all (`pending` from `useActionState`)
 *   • the outcome when it settles (`answered` / `no_matching_evidence` /
 *     `needs_clarification` / `no_published_knowledge`)
 *   • whether every claim's current legal position was established
 *   • whether anything was left unresolved
 *   • every number shown ANYWHERE after the answer arrives
 *
 * **PRESENTATION — paced on the client:**
 *   • the order and timing of `searching → evaluating → composing`
 *
 * `askNovaAction` is a single server action that returns a completed result.
 * There is no stream, so the intermediate phases are NOT observed events. What
 * makes showing them honest is that the pipeline genuinely performs these
 * stages, in this order, on every request — `retrieveNovaEvidence` runs
 * deterministic filters and ranking, then `reasonExtractively` selects passages
 * and builds the envelope, then the citation gate runs. The phases describe
 * work that happens; they do not claim to observe it finishing.
 *
 * What that licenses is limited, and the limit is absolute: **no phase may
 * assert a fact.** "Checking published sources" describes an activity. "12
 * sources found" would be a measurement, and we have not taken one. Every
 * count in this product appears only after the result is in hand.
 *
 * If we later want the phases to be real, that means streaming from the server
 * action — a genuine architecture change, and one to propose rather than fake.
 */

/**
 * How long each presentational phase holds.
 *
 * Deliberately not tuned to "feel like work is happening". A fast answer should
 * look fast: if the request settles during `searching`, the interface jumps
 * straight to the result rather than playing out the remaining phases. Padding
 * a response to make a system look busy is a small lie that costs the same
 * trust as a large one.
 */
const PHASE_HOLD_MS = 620;

const PHASE_SEQUENCE = ['searching', 'connecting', 'composing'] as const;

/**
 * Status copy.
 *
 * ⚠ Every line describes SYSTEM ACTIVITY. None describes cognition. Nova
 *   selects and quotes passages from a published corpus — it does not think,
 *   consider or decide, and copy implying otherwise would describe a system we
 *   deliberately did not build. A test asserts this.
 *
 * The three phases name work the pipeline genuinely performs, in order —
 * retrieval, then the deterministic filtering/ranking that draws the retrieved
 * passages together, then extraction. `connecting` describes that middle stage
 * and mirrors the presence gathering the field; it asserts no count and no legal
 * relationship (the constellation only ever links passages from one document).
 */
const PHASE_COPY: Record<(typeof PHASE_SEQUENCE)[number], string> = {
  searching: 'Searching the published sources for your jurisdiction…',
  connecting: 'Drawing the retrieved passages together…',
  composing: 'Assembling the answer from what was found…',
};

/**
 * Derive the settled state from the actual result.
 *
 * ⚠ Read only from data the service produced. `limited` in particular is not a
 *   judgement about answer quality — it is the presence of something Nova
 *   explicitly could not establish, which the service already recorded in
 *   `unresolved[]` or in a claim's `currentApplicabilityEstablished`.
 */
export function settledNovaState(answer: NovaAnswerView): NovaState {
  if (answer.outcome !== 'answered') return 'refused';

  const everythingEstablished = answer.claims.every((c) => c.currentApplicabilityEstablished);
  if (!everythingEstablished || answer.unresolved.length > 0) return 'limited';

  return 'ready';
}

/**
 * The Nova state for the current moment.
 *
 * `pending` drives the presentational sequence; the settled result drives
 * everything after. The hook holds no history — when a new request starts, the
 * previous state is gone rather than accumulated (ADR-0017).
 */
export function useNovaActivity({
  pending,
  answer,
  composing,
}: {
  pending: boolean;
  answer: NovaAnswerView | null;
  /** True when the founder has typed something but not yet submitted. */
  composing: boolean;
}): { state: NovaState; status: string | null } {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!pending) return;

    /**
     * One timer per phase, scheduled up front.
     *
     * Two properties worth having over an interval. It STOPS at the last phase
     * rather than cycling — a looping indicator on a stalled request says
     * "still working" forever, which is a claim the client cannot support. And
     * the reset for a new request is the `setTimeout(…, 0)`, which keeps every
     * state write out of the effect body: a synchronous `setState` here would
     * cascade a render, and a single frame of the previous phase at the moment
     * a new request begins is not perceptible.
     */
    const timers = PHASE_SEQUENCE.map((_, index) =>
      setTimeout(() => setPhase(index), index * PHASE_HOLD_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [pending]);

  if (pending) {
    const current = PHASE_SEQUENCE[phase] ?? 'searching';
    return { state: current, status: PHASE_COPY[current] };
  }

  if (answer) return { state: settledNovaState(answer), status: null };

  return { state: composing ? 'listening' : 'idle', status: null };
}

/**
 * The mark and its status line.
 *
 * The mark is decorative next to the status line: `NovaStatusLine` carries an
 * `aria-live` region, and that is what actually reaches a screen reader. If
 * the two ever disagree, the words are right.
 */
export function NovaActivity({
  state,
  status,
  size = 48,
  className,
}: {
  state: NovaState;
  status: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3.5">
        <NovaMark state={state} size={size} />
        {status ? <NovaStatusLine>{status}</NovaStatusLine> : null}
      </div>
    </div>
  );
}

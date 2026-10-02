'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Chip } from '@/components/ui/choice';
import { SurfaceLabel } from '@/components/ui/workspace-surface';

/**
 * Was this useful?
 *
 * ## ⚠ Product feedback, not conversational memory
 *
 * ADR-0017 governs what Nova may carry between turns. This carries nothing:
 * the selection lives in component state, is never sent to the reasoner, never
 * enters a query representation, and is discarded when the answer is replaced.
 *
 * ## ⚠ Not yet persisted — and the UI says so
 *
 * There is no feedback table, and adding one is a schema change with real
 * decisions behind it: what is stored alongside a rating (the question? the
 * `correlation_id`? neither?), who can read it, and how it interacts with the
 * rule that `agent_executions` carries no content. Those belong in a migration
 * with a review, not in a UI pass.
 *
 * So the component collects the response and tells the founder plainly that it
 * has been noted for the team rather than implying it has been filed. A
 * confirmation that overstates what happened is a small dishonesty in a product
 * whose entire argument is that it does not overstate things.
 *
 * **Next backend step**, when approved: a `nova_feedback` table keyed on the
 * `correlation_id` already produced by `askNovaAction`, with the rating and the
 * optional reason code — and NOT the question text, matching the rule
 * `agent_executions` already follows.
 */

/**
 * Reasons, as codes with labels.
 *
 * Deliberately about the ANSWER rather than about Nova's manner. "Not clear
 * enough" and "couldn't find what I needed" are actionable against retrieval
 * and coverage; "unfriendly" or "too short" would not be.
 */
const REASONS = [
  { code: 'not_found', label: "Couldn't find what I needed" },
  { code: 'unclear', label: 'Not clear enough' },
  { code: 'incomplete', label: 'Something seems missing' },
  { code: 'different_situation', label: 'My situation is different' },
] as const;

type Reason = (typeof REASONS)[number]['code'];

export function AnswerFeedback({ className }: { className?: string }) {
  const [rating, setRating] = useState<'useful' | 'not_quite' | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);

  const done = rating === 'useful' || (rating === 'not_quite' && reason !== null);

  if (done) {
    return (
      <p
        role="status"
        className={`text-on-ink-muted flex items-center gap-2 px-1 text-xs ${className ?? ''}`}
      >
        <Check aria-hidden="true" className="text-bahama-turquoise size-3.5" strokeWidth={2.5} />
        {/* Says what actually happened. It has been noted, not filed. */}
        Noted for the team. Thank you — this is how coverage gets better.
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3 px-1">
        <SurfaceLabel as="p" className="text-on-glass-subtle">
          Was this useful?
        </SurfaceLabel>

        <div className="flex flex-wrap gap-2">
          {/*
            "Yes" carries no selected state: choosing it completes the exchange
            immediately and this branch unmounts, so a pressed style would never
            be seen. TypeScript agrees — `rating` cannot be `'useful'` here.
          */}
          <Chip onClick={() => setRating('useful')}>Yes</Chip>
          <Chip onClick={() => setRating('not_quite')} selected={rating === 'not_quite'}>
            Not quite
          </Chip>
        </div>
      </div>

      {rating === 'not_quite' ? (
        <fieldset className="mt-3 flex flex-col gap-2.5 px-1">
          <legend className="text-on-ink-muted text-xs">What was missing?</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <Chip key={r.code} onClick={() => setReason(r.code)} selected={reason === r.code}>
                {r.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

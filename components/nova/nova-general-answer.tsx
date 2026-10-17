import { AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { EpistemicBadge } from '@/components/ui/epistemic-badge';
import { GENERAL_ANSWER_NOTICE, generalUnavailableCopy } from '@/lib/nova/general-answer';
import type { NovaGeneralAnswerView } from '@/types/nova';

/**
 * A general (non-regulatory) Nova answer.
 *
 * Deliberately NOT `NovaAnswerPanel`. That panel renders quoted passages with
 * citations; this answer has neither, and borrowing its layout would let model
 * output borrow the authority of a quotation. Instead: the answer, a permanent
 * notice that it is general guidance and not from cited sources, then
 * suggestions, what Nova does not know, the business context it used (each
 * with its epistemic type), and follow-ups that each re-run routing from
 * scratch.
 *
 * Server-renderable: it holds no state. `onContinue` comes from the console.
 */
export function NovaGeneralAnswer({
  answer,
  onContinue,
}: {
  answer: NovaGeneralAnswerView;
  onContinue: (question: string) => void;
}) {
  if (answer.status !== 'answered' || !answer.answer) {
    return (
      <WorkspaceSurface as="div" tone="inset" className="flex items-start gap-3 p-5">
        <AlertTriangle
          aria-hidden="true"
          className="text-champagne mt-0.5 size-4 shrink-0"
          strokeWidth={1.75}
        />
        <p className="text-on-ink-muted text-sm text-pretty" role="status">
          {generalUnavailableCopy(answer.reason ?? 'validation_failed')}
        </p>
      </WorkspaceSurface>
    );
  }

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-5 p-6 sm:p-8">
      <p className="sr-only">You asked: {answer.question}</p>

      <p className="text-on-ink text-base leading-relaxed text-pretty whitespace-pre-line sm:text-lg">
        {answer.answer}
      </p>

      <p className="text-on-glass-subtle flex items-start gap-2 text-xs text-pretty">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
        <span>
          {GENERAL_ANSWER_NOTICE}
          {answer.confidence ? ` · ${answer.confidence} confidence` : ''}
        </span>
      </p>

      {answer.recommendations.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            Suggestions
          </SurfaceLabel>
          <ul className="flex flex-col gap-2.5">
            {answer.recommendations.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 text-sm">
                <span className="text-on-ink text-pretty">{r.text}</span>
                <EpistemicBadge type={r.basis} className="self-start" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.unknowns.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            What I don&apos;t know
          </SurfaceLabel>
          <ul className="text-on-ink-muted flex flex-col gap-1.5 text-sm">
            {answer.unknowns.map((u, i) => (
              <li key={i} className="text-pretty">
                {u}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.evidence.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            Business context used
          </SurfaceLabel>
          <ul className="flex flex-col gap-2">
            {answer.evidence.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-on-ink-muted min-w-0 truncate text-xs">{item.source}</span>
                <EpistemicBadge type={item.provenance} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.followUps.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/8 pt-4">
          {answer.followUps.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onContinue(f)}
              className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 text-left text-xs font-medium"
            >
              {f}
              <ArrowRight aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      ) : null}
    </WorkspaceSurface>
  );
}

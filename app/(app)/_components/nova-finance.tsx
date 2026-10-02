'use client';

import { useActionState, useRef } from 'react';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/choice';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { EpistemicBadge } from '@/components/ui/epistemic-badge';
import type { Result } from '@/lib/errors';
import type { EvidenceRef } from '@/lib/intelligence/types';
import { novaFinanceUnavailableCopy, type NovaFinanceView } from '@/lib/intelligence/nova-finance';
import { askNovaFinanceAction } from '../intelligence/actions';

/**
 * Nova Financial Intelligence — the conversational surface for a business's own
 * numbers. Answer first, evidence second, next step third. Deterministic answers
 * come straight from recorded/derived figures; reasoning answers pass through the
 * P5 gateway. It never fabricates: a missing cause is an honest unknown, and an
 * unavailable model is a calm degraded state.
 *
 * Not a chatbot: one question, one considered answer, no transcript.
 */

const STARTERS = [
  'How much revenue did I make?',
  'How did revenue change between periods?',
  'How is my business doing?',
  'Why did revenue change?',
  'What should I do to improve performance?',
] as const;

const SECTION_TITLES: Record<string, string> = {
  financial_metric: 'Financial records',
  calculation: 'Derived',
  goal: 'Goals',
  document: 'Documents',
};

function groupEvidence(
  evidence: readonly EvidenceRef[],
): { title: string; items: EvidenceRef[] }[] {
  const groups = new Map<string, EvidenceRef[]>();
  for (const e of evidence) {
    const list = groups.get(e.type) ?? [];
    list.push(e);
    groups.set(e.type, list);
  }
  return [...groups.entries()].map(([type, items]) => ({
    title: SECTION_TITLES[type] ?? type,
    items,
  }));
}

export function NovaFinance() {
  const [state, formAction, pending] = useActionState<Result<NovaFinanceView> | null, FormData>(
    askNovaFinanceAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const view = state?.ok ? state.data : null;
  const fieldError = state && !state.ok ? state.fieldErrors?.question?.[0] : undefined;
  const formError = state && !state.ok && !state.fieldErrors ? state : null;

  const ask = (question: string) => {
    if (!inputRef.current || !formRef.current) return;
    inputRef.current.value = question;
    formRef.current.requestSubmit();
  };

  const evidenceGroups = view ? groupEvidence(view.evidence) : [];
  const answerLabel = view?.llmCalled
    ? 'Nova reasoned over your records'
    : 'Answered from your records';

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <Sparkles aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
        <SurfaceLabel as="h2">Nova · business intelligence</SurfaceLabel>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <Textarea
          ref={inputRef}
          name="question"
          rows={2}
          disabled={pending}
          placeholder="Ask about your performance — “How is my business doing?”"
          aria-label="Ask Nova about your business"
          aria-invalid={Boolean(fieldError)}
        />
        {fieldError ? <p className="text-danger text-xs">{fieldError}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <ul className="flex min-w-0 flex-wrap gap-2">
            {STARTERS.slice(0, 3).map((s) => (
              <li key={s}>
                <Chip onClick={() => ask(s)} title={s}>
                  {s}
                </Chip>
              </li>
            ))}
          </ul>
          <Button type="submit" size="sm" loading={pending} className="shrink-0">
            Ask Nova
          </Button>
        </div>
      </form>

      {formError ? <Alert tone="error">{formError.message}</Alert> : null}

      {view ? (
        view.status === 'unavailable' ? (
          <WorkspaceSurface as="div" tone="inset" className="flex items-start gap-3 p-5">
            <AlertTriangle
              aria-hidden="true"
              className="text-champagne mt-0.5 size-4 shrink-0"
              strokeWidth={1.75}
            />
            <p className="text-on-ink-muted text-sm text-pretty">
              {novaFinanceUnavailableCopy(view.reason ?? 'unrecognized')}
            </p>
          </WorkspaceSurface>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:items-start">
            {/* ── Answer (main) ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4" role="status" aria-live="polite">
              <p className="sr-only">You asked: {view.question}</p>
              <p className="text-on-ink text-base leading-relaxed text-pretty sm:text-lg">
                {view.answer}
              </p>
              <span className="text-2xs text-on-glass-subtle tracking-[0.08em] uppercase">
                {answerLabel}
                {view.confidence ? ` · ${view.confidence} confidence` : ''}
              </span>

              {view.recommendations.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
                  <SurfaceLabel as="p" className="text-on-glass-subtle">
                    Suggestions
                  </SurfaceLabel>
                  <ul className="flex flex-col gap-2.5">
                    {view.recommendations.map((r, i) => (
                      <li key={i} className="flex flex-col gap-1 text-sm">
                        <span className="text-on-ink text-pretty">{r.text}</span>
                        <EpistemicBadge type={r.basis} className="self-start" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {view.unknowns.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
                  <SurfaceLabel as="p" className="text-on-glass-subtle">
                    What I don&apos;t know yet
                  </SurfaceLabel>
                  <ul className="text-on-ink-muted flex flex-col gap-1.5 text-sm">
                    {view.unknowns.map((u, i) => (
                      <li key={i} className="text-pretty">
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {view.followUps.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-white/8 pt-4">
                  {view.followUps.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => ask(f)}
                      className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 text-xs font-medium"
                    >
                      {f}
                      <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ── Evidence rail (quiet, aside) ──────────────────────────── */}
            {evidenceGroups.length > 0 ? (
              <WorkspaceSurface as="section" tone="inset" className="flex flex-col gap-4 p-5">
                <SurfaceLabel as="h3" className="text-on-glass-subtle">
                  Evidence
                </SurfaceLabel>
                {evidenceGroups.map((group) => (
                  <div key={group.title} className="flex flex-col gap-2">
                    <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                      {group.title}
                    </span>
                    <ul className="flex flex-col gap-2">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2">
                          <span className="text-on-ink-muted min-w-0 truncate text-xs">
                            {item.source}
                          </span>
                          <EpistemicBadge type={item.provenance} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-on-glass-subtle text-2xs text-pretty">
                  Nova only cites evidence it was given. Nothing here is invented.
                </p>
              </WorkspaceSurface>
            ) : null}
          </div>
        )
      ) : null}
    </WorkspaceSurface>
  );
}

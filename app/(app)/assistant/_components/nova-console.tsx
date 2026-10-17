'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Chip } from '@/components/ui/choice';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import { NovaAnswerPanel } from '@/components/ui/nova-answer';
import { useNovaActivity } from '@/components/nova/nova-activity';
import { NovaComposer } from '@/components/nova/nova-composer';
import { NovaLanding } from '@/components/nova/nova-landing';
import { NovaVideo } from '@/components/nova/nova-video';
import { NovaStateProvider, NovaStatusLine } from '@/components/nova/nova-state';
import { NovaThread } from '@/components/nova/nova-thread';
import { NovaVoiceToggle } from '@/components/nova/nova-voice-toggle';
import { AnswerFeedback } from '@/components/nova/answer-feedback';
import { appendInvestigation, priorEntries, type NovaThread as Thread } from '@/lib/nova/thread';
import { usePrefersReducedMotion } from '@/lib/design/motion';
import { useVoicePreference } from '@/lib/nova/voice-preference';
import { useNovaSpeech } from '@/lib/nova/use-nova-speech';
import { useNovaAnswerVoice } from '@/lib/nova/use-nova-answer-voice';
import type { Result } from '@/lib/errors';
import type { NovaResponseView } from '@/types/nova';
import { NovaGeneralAnswer } from '@/components/nova/nova-general-answer';
import { routeNovaQuestion } from '@/lib/nova/routing';
import type { PublishedSourceSummary } from '@/lib/knowledge/source-display';
import { askNovaAction } from '../actions';

/**
 * The Nova workspace.
 *
 * ## An investigation, not a conversation
 *
 * There is no transcript. A running conversation would imply Nova carries
 * memory across turns, and it does not — each answer is an independent
 * retrieval run against the published sources (ADR-0017: "Conversation is
 * never evidence"). What replaces it is the **investigation thread**: the
 * questions asked in this tab stay visible as a record of work, each collapsed
 * to its question and its counts, each re-runnable.
 *
 * ## The mental model
 *
 *     ASK  →  INVESTIGATE  →  UNDERSTAND  →  FOLLOW THE NEXT THREAD
 *
 * The composer says "Investigate", the presence gathers and converges rather
 * than "replying", the result is laid out as a research finding with its
 * evidence attached, and Nova closes by naming a document this answer cites and
 * asking whether to trace it — an investigator following a lead, not a chatbot.
 *
 * ## Nova's presence, and the hierarchy shift
 *
 * The physical presence (`NovaPresence`) is the centerpiece WHILE Nova works —
 * gathering particles, connecting them, converging. Once an answer settles, the
 * presence contracts to a small instrument and the EVIDENCE becomes the dominant
 * layer. That deliberate shift — "watch intelligence work" → "here is what the
 * evidence establishes" — is the whole point, and it is why the presence is
 * large before an answer and compact after one.
 *
 * ## Voice
 *
 * Optional, default OFF, owned here because the console is what decides whether
 * to REQUEST audio when an answer lands. Speech is server-side (`/api/nova/speak`
 * → Fish Audio); the key never reaches the browser. When enabled, Nova speaks
 * the meaningful result once per answer, and the presence reacts to that audio.
 *
 * Client Component because it owns form state, composer state, the activity
 * sequence, the voice preference and the audio graph. It makes no data-access
 * call of its own; everything arrives as a plain value from the server action.
 */

/**
 * Example questions, chosen by asking them against the published Bahamas pack
 * (VAT Act and amendments, Data Protection Acts) on 2026-10-16: each returns
 * quoted passages. The previous set asked about licences, business
 * registration and annual returns, which that pack does not cover, so every
 * example a newcomer tapped ended in "nothing found".
 */
const STARTING_POINTS = [
  'When do I need to register for VAT?',
  'What records am I required to keep?',
] as const;

/**
 * A question the published sources do NOT answer — shows the refusal. The
 * previous example (the VAT rate) does retrieve VAT Act passages, so it no
 * longer demonstrated a refusal.
 */
const BOUNDARY_EXAMPLE = 'What licence do I need to sell prepared food?';

export function NovaConsole({
  businessName,
  knowledgeLine,
  businessContextLine = null,
  initialQuestion,
  knowledgePublished = true,
  sources = [],
}: {
  businessName: string;
  knowledgeLine: string | null;
  /**
   * A subtle line acknowledging the business context Nova now holds (§10/§11).
   * Computed by the page from the Business Object; null when there is too little.
   */
  businessContextLine?: string | null;
  /**
   * A question prefilled from a contextual "Ask Nova" elsewhere (e.g. a licence
   * goal). It fills the composer on first load; it is never auto-submitted.
   */
  initialQuestion?: string;
  /**
   * Whether a Knowledge Pack is published for this business's jurisdiction.
   *
   * Nova is ALWAYS rendered — the absence of published evidence is a Nova state
   * (NO_EVIDENCE), not a different page. When false, the presence rests in its
   * dispersed `refused` state and the composer explains there is nothing
   * published to investigate yet, rather than inviting a question we already
   * know cannot be grounded.
   */
  knowledgePublished?: boolean;
  /** The documents in the published pack, so the landing can show what Nova searches. */
  sources?: readonly PublishedSourceSummary[];
}) {
  const [state, formAction, pending] = useActionState<Result<NovaResponseView> | null, FormData>(
    askNovaAction,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<Thread>([]);
  const [lastRecorded, setLastRecorded] = useState<string | null>(null);

  const answer = state?.ok ? state.data : null;
  const activity = useNovaActivity({
    pending,
    answer,
    composing: draft.trim().length > 0,
    // Same pure router the server runs, so the in-flight copy names the work
    // actually happening. It selects status copy only — never the answer path.
    route: routeNovaQuestion(draft),
  });

  // ── Voice ──────────────────────────────────────────────────────────────
  const reducedMotion = usePrefersReducedMotion();
  const shouldMove = !reducedMotion;
  const voice = useVoicePreference();
  const speech = useNovaSpeech();

  /**
   * The state the PRESENCE renders. While Nova is speaking, the body reacts to
   * its own audio; before any question, with no published pack, it rests in the
   * dispersed NO_EVIDENCE (`refused`) state; otherwise it follows the
   * investigation state.
   */
  const atRestNoEvidence = !knowledgePublished && !state && !pending;
  const presenceState = speech.speaking
    ? 'speaking'
    : atRestNoEvidence
      ? 'refused'
      : activity.state;

  /**
   * Speak the meaningful result — the orchestration lives in its own hook so its
   * guarantees (never request when off, speak once, never retroactively) are
   * tested directly. `controls` is memoised so the effect keys off the answer,
   * not the render.
   */
  const voiceControls = useMemo(
    () => ({ speak: speech.speak, stop: speech.stop }),
    [speech.speak, speech.stop],
  );
  useNovaAnswerVoice({ result: state, pending, enabled: voice.enabled, controls: voiceControls });

  const onToggleVoice = () => {
    const next = !voice.enabled;
    voice.setEnabled(next);
    if (!next) speech.stop();
  };

  // Move focus to the result once it lands.
  useEffect(() => {
    if (state && !pending) resultRef.current?.focus();
  }, [state, pending]);

  // Prefill the composer from a contextual "Ask Nova" (?q=). Fills and focuses;
  // never submits — the founder still decides to ask.
  useEffect(() => {
    if (initialQuestion && inputRef.current) {
      inputRef.current.value = initialQuestion;
      setDraft(initialQuestion);
      inputRef.current.focus();
    }
  }, [initialQuestion]);

  // Record the question AFTER it resolves (see the original design note).
  if (answer?.question && answer.question !== lastRecorded) {
    setLastRecorded(answer.question);
    setThread((current) => appendInvestigation(current, answer));
  }

  const investigate = (question: string) => {
    if (!inputRef.current || !formRef.current) return;
    inputRef.current.value = question;
    setDraft(question);
    formRef.current.requestSubmit();
  };

  const fieldError = state && !state.ok ? state.fieldErrors?.question?.[0] : undefined;
  const started = Boolean(state) || pending;
  const answered = Boolean(answer) && !pending;

  /**
   * NO_EVIDENCE at rest: no pack is published for this jurisdiction, so before
   * any question is asked the presence rests dispersed (`refused`) rather than
   * idle-and-inviting. This is the "absence is a state, not a page" rule.
   */
  const noEvidence = !knowledgePublished;

  const composer = (
    <form ref={formRef} action={formAction} className="flex max-w-3xl flex-col gap-4">
      <NovaComposer
        inputRef={inputRef}
        disabled={pending}
        {...(fieldError ? { error: fieldError } : {})}
        onChangeText={setDraft}
      />

      {!started && noEvidence ? (
        <Alert tone="info" title="No official documents for this country yet">
          Nova only answers from official documents it can quote. Islanda doesn&rsquo;t hold any for
          the country {businessName} operates in yet, so Nova has nothing to search here. When
          documents are added, Nova will quote them with a link to each source.
        </Alert>
      ) : null}

      {!started && !noEvidence ? (
        <div className="flex flex-col gap-3 px-1">
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            Try an example question
          </SurfaceLabel>

          <ul className="flex flex-wrap gap-2">
            {STARTING_POINTS.map((question) => (
              <li key={question}>
                <Chip onClick={() => investigate(question)}>{question}</Chip>
              </li>
            ))}
            <li>
              <Chip
                tone="outline"
                onClick={() => investigate(BOUNDARY_EXAMPLE)}
                title={BOUNDARY_EXAMPLE}
              >
                See what happens when Nova can&rsquo;t find an answer
              </Chip>
            </li>
          </ul>
        </div>
      ) : null}
    </form>
  );

  /** The persistent Nova control row: About, and the voice instrument. */
  const controlBar = (
    <div className="flex items-center justify-between gap-3 px-1">
      <Link
        href="/assistant/about"
        className="text-on-glass-subtle hover:text-on-ink inline-flex items-center gap-1.5 rounded-sm text-xs transition-colors duration-150"
      >
        <Info aria-hidden="true" className="size-3.5" strokeWidth={2} />
        About Nova
      </Link>

      <NovaVoiceToggle enabled={voice.enabled} onToggle={onToggleVoice} status={speech.status} />
    </div>
  );

  return (
    <NovaStateProvider state={presenceState}>
      <div className="flex flex-col gap-6 sm:gap-8">
        {controlBar}

        {!started ? (
          <NovaLanding
            businessName={businessName}
            knowledgeLine={knowledgeLine}
            sources={sources}
            contextLine={businessContextLine}
            hero={
              <NovaVideo
                state={presenceState}
                levelRef={speech.levelRef}
                shouldMove={shouldMove}
                label=""
                className="mx-auto aspect-video w-full max-w-[32rem] sm:max-w-[40rem] lg:max-w-[46rem]"
              />
            }
          >
            {composer}
          </NovaLanding>
        ) : (
          <>
            {/*
              While investigating, the presence is prominent and centred —
              "watch intelligence work". Once the answer settles it contracts to
              a small instrument beside the status, so EVIDENCE dominates the
              screen — "here is what the evidence establishes".
            */}
            {answered ? (
              <div className="flex items-center gap-3.5 px-1">
                <NovaVideo
                  state={presenceState}
                  levelRef={speech.levelRef}
                  shouldMove={shouldMove}
                  label=""
                  className="h-14 w-24 shrink-0 rounded-lg"
                />
                {speech.speaking ? (
                  <NovaStatusLine>Nova is speaking its answer.</NovaStatusLine>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 py-2">
                <NovaVideo
                  state={presenceState}
                  levelRef={speech.levelRef}
                  shouldMove={shouldMove}
                  label=""
                  className="mx-auto aspect-video w-full max-w-[28rem] sm:max-w-[36rem]"
                />
                {activity.status ? (
                  <NovaStatusLine className="max-w-md text-center">
                    {activity.status}
                  </NovaStatusLine>
                ) : null}
              </div>
            )}

            {composer}

            <div
              ref={resultRef}
              tabIndex={-1}
              className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {!pending && state && !state.ok ? (
                <Alert tone="error" title="Nova could not answer that">
                  {state.message}
                </Alert>
              ) : null}

              {!pending && answer ? (
                <div className="flex flex-col gap-5">
                  {answer.outcome === 'general' ? (
                    <NovaGeneralAnswer answer={answer} onContinue={investigate} />
                  ) : (
                    <NovaAnswerPanel answer={answer} onContinue={investigate} />
                  )}
                  <AnswerFeedback />
                </div>
              ) : null}
            </div>

            <NovaThread
              entries={priorEntries(thread)}
              onRerun={investigate}
              disabled={pending}
              className="max-w-3xl"
            />
          </>
        )}
      </div>
    </NovaStateProvider>
  );
}

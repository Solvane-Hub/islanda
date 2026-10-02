'use client';

import { useEffect, useRef } from 'react';
import type { Result } from '@/lib/errors';
import type { NovaAnswerView } from '@/types/nova';
import { speechForAnswer } from '@/lib/nova/speech';

/** The slice of the speech hook this orchestration needs. */
export interface AnswerVoiceControls {
  speak: (text: string) => void | Promise<void>;
  stop: () => void;
}

/**
 * Speak the meaningful result, once per answer, only when the voice is on.
 *
 * ## Why this is its own hook
 *
 * "Should Nova speak, and what, and when" is the one piece of the voice feature
 * with real branching, and it must hold three guarantees that are easy to break
 * by accident:
 *
 *   1. ⚠ NEVER request audio when the voice is off. This is the directive's
 *      hard rule — a disabled voice makes no network call at all.
 *   2. Speak an answer at most ONCE. A re-render must not re-speak; the result
 *      object's identity is the key, so a genuinely new investigation always
 *      speaks and a re-render never does.
 *   3. Don't retroactively narrate. An answer already on screen when the voice
 *      is switched on is marked consumed, so enabling the voice is silent until
 *      the next question — the demo enables it, then asks.
 *
 * Extracting it keeps the console thin and lets these guarantees be tested
 * directly, without standing up the server action and the whole surface.
 *
 * A new pending request also silences anything still being spoken.
 */
export function useNovaAnswerVoice({
  result,
  pending,
  enabled,
  controls,
}: {
  result: Result<NovaAnswerView> | null;
  pending: boolean;
  enabled: boolean;
  controls: AnswerVoiceControls;
}): void {
  const spokenForRef = useRef<Result<NovaAnswerView> | null>(null);

  // A new investigation silences any answer Nova is still speaking.
  useEffect(() => {
    if (pending) controls.stop();
  }, [pending, controls]);

  useEffect(() => {
    if (!result || !result.ok || pending) return;
    if (spokenForRef.current === result) return;
    // Mark consumed BEFORE the enabled check, so toggling the voice on later
    // never narrates an answer that is already on screen.
    spokenForRef.current = result;
    if (!enabled) return;
    const line = speechForAnswer(result.data);
    if (line) void controls.speak(line);
  }, [result, pending, enabled, controls]);
}

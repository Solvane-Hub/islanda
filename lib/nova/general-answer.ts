import type { NovaGeneralAnswerView, NovaGeneralUnavailableReason } from '@/types/nova';

/**
 * Founder-facing copy for Nova's general path. Pure; importable from
 * `components/` (which may not import `services/`).
 *
 * Every unavailable line is a calm degraded state, never an apology for a
 * guess and never a guess. Each points the founder at what still works: the
 * cited regulatory research does not depend on the model at all.
 */

const UNAVAILABLE_COPY: Record<NovaGeneralUnavailableReason, string> = {
  provider_not_configured:
    'Nova’s general reasoning isn’t switched on yet, so I can’t answer that kind of question right now. I can still research regulatory questions from published, cited sources.',
  provider_error:
    'Nova’s general reasoning is temporarily unavailable, so I can’t answer that right now. Try again shortly — regulatory research from published sources is unaffected.',
  validation_failed:
    'I couldn’t produce an answer I could stand behind for that, so I’m not going to guess. Try rephrasing the question.',
};

export function generalUnavailableCopy(reason: NovaGeneralUnavailableReason): string {
  return UNAVAILABLE_COPY[reason];
}

/** Shown with every general answer. A safety control, not a style choice. */
export const GENERAL_ANSWER_NOTICE =
  'General guidance, not from Islanda’s cited sources. It is not legal, tax or regulatory advice — ask Nova a regulatory question to see what the published sources say.';

/** `/api/nova/speak` rejects text over 600 characters. */
export const MAX_SPOKEN_CHARS = 600;

/**
 * Shorten text to the speak route's limit at a sentence boundary when possible.
 * Never rewords — only stops early. The full answer stays on screen.
 */
export function clampForSpeech(text: string, max = MAX_SPOKEN_CHARS): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (sentenceEnd > 0) return window.slice(0, sentenceEnd + 1);
  const space = window.lastIndexOf(' ');
  return space > 0 ? window.slice(0, space) : window;
}

/** The raw line Nova would speak for a general answer (before sanitising). */
export function generalSpokenText(answer: NovaGeneralAnswerView): string {
  if (answer.status === 'answered' && answer.answer) return answer.answer;
  return answer.reason ? generalUnavailableCopy(answer.reason) : '';
}

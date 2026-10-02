import type { NovaAnswerView } from '@/types/nova';
import { narrateAnswer } from '@/lib/nova/narration';

/**
 * What Nova SAYS out loud.
 *
 * ## The relationship to narration
 *
 * `narrateAnswer` already draws the line this product cannot cross: it describes
 * Nova's SEARCH and never interprets the law, and every noun in it comes from
 * the answer object (see `lib/nova/narration.ts`). This module is the spoken
 * projection of that — a short, calm line for the voice, not the full written
 * account.
 *
 * Speech is not the transcript. A founder reading the screen has the passages,
 * the citations and the constellation; the voice exists to mark the meaningful
 * moment — "I searched, here is what I found, here is what I could not
 * establish" — and then get out of the way. So this speaks the opener, the
 * lead, and the caveat when there is one, and nothing else. It does not read
 * the detail ("its exact words are below" refers to the screen), the list of
 * passages, or the follow-ups.
 *
 * ## ⚠ Never speak an identifier
 *
 * The one hard rule the directive adds on top of narration's: the voice must
 * never read a URL, a citation id, a chunk id, a database identifier or any
 * technical token. `narrateAnswer` never produces those, but `stripUnspeakable`
 * is applied anyway as a structural guarantee rather than a trusted assumption —
 * it is the same belt-and-suspenders posture the citation gate takes, and it
 * also protects the `/api/nova/speak` route, which sanitises again server-side.
 *
 * Pure function. No I/O, no request, no dependency on anything but the answer.
 */

/**
 * Remove anything that must never be spoken.
 *
 * Conservative on purpose: it targets URLs and identifier-shaped tokens (chunk
 * ids like `zz-chunk-food-s3`, UUIDs, long hex/alnum runs) and leaves ordinary
 * prose — including provision references like "section 3" — untouched. It is a
 * safety net, not a paraphraser: it never rewords, only excises.
 */
export function stripUnspeakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '') // URLs
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '') // UUIDs
    .replace(/\b[a-z]{2,}-[a-z0-9]+(?:-[a-z0-9]+)+\b/gi, '') // slug/chunk ids: two+ hyphen groups
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/**
 * The line Nova speaks for a settled answer.
 *
 * Empty string when there is nothing meaningful to say — the caller treats an
 * empty result as "do not request audio", so a degenerate answer never triggers
 * a TTS call.
 */
export function speechForAnswer(answer: NovaAnswerView): string {
  const narration = narrateAnswer(answer);

  // opener + lead carry "I looked, here is what I found / did not find".
  // caveat carries "here is what I could not establish" — the trust moment, and
  // worth speaking. Everything else belongs to the screen.
  const parts = [narration.opener, narration.lead, narration.caveat].filter(
    (part): part is string => Boolean(part),
  );

  const spoken = stripUnspeakable(parts.join(' '));
  return spoken;
}

'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { NovaSpeechStatus } from '@/lib/nova/use-nova-speech';

/**
 * Nova's voice control.
 *
 * ## Why it lives here and looks like this
 *
 * The directive is explicit: the voice control belongs INSIDE Nova, not buried
 * in Settings, and it should read as a subtle Nova instrument rather than a
 * generic settings checkbox. So it is a small pill that sits in the Nova header,
 * in the workspace's own turquoise-on-water language, and it states its status
 * in a word — Voice off / Voice on / Speaking — rather than as a bare tick.
 *
 * ## Controlled, on purpose
 *
 * The preference itself lives in `useVoicePreference` (localStorage, default
 * OFF), and the console owns it — because the console is what decides whether to
 * REQUEST audio when an answer lands. This component only renders the current
 * state and reports intent, which keeps "should Nova speak?" in one place and
 * makes both the toggle and that decision testable in isolation.
 *
 * ## States (the directive's four)
 *
 *   • Voice off  — default; `enabled=false`.
 *   • Voice on   — `enabled=true`, nothing playing.
 *   • Speaking   — `enabled=true`, audio playing; a live dot, and pressing mutes.
 *   • Unavailable— the server has no Fish voice configured (503); shown disabled
 *     and quiet rather than as an error, because a missing voice is not a fault.
 */
export function NovaVoiceToggle({
  enabled,
  onToggle,
  status,
  className,
}: {
  enabled: boolean;
  /** Toggle the preference. When turning off mid-speech, the console also stops. */
  onToggle: () => void;
  /** The live playback status, so the control can show "Speaking" and mute it. */
  status: NovaSpeechStatus;
  className?: string;
}) {
  const speaking = enabled && status === 'speaking';
  const unavailable = status === 'unavailable';

  const labelText = unavailable
    ? 'Voice unavailable'
    : speaking
      ? 'Speaking'
      : enabled
        ? 'Voice on'
        : 'Voice off';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={unavailable}
      aria-pressed={enabled}
      aria-label={
        speaking
          ? 'Nova is speaking — press to mute'
          : enabled
            ? 'Turn Nova voice off'
            : 'Turn Nova voice on'
      }
      title={
        unavailable
          ? 'Nova voice is not configured for this environment'
          : 'Nova can speak the meaningful result aloud'
      }
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
        'focus-visible:ring-bahama-turquoise/60 focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        enabled && !unavailable
          ? 'border-bahama-turquoise/50 text-bahama-turquoise hover:bg-white/5'
          : 'text-on-glass-subtle hover:text-on-ink border-white/12 hover:border-white/25',
        className,
      )}
    >
      <span aria-hidden="true" className="relative inline-flex size-4 items-center justify-center">
        {enabled && !unavailable ? (
          <Volume2 className="size-4" strokeWidth={2} />
        ) : (
          <VolumeX className="size-4" strokeWidth={2} />
        )}
        {speaking ? (
          <span className="bg-bahama-turquoise absolute -top-0.5 -right-0.5 size-1.5 animate-pulse rounded-full" />
        ) : null}
      </span>
      {labelText}
    </button>
  );
}

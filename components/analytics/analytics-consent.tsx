'use client';

import { useState, useSyncExternalStore } from 'react';
import { getConsent, privacySignalPresent, setConsent } from '@/lib/analytics/client';

/**
 * The visitor's choice about a persistent analytics identifier.
 *
 * Without a choice (or after "No thanks"), Islanda still counts visits — but
 * with a keyed hash that rotates every day on the server, and nothing stored
 * on the device. Choosing "Allow" adds a random first-party id so returning
 * visits can be recognised. No third party is involved either way.
 *
 * Not shown when the browser sends Global Privacy Control or Do Not Track:
 * that signal is already the answer.
 */
function subscribe(): () => void {
  return () => undefined;
}

export function AnalyticsConsent() {
  const initial = useSyncExternalStore(
    subscribe,
    () => (privacySignalPresent() ? 'denied' : getConsent()),
    () => 'pending' as const,
  );
  const [answered, setAnswered] = useState(false);

  if (initial !== null || answered) return null;

  function choose(choice: 'granted' | 'denied') {
    setConsent(choice);
    setAnswered(true);
  }

  return (
    <section
      aria-label="Analytics choice"
      className="bg-abyss/95 fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-white/15 px-5 py-4 text-left shadow-2xl backdrop-blur-xl sm:bottom-5"
    >
      <p className="text-on-ink text-sm text-pretty">
        Islanda counts visits to this site with its own privacy-friendly analytics — no advertising,
        no third parties. May we also remember this browser so we can tell new visits from returning
        ones?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose('granted')}
          className="text-ink inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => choose('denied')}
          className="text-on-ink inline-flex h-10 items-center rounded-xl border border-white/25 px-4 text-sm font-medium hover:bg-white/[0.06]"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}

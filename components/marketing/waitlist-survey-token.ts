'use client';

import { useSyncExternalStore } from 'react';

/**
 * Keeps the one-time survey token for the current tab so a refresh after
 * signing up still offers the optional questions instead of a blank form.
 *
 * sessionStorage, not localStorage: the token is a write capability for one
 * signup's answers and should not outlive the tab. Storage can be missing or
 * throw (private mode, blocked site data), so every access is guarded and the
 * flow still works for the visit in progress — only the refresh restore is lost.
 */

const KEY = 'islanda.waitlist.survey-token';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function storeSurveyToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — nothing to restore after a refresh, which is fine.
  }
  for (const listener of listeners) listener();
}

/** The stored token, or null. Always null during server render and hydration. */
export function useStoredSurveyToken(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

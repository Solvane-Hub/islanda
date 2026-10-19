'use client';

import { useSyncExternalStore } from 'react';

/**
 * Keeps the questionnaire token on this device so the visitor can come back
 * and finish or update their answers — after a refresh, or on a later visit
 * within 30 days in the same browser.
 *
 * The token is a write capability for ONE signup's questionnaire answers and
 * nothing else: it cannot read or change contact details, recruitment data or
 * anyone else's row. It expires after 30 days and is cleared on request.
 * Storage can be missing or throw (private mode, blocked site data), so every
 * access is guarded and the flow still works for the visit in progress.
 */

const KEY = 'islanda.waitlist.survey';
const LEGACY_SESSION_KEY = 'islanda.waitlist.survey-token';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredSurvey {
  token: string;
  /** True once the visitor submitted or skipped; the form then offers "update" instead. */
  finished: boolean;
  savedAt: number;
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: StoredSurvey | null = null;

function parse(raw: string | null): StoredSurvey | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSurvey>;
    if (typeof value.token !== 'string' || value.token.length < 32) return null;
    if (typeof value.savedAt !== 'number' || Date.now() - value.savedAt > TTL_MS) return null;
    return { token: value.token, finished: value.finished === true, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

function read(): StoredSurvey | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
    if (!raw) {
      // A token stored by the previous version of this form (same tab).
      const legacy = window.sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (legacy) raw = JSON.stringify({ token: legacy, finished: false, savedAt: Date.now() });
    }
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function storeSurvey(value: { token: string; finished: boolean } | null): void {
  try {
    if (value) {
      window.localStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
    } else {
      window.localStorage.removeItem(KEY);
    }
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage unavailable — nothing to restore later, which is fine.
  }
  for (const listener of listeners) listener();
}

/** The stored questionnaire, or null. Always null during server render and hydration. */
export function useStoredSurvey(): StoredSurvey | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

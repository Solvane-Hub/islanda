'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether Nova speaks — a per-viewer preference.
 *
 * ## Defaults and persistence
 *
 * ⚠ Default OFF. A first-time founder must not have audio start on them; the
 *   voice is something they turn ON, deliberately, once. After that the choice
 *   persists in `localStorage` so it survives reloads and route changes, and it
 *   is read back as the source of truth — the demo can enable it once and it
 *   stays on.
 *
 * ## Why a tiny store and not `useState`
 *
 * The toggle, the presence and the answer orchestration all need the same
 * answer to "is the voice on?", and they are not siblings. A module-level store
 * read through `useSyncExternalStore` keeps every consumer in agreement within
 * the tab (a local subscriber set) and across tabs (the `storage` event),
 * without a provider to thread through the tree. It also renders correctly on
 * the server — `getServerSnapshot` returns the default, and the first client
 * read reconciles to whatever was stored.
 *
 * This stores a lightweight per-viewer convenience only. It is never sent
 * anywhere and never read back by the server, so `localStorage` is exactly the
 * right home for it; every access is wrapped so a private window or blocked
 * site-data setting degrades to the default rather than throwing.
 */

const STORAGE_KEY = 'islanda-nova-voice';
/** Pre-rename key. Read once as a fallback, then migrated forward — never written again. */
const LEGACY_STORAGE_KEY = 'foundryai-nova-voice';
const ON = 'on';
const OFF = 'off';

const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current !== null) return current === ON;
    // First read after the rename: carry a returning visitor's preference
    // forward so it isn't silently reset to the OFF default.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
      return legacy === ON;
    }
    return false;
  } catch {
    // Private mode, blocked site data, or a thumbnail context — treat as off.
    return false;
  }
}

function write(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? ON : OFF);
  } catch {
    // Non-fatal: the preference simply will not persist this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Cross-tab: another tab toggling the voice updates this one.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** The current preference, without subscribing. For non-React callers. */
export function isVoiceEnabled(): boolean {
  return read();
}

export interface VoicePreference {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

export function useVoicePreference(): VoicePreference {
  const enabled = useSyncExternalStore(
    subscribe,
    read,
    () => false, // server snapshot: default OFF
  );

  const setEnabled = useCallback((next: boolean) => write(next), []);
  const toggle = useCallback(() => write(!read()), []);

  return { enabled, setEnabled, toggle };
}

/** Exported for tests, so a spec can reset the store between cases. */
export const __voiceTesting = { STORAGE_KEY, read, write };

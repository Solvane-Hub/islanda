import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { __voiceTesting, isVoiceEnabled, useVoicePreference } from '@/lib/nova/voice-preference';

/**
 * The Nova voice preference.
 *
 * ⚠ The load-bearing property is the DEFAULT: a first-time founder must never
 *   have audio turned on for them. Everything else — persistence, toggling — is
 *   in service of that being a deliberate, remembered choice.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('Nova voice preference — default and persistence', () => {
  it('defaults OFF for a first-time viewer', () => {
    const { result } = renderHook(() => useVoicePreference());
    expect(result.current.enabled).toBe(false);
    expect(isVoiceEnabled()).toBe(false);
  });

  it('persists an enabled preference to localStorage', () => {
    const { result } = renderHook(() => useVoicePreference());
    act(() => result.current.setEnabled(true));

    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem(__voiceTesting.STORAGE_KEY)).toBe('on');
  });

  it('reads a stored preference back on a fresh mount', () => {
    window.localStorage.setItem(__voiceTesting.STORAGE_KEY, 'on');
    const { result } = renderHook(() => useVoicePreference());
    expect(result.current.enabled).toBe(true);
  });

  it('toggles both directions and persists each', () => {
    const { result } = renderHook(() => useVoicePreference());

    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem(__voiceTesting.STORAGE_KEY)).toBe('on');

    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem(__voiceTesting.STORAGE_KEY)).toBe('off');
  });

  it('treats any non-"on" stored value as off', () => {
    window.localStorage.setItem(__voiceTesting.STORAGE_KEY, 'garbage');
    const { result } = renderHook(() => useVoicePreference());
    expect(result.current.enabled).toBe(false);
  });
});

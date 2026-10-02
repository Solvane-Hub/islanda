'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Nova's voice, played in the browser and made audio-reactive.
 *
 * ## What it owns
 *
 * Everything to do with one spoken line: the network request to
 * `/api/nova/speak`, the `HTMLAudioElement` that plays the returned MP3, and the
 * Web Audio graph (`AudioContext → MediaElementSource → AnalyserNode`) that
 * measures the audio so Nova's body can respond to it.
 *
 * ## Why a ref for the level, not state
 *
 * The amplitude changes ~60 times a second. Pushing that through React state
 * would re-render every consumer on every frame. Instead the analyser writes a
 * smoothed 0–1 value into `levelRef`, and the presence canvas — which already
 * runs its own animation frame — reads it. Coarse transitions (`speaking`,
 * `status`) ARE state, because they change rarely and the whole surface reacts.
 *
 * ## Cleanup is the point
 *
 * A speech hook that leaks an `AudioContext` per answer will exhaust the
 * browser's context limit within a session and leave a rАF running after the
 * route unmounts. `teardown()` is the single place every resource is released —
 * the frame loop, the analyser graph, the audio element, and the object URL —
 * and it runs on stop, on the next `speak`, and on unmount. There is never more
 * than one audio graph alive.
 *
 * ## Graceful failure (the directive's contract)
 *
 *   • voice not configured on the server → 503 → `status: 'unavailable'`, silent.
 *   • provider failure / network / timeout → 502 → `status: 'error'`, silent.
 *   • autoplay blocked → caught → settles to idle rather than a broken player.
 *
 * Nothing here ever throws into the caller; a failed voice never breaks the
 * (fully functional) silent experience.
 */

export type NovaSpeechStatus = 'idle' | 'loading' | 'speaking' | 'error' | 'unavailable';

export interface NovaSpeech {
  /** Request and play a line. No-op if the text is empty. Safe to await. */
  speak: (text: string) => Promise<void>;
  /** Stop immediately and release every audio resource. */
  stop: () => void;
  /** True while audio is actually playing. */
  speaking: boolean;
  status: NovaSpeechStatus;
  /** Smoothed 0–1 amplitude, updated per frame while speaking. Read, don't set. */
  levelRef: React.RefObject<number>;
  /** False where the browser cannot play audio at all. */
  supported: boolean;
}

/** How fast the measured level eases toward the target. Higher = snappier. */
const LEVEL_SMOOTHING = 0.35;

export function useNovaSpeech(): NovaSpeech {
  const [status, setStatus] = useState<NovaSpeechStatus>('idle');
  const speaking = status === 'speaking';

  const levelRef = useRef<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  /** Guards against a stale request resolving after a newer one started. */
  const runRef = useRef(0);

  const supported = typeof window !== 'undefined' && typeof window.Audio === 'function';

  /** Release everything. Idempotent — safe to call from anywhere, any number of times. */
  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* already detached */
      }
      audio.src = '';
      audioRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        /* not connected */
      }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        /* not connected */
      }
      analyserRef.current = null;
    }
    if (ctxRef.current) {
      // close() returns a promise; we do not await it — the reference is dropped
      // and the browser reclaims the context.
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    levelRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1; // invalidate any in-flight request
    teardown();
    setStatus('idle');
  }, [teardown]);

  /** Start the per-frame amplitude measurement. Only runs while audio plays. */
  const startLevelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);

    const tick = () => {
      const node = analyserRef.current;
      if (!node) return;
      node.getByteTimeDomainData(buffer);

      // RMS around the 128 midpoint → perceived loudness, not a single sample.
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = (buffer[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);
      // Gentle gain so ordinary speech reaches a visible range, then clamp.
      const target = Math.min(1, rms * 2.6);
      levelRef.current += (target - levelRef.current) * LEVEL_SMOOTHING;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !supported) return;

      // Supersede any current playback/request.
      const run = runRef.current + 1;
      runRef.current = run;
      teardown();
      setStatus('loading');

      let response: Response;
      try {
        response = await fetch('/api/nova/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
      } catch {
        if (runRef.current === run) setStatus('error');
        return;
      }

      if (runRef.current !== run) return; // a newer request started

      if (!response.ok) {
        // 503 means the voice is not configured here — quietly unavailable, not
        // an error the founder should see.
        setStatus(response.status === 503 ? 'unavailable' : 'error');
        return;
      }

      let url: string;
      try {
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
      } catch {
        if (runRef.current === run) setStatus('error');
        return;
      }

      if (runRef.current !== run) {
        URL.revokeObjectURL(url);
        return;
      }

      urlRef.current = url;
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;

      // Wire the analyser graph. If Web Audio is unavailable the audio still
      // plays; the body simply will not react (level stays 0).
      try {
        const Ctx: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          ctxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.6;
          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;
          sourceRef.current = source;
          void ctx.resume().catch(() => {});
        }
      } catch {
        // Reactivity is a nicety; playback is the contract. Continue silent-graph.
      }

      audio.onended = () => {
        if (runRef.current === run) stop();
      };
      audio.onerror = () => {
        if (runRef.current === run) setStatus('error');
        teardown();
      };

      try {
        await audio.play();
      } catch {
        // Autoplay blocked, or play interrupted. Settle rather than break.
        if (runRef.current === run) setStatus('idle');
        teardown();
        return;
      }

      if (runRef.current !== run) {
        teardown();
        return;
      }

      setStatus('speaking');
      startLevelLoop();
    },
    [supported, teardown, stop, startLevelLoop],
  );

  // Release everything if the component using the hook unmounts mid-speech.
  useEffect(() => teardown, [teardown]);

  return { speak, stop, speaking, status, levelRef, supported };
}

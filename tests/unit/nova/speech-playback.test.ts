import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNovaSpeech } from '@/lib/nova/use-nova-speech';

/**
 * Nova's speech playback hook.
 *
 * Two things matter here:
 *   • enabling the voice actually requests audio from the server route (#3)
 *   • every audio resource is released — the AudioContext is closed and the
 *     frame loop cancelled — on unmount, so a session cannot leak contexts (#7)
 *
 * The whole Web Audio graph is faked; this asserts the hook's lifecycle, not the
 * browser's audio engine.
 */

const closeSpy = vi.fn().mockResolvedValue(undefined);
const cancelSpy = vi.fn();
const rafSpy = vi.fn().mockReturnValue(1);
const pauseSpy = vi.fn();

class FakeAnalyser {
  fftSize = 256;
  smoothingTimeConstant = 0;
  connect = vi.fn();
  disconnect = vi.fn();
  getByteTimeDomainData = vi.fn();
}
class FakeSource {
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeAudioContext {
  destination = {};
  createAnalyser() {
    return new FakeAnalyser();
  }
  createMediaElementSource() {
    return new FakeSource();
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return closeSpy();
  }
}
class FakeAudio {
  crossOrigin = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  play = vi.fn().mockResolvedValue(undefined);
  pause = pauseSpy;
}

beforeEach(() => {
  vi.clearAllMocks();
  rafSpy.mockReturnValue(1);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nova');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useNovaSpeech — requesting and playing audio', () => {
  it('requests audio from the server route with the text', async () => {
    const { result } = renderHook(() => useNovaSpeech());

    await act(async () => {
      await result.current.speak('I found two passages.');
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/nova/speak');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('I found two passages.');
  });

  it('does not request audio for empty text', async () => {
    const { result } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('   ');
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enters the speaking state and starts the level loop on success', async () => {
    const { result } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('hello');
    });
    expect(result.current.status).toBe('speaking');
    expect(rafSpy).toHaveBeenCalled();
  });

  it('reports the voice unavailable on a 503 rather than erroring', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const { result } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('hello');
    });
    expect(result.current.status).toBe('unavailable');
  });

  it('reports an error on a provider failure without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 502 })),
    );
    const { result } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('hello');
    });
    expect(result.current.status).toBe('error');
  });
});

describe('useNovaSpeech — cleanup', () => {
  it('closes the AudioContext and cancels the frame loop on unmount', async () => {
    const { result, unmount } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('hello');
    });
    expect(result.current.status).toBe('speaking');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('releases resources when stopped explicitly', async () => {
    const { result } = renderHook(() => useNovaSpeech());
    await act(async () => {
      await result.current.speak('hello');
    });
    act(() => result.current.stop());

    expect(closeSpy).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});

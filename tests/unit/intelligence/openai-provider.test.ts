import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ModelProviderError,
  ModelProviderNotConfiguredError,
} from '@/lib/ai/providers/model-client';

/**
 * The OpenAI adapter's failure contract. The key is a test sentinel, never a
 * real credential; the suite asserts it never appears in an error message.
 */

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined }));
vi.mock('@/lib/env', () => ({ serverEnv: env }));

import { createOpenAiClient, isOpenAiConfigured } from '@/lib/ai/providers/openai';

const SENTINEL_KEY = 'test-sentinel-not-a-real-key';
const REQUEST = { modelId: 'gpt-test-mini', system: 'sys', user: 'usr' };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  env.OPENAI_API_KEY = undefined;
});

describe('OpenAI provider', () => {
  it('reports unconfigured and makes no request when the key is missing', async () => {
    expect(isOpenAiConfigured()).toBe(false);
    await expect(createOpenAiClient().complete(REQUEST)).rejects.toBeInstanceOf(
      ModelProviderNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the key only in the Authorization header and returns reported usage', async () => {
    env.OPENAI_API_KEY = SENTINEL_KEY;
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'gpt-test-mini-2026',
          choices: [{ message: { content: '{"answer":"x"}' } }],
          usage: { prompt_tokens: 12, completion_tokens: 3 },
        }),
        { status: 200 },
      ),
    );

    const result = await createOpenAiClient().complete(REQUEST);

    expect(result).toEqual({
      text: '{"answer":"x"}',
      inputTokens: 12,
      outputTokens: 3,
      modelId: 'gpt-test-mini-2026',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SENTINEL_KEY}`);
    expect(String(init.body)).not.toContain(SENTINEL_KEY);
  });

  it('maps an HTTP error to ModelProviderError without leaking the key or the body', async () => {
    env.OPENAI_API_KEY = SENTINEL_KEY;
    fetchMock.mockResolvedValue(new Response(`invalid key ${SENTINEL_KEY}`, { status: 401 }));

    const error = await createOpenAiClient()
      .complete(REQUEST)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ModelProviderError);
    expect((error as Error).message).toBe('OpenAI returned HTTP 401');
    expect((error as Error).message).not.toContain(SENTINEL_KEY);
  });

  it('maps a network failure to ModelProviderError', async () => {
    env.OPENAI_API_KEY = SENTINEL_KEY;
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(createOpenAiClient().complete(REQUEST)).rejects.toBeInstanceOf(ModelProviderError);
  });

  it('rejects an empty completion rather than passing it on', async () => {
    env.OPENAI_API_KEY = SENTINEL_KEY;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    await expect(createOpenAiClient().complete(REQUEST)).rejects.toThrow(/no content/);
  });
});

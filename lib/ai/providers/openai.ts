import { serverEnv } from '@/lib/env';
import {
  ModelProviderError,
  ModelProviderNotConfiguredError,
  type ModelClient,
  type ModelCompletionRequest,
  type ModelCompletionResult,
} from '@/lib/ai/providers/model-client';

/**
 * OpenAI model client — the initial provider adapter (ADR-0019).
 *
 * ⚠ Server-only: it reads `serverEnv.OPENAI_API_KEY`, so importing it from a
 *   Client Component is a build error, and the key never reaches the browser.
 *   Uses `fetch` (no SDK dependency added). JSON output is requested so the
 *   gateway's validator has structured text to parse. It reports token usage
 *   from the provider so cost is recorded from what actually ran.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAiChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function isOpenAiConfigured(): boolean {
  return Boolean(serverEnv.OPENAI_API_KEY);
}

/** Resolve the configured model id for a tier's default (env override wins). */
export function resolveOpenAiModelId(
  defaultModelId: string,
  tier: 'nano' | 'mini' | 'premium',
): string {
  if (tier === 'nano') return serverEnv.OPENAI_MODEL_NANO ?? defaultModelId;
  if (tier === 'mini') return serverEnv.OPENAI_MODEL_MINI ?? defaultModelId;
  return serverEnv.OPENAI_MODEL_PREMIUM ?? defaultModelId;
}

export function createOpenAiClient(): ModelClient {
  return {
    provider: 'openai',
    async complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
      const key = serverEnv.OPENAI_API_KEY;
      if (!key) {
        throw new ModelProviderNotConfiguredError('OPENAI_API_KEY is not configured.');
      }

      let response: Response;
      try {
        response = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: request.modelId,
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: request.maxOutputTokens ?? 1200,
            temperature: 0.2,
          }),
        });
      } catch (error) {
        throw new ModelProviderError(
          `OpenAI request failed: ${error instanceof Error ? error.name : 'network error'}`,
        );
      }

      if (!response.ok) {
        // The status is safe to record; the body may contain provider detail we
        // do not log.
        throw new ModelProviderError(`OpenAI returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenAiChatResponse;
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.length === 0) {
        throw new ModelProviderError('OpenAI returned no content');
      }

      return {
        text,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        modelId: data.model ?? request.modelId,
      };
    },
  };
}

/**
 * Model client contract (ADR-0019). Callers depend on this interface, never a
 * vendor SDK; a provider integration may live ONLY in `lib/ai/providers/`.
 * Types only here — no I/O, no SDK.
 *
 * Everything model-specific is REPORTED by the result (model id, token usage),
 * not assumed by the caller, so usage/cost can be recorded from what actually
 * ran. Failover is not modelled here and is off by default (ADR-0019): the
 * gateway degrades to an "unavailable" state rather than silently substituting
 * an unevaluated model.
 */

export interface ModelCompletionRequest {
  /** The concrete model id resolved from a tier at the wiring seam. */
  modelId: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
  /** Propagated for tracing (ADR-0014). Never carries content. */
  correlationId?: string;
}

export interface ModelCompletionResult {
  /** Raw model output. Validated by the gateway before it can reach the UI. */
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** What actually produced the output. Recorded for cost/audit. */
  modelId: string;
}

export interface ModelClient {
  readonly provider: string;
  complete(request: ModelCompletionRequest): Promise<ModelCompletionResult>;
}

export class ModelProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelProviderNotConfiguredError';
  }
}

export class ModelProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

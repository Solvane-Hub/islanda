/**
 * Typed application errors.
 *
 * Platform Architecture — errors must be informative, recoverable, logged and
 * traceable, and must never expose internal implementation detail to users.
 * Every error therefore carries BOTH a human message (safe to render) and a
 * developer message (never rendered), plus a correlation ID.
 */

export type AppErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_IN_USE'
  | 'AUTH_WEAK_PASSWORD'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_EMAIL_NOT_CONFIRMED'
  | 'AUTH_SESSION_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  /**
   * A general throttle, distinct from `AUTH_RATE_LIMITED`, which is Supabase
   * Auth refusing a credential attempt. This one means the platform's own
   * limiter declined the request.
   */
  | 'RATE_LIMITED'
  | 'UNEXPECTED';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Safe to render to a user. Never contains internal detail. */
  readonly humanMessage: string;
  readonly correlationId: string;
  override readonly cause?: unknown;

  constructor(params: {
    code: AppErrorCode;
    humanMessage: string;
    developerMessage?: string;
    correlationId?: string;
    cause?: unknown;
  }) {
    super(params.developerMessage ?? params.humanMessage);
    this.name = 'AppError';
    this.code = params.code;
    this.humanMessage = params.humanMessage;
    this.correlationId = params.correlationId ?? newCorrelationId();
    this.cause = params.cause;
  }
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Explicit success/failure, so callers cannot forget to handle the failure path.
 * Server Actions return this shape rather than throwing across the boundary.
 */
export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: AppErrorCode;
      message: string;
      correlationId: string;
      fieldErrors?: Record<string, string[]>;
    };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(error: AppError, fieldErrors?: Record<string, string[]>): Result<never> {
  return {
    ok: false,
    code: error.code,
    message: error.humanMessage,
    correlationId: error.correlationId,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

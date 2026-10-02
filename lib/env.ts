import 'server-only';

import { z } from 'zod';

/**
 * Typed environment access, validated once at module load.
 *
 * Security Architecture — secrets are server-side only. Importing this module
 * from a Client Component is a build error by design: server variables must
 * never reach the browser bundle.
 *
 * Fails fast and loudly at boot rather than producing a confusing runtime error
 * three layers deep (Platform Architecture — errors should be informative and traceable).
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WAITLIST_ONLY_MODE: z.enum(['true', 'false']).transform((value) => value === 'true'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /**
   * Fish Audio — Nova's optional speaking voice.
   *
   * ⚠ Server-only, and deliberately so. `FISH_API_KEY` is a bearer credential
   *   for a paid provider; it must never reach the browser bundle, never be
   *   logged, and never be committed. It lives here (not in `clientSchema`) for
   *   the same reason `SUPABASE_SERVICE_ROLE_KEY` does — importing this module
   *   from a Client Component is a build error.
   *
   *   Both are optional: Nova works fully without a voice, and the
   *   `/api/nova/speak` route degrades gracefully (503) when either is absent,
   *   so a deployment without a Fish account is a supported configuration
   *   rather than a boot failure.
   */
  FISH_API_KEY: z.string().min(1).optional(),
  FISH_NOVA_VOICE_ID: z.string().min(1).optional(),
  /**
   * Intelligence Gateway — the LLM provider credential (P5).
   *
   * ⚠ Server-only bearer credential for a paid provider: never in the browser
   *   bundle, never logged, never committed. Optional by design — the gateway
   *   degrades to a controlled "unavailable" state when it is absent, and every
   *   deterministic request works without it. Model ids are overridable per tier
   *   so the tier→model mapping stays configuration (ADR-0019), not code.
   */
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL_NANO: z.string().min(1).optional(),
  OPENAI_MODEL_MINI: z.string().min(1).optional(),
  OPENAI_MODEL_PREMIUM: z.string().min(1).optional(),
});

/**
 * The Supabase URL must be an ORIGIN ONLY — no path, no trailing slash.
 *
 * The client appends `/rest/v1/...` itself, so a value like
 * `https://xyz.supabase.co/rest/v1/` produces `/rest/v1//rest/v1/...` and every
 * request 404s. `z.url()` alone accepts that happily, and the failure surfaces
 * far from its cause — as "table not found" on every query, against a database
 * where the table plainly exists.
 *
 * Caught in verification on 2026-08-07; now rejected at boot.
 */
function isOriginOnly(value: string): boolean {
  // Must not throw: Zod 4 still runs refinements after an earlier check fails,
  // so this receives malformed input. An unguarded `new URL()` would escape
  // safeParse as a raw TypeError instead of becoming a validation issue.
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.pathname === '' || url.pathname === '/') && !url.search && !url.hash;
}

const supabaseUrlSchema = z
  .url()
  .refine(
    isOriginOnly,
    'Must be the project origin only, with no path — e.g. https://your-project.supabase.co (not .../rest/v1/).',
  )
  .transform((v) => v.replace(/\/+$/, ''));

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z
    .url()
    .default('http://localhost:3000')
    .transform((v) => v.replace(/\/+$/, '')),
});

/** The shape of an environment source. Narrower than NodeJS.ProcessEnv so the
 *  parsers can be unit-tested against arbitrary inputs. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

function parseClientEnv(source: EnvSource): z.infer<typeof clientSchema> {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid or missing public environment variables:\n${format(parsed.error)}\n\nSee .env.example.`,
    );
  }
  return parsed.data;
}

function parseServerEnv(source: EnvSource): z.infer<typeof serverSchema> {
  const parsed = serverSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    // Fail closed for production deployments if the explicit flag is omitted.
    // Local development and tests retain the existing auth flow by default.
    WAITLIST_ONLY_MODE:
      source.WAITLIST_ONLY_MODE ?? (source.NODE_ENV === 'production' ? 'true' : 'false'),
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
    FISH_API_KEY: source.FISH_API_KEY,
    FISH_NOVA_VOICE_ID: source.FISH_NOVA_VOICE_ID,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_MODEL_NANO: source.OPENAI_MODEL_NANO,
    OPENAI_MODEL_MINI: source.OPENAI_MODEL_MINI,
    OPENAI_MODEL_PREMIUM: source.OPENAI_MODEL_PREMIUM,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid or missing server environment variables:\n${format(parsed.error)}\n\nSee .env.example.`,
    );
  }
  return parsed.data;
}

/** Exported for unit testing without mutating process.env. */
export const __testing = { parseClientEnv, parseServerEnv, clientSchema, serverSchema };

export const clientEnv = parseClientEnv(process.env);
export const serverEnv = parseServerEnv(process.env);

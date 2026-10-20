import { notFound } from 'next/navigation';
import { deploymentEnvironment, serverEnv } from '@/lib/env';
import { isVisible, type CapabilityId } from '@/lib/product/availability';

/**
 * Release visibility, enforced on the server.
 *
 * Unreleased capabilities (lib/product/availability.ts) are visible in internal
 * environments — a laptop, CI, and Vercel preview deployments, which sit behind
 * Vercel's own sign-in — and invisible in production. `SHOW_UNRELEASED_FEATURES`
 * overrides the default either way ('false' rehearses production locally).
 *
 * Hiding a link is not enough: every unreleased page, server action and API
 * route calls `requireReleased` / `canUse` itself, so a production user who
 * guesses a URL gets a 404, not a half-built workflow. This is release
 * control, not authorization — those routes still require a session, and RLS
 * still decides what any query returns.
 */
export function unreleasedVisible(): boolean {
  return serverEnv.SHOW_UNRELEASED_FEATURES ?? deploymentEnvironment() !== 'production';
}

export function canUse(id: CapabilityId): boolean {
  return isVisible(id, unreleasedVisible());
}

/** For pages and layouts: an unreleased capability does not exist in production. */
export function requireReleased(id: CapabilityId): void {
  if (!canUse(id)) notFound();
}

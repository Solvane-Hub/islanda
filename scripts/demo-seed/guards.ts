import {
  DEMO_ZZ_COUNTRY_CODE,
  DEMO_ZZ_KNOWLEDGE_VERSION,
} from '@/services/knowledge/manifests/demo-zz';
import type { KnowledgePack } from '@/types/knowledge';

/**
 * Guards for the synthetic demo seed.
 *
 * Pure and side-effect free so they can be unit tested without a database, a
 * network, or an environment that could accidentally satisfy them. The script
 * that uses them does no work before every guard has passed.
 *
 * The guards are layered rather than combined into one check, because they
 * defend against different mistakes:
 *
 *   • `FOUNDRYAI_DEMO_PACK=1` defends against an accidental invocation.
 *   • `NODE_ENV !== 'production'` defends against a deliberate invocation in the
 *     wrong place.
 *   • The ZZ check defends against the invocation succeeding but writing
 *     somewhere it must never write.
 *   • The service-role check defends against a half-completed seed.
 *
 * A single combined condition would report "refused" without saying which of
 * those four went wrong, and the fourth is the one that matters most.
 */

export class DemoSeedRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoSeedRefused';
  }
}

export interface DemoSeedEnvironment {
  FOUNDRYAI_DEMO_PACK?: string | undefined;
  NODE_ENV?: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  FOUNDRYAI_DEMO_OWNER_EMAIL?: string | undefined;
}

/**
 * The country this script is permitted to touch. **A constant, never an input.**
 *
 * There is deliberately no CLI argument, no environment variable and no function
 * parameter that can change this. A seeder that accepts a jurisdiction is a
 * seeder that can be pointed at a real one, and the whole containment argument
 * for this demo rests on it being pointed at ZZ and nothing else.
 */
export const DEMO_SEED_COUNTRY_CODE = DEMO_ZZ_COUNTRY_CODE;

/** The only pack version this script may create. */
export const DEMO_SEED_KNOWLEDGE_VERSION = DEMO_ZZ_KNOWLEDGE_VERSION;

/**
 * Refuse unless the operator asked for this, explicitly, outside production.
 *
 * Returns the resolved owner email so the caller cannot proceed without one.
 */
export function assertDemoSeedAllowed(env: DemoSeedEnvironment): { ownerEmail: string } {
  if (env.FOUNDRYAI_DEMO_PACK !== '1') {
    throw new DemoSeedRefused(
      'Refusing to seed: FOUNDRYAI_DEMO_PACK is not set to "1". Seeding a Knowledge Pack is ' +
        'never something that should happen because a command was run by habit.',
    );
  }

  if (env.NODE_ENV === 'production') {
    throw new DemoSeedRefused(
      'Refusing to seed: NODE_ENV is "production". A synthetic corpus must never be created by ' +
        'a production process, regardless of which database it points at.',
    );
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new DemoSeedRefused(
      'Refusing to seed: SUPABASE_SERVICE_ROLE_KEY is not set. Publication and the knowledge ' +
        'pipeline are service-role operations, and a partial seed is worse than none.',
    );
  }

  const ownerEmail = env.FOUNDRYAI_DEMO_OWNER_EMAIL?.trim();
  if (!ownerEmail) {
    throw new DemoSeedRefused(
      'Refusing to seed: FOUNDRYAI_DEMO_OWNER_EMAIL is not set. The demo business must belong to ' +
        'a real signed-up account, so that it is reached through the same auth and RLS path a ' +
        'founder uses. No account is invented.',
    );
  }

  return { ownerEmail };
}

/**
 * The jurisdiction gate.
 *
 * Called with every country code the script is about to write against — the
 * country row, the business, the pack, and each manifest entry — so that a
 * corpus with one mislabelled entry cannot slip a foreign row past a check
 * performed only once at the top.
 */
export function assertDemoJurisdiction(countryCode: string, context: string): void {
  if (countryCode !== DEMO_SEED_COUNTRY_CODE) {
    throw new DemoSeedRefused(
      `Refusing to seed: ${context} has country code "${countryCode}". This script may only ever ` +
        `write ${DEMO_SEED_COUNTRY_CODE} (Example Jurisdiction, a reserved ISO 3166-1 ` +
        'user-assigned code). It must never touch a real jurisdiction, and BS in particular is ' +
        'gated on the unresolved G11 commercial-reuse question.',
    );
  }
}

/** The only pack version this script may create, checked at the point of creation. */
export function assertDemoPackVersion(version: string): void {
  if (version !== DEMO_SEED_KNOWLEDGE_VERSION) {
    throw new DemoSeedRefused(
      `Refusing to seed: pack version "${version}" is not ${DEMO_SEED_KNOWLEDGE_VERSION}.`,
    );
  }
}

/**
 * Refuse to touch a pack that has already reached a terminal or published state.
 *
 * K7 §4.3 makes a published pack immutable, and the database enforces it with a
 * trigger. Failing here first means the operator gets an explanation instead of
 * a constraint violation, and — more importantly — means a second run of this
 * script stops before it has written anything at all.
 */
export function assertPackIsSeedable(existing: KnowledgePack | null): void {
  if (!existing) return;

  if (existing.status === 'published') {
    throw new DemoSeedRefused(
      `Refusing to seed: Knowledge Pack ${existing.version} is already published. A published ` +
        'pack is immutable (K7 §4.3); corrections publish a new version, they never edit in ' +
        'place. Nothing has been changed.',
    );
  }

  if (existing.status === 'superseded' || existing.status === 'rolled_back') {
    throw new DemoSeedRefused(
      `Refusing to seed: Knowledge Pack ${existing.version} is "${existing.status}", which is a ` +
        'terminal state. History is preserved, never reopened (K7 §4.3, §10).',
    );
  }
}

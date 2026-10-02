import type { SourceManifest } from '@/services/knowledge/manifests/types';
import { DEMO_ZZ_COUNTRY_CODE, DEMO_ZZ_MANIFEST } from '@/services/knowledge/manifests/demo-zz';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';

/**
 * Which source manifest describes a jurisdiction's published corpus.
 *
 * The manifest supplies the amendment chain — which instrument amends which
 * provision of which other instrument, and whether that amendment has commenced.
 * Without it the Assistant Service cannot say whether a quoted provision is
 * still the current law, only that it was published.
 *
 * ⚠ **An absent manifest is not an answer.** A jurisdiction missing from this
 *   registry causes `answerNovaQuestion` to withhold the current legal position
 *   for every claim and to name the gap in `unresolved[]`. It does NOT cause
 *   amendment notices to be quietly omitted, which is what the code did before —
 *   and "we have no chronology" is indistinguishable from "there are no
 *   amendments" once the caveat disappears.
 *
 * ## BS is registered with its publication
 *
 * Registering a manifest belongs WITH the decision to publish, not before it: an
 * unpublished pack short-circuits at `no_published_knowledge` before a manifest
 * is ever consulted. BS-v0.1 is now published (G11 commercial-publication
 * eligibility cleared by the project owner), so its manifest is wired in here —
 * this is what lets the Assistant Service resolve the VAT amendment chain
 * (Ch. 370A ← No.3/2025, No.45/2025, No.4/2026, No.2/2026) and caveat provisions
 * whose current standing turns on a later instrument.
 */
const MANIFESTS_BY_COUNTRY: Readonly<Record<string, SourceManifest>> = Object.freeze({
  [DEMO_ZZ_COUNTRY_CODE]: DEMO_ZZ_MANIFEST,
  [BAHAMAS_MANIFEST.countryCode]: BAHAMAS_MANIFEST,
});

/**
 * The manifest for a jurisdiction, or null when none is registered.
 *
 * Null is a real and expected answer, and callers must treat it as an integrity
 * gap rather than as an absence of amendments.
 */
export function manifestForJurisdiction(countryCode: string): SourceManifest | null {
  return MANIFESTS_BY_COUNTRY[countryCode] ?? null;
}

/** Jurisdictions whose chronology this build can account for. Test-facing. */
export function jurisdictionsWithManifest(): readonly string[] {
  return Object.keys(MANIFESTS_BY_COUNTRY);
}

/**
 * Jurisdiction identity, and how a synthetic corpus is recognised.
 *
 * Lives in `lib/knowledge` because both `services/` and `components/` need it,
 * and the layer rules forbid the presentation layer from importing `services/`.
 * A component may not know what a Knowledge Pack *is*; it may know what a
 * country code *looks like*.
 */

/**
 * ISO 3166-1 **user-assigned** alpha-2 codes: `AA`, `QM`–`QZ`, `XA`–`XZ`, `ZZ`.
 *
 * The standard permanently reserves these for private use, which means no real
 * country can ever be allocated one. That is a stronger guarantee than a list of
 * demo codes maintained by hand:
 *
 *   • It cannot produce a false positive. `BS`, `JM`, `TT` and every other real
 *     jurisdiction are outside the range by definition, so a synthetic warning
 *     can never appear over real regulatory guidance.
 *   • It cannot produce a false negative through forgetfulness. Any future demo
 *     jurisdiction that uses a reserved code is covered the moment it exists,
 *     with no second place to remember to update.
 *
 * This is why the demo is contained by its *jurisdiction* rather than by a
 * boolean prop. A prop can be omitted at a call site; a country code travels
 * with the data.
 */
const USER_ASSIGNED_ALPHA2 = /^(?:AA|Q[M-Z]|X[A-Z]|ZZ)$/;

export function isUserAssignedCountryCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && USER_ASSIGNED_ALPHA2.test(code);
}

/**
 * The country code embedded in a Knowledge Pack version.
 *
 * `knowledge_packs.kp_version_format` constrains the version to
 * `^[A-Z]{2}-v[0-9]+\.[0-9]+$`, so the first two characters ARE the pack's
 * jurisdiction. Returns null for anything that does not match, rather than
 * slicing hopefully — a version that does not match the database constraint did
 * not come from the database.
 */
export function countryCodeOfKnowledgeVersion(version: string | null | undefined): string | null {
  if (typeof version !== 'string') return null;
  const match = /^([A-Z]{2})-v[0-9]+\.[0-9]+$/.exec(version);
  return match?.[1] ?? null;
}

/**
 * Whether an answer came from a synthetic demonstration corpus.
 *
 * Takes BOTH signals and requires them to agree:
 *
 *   • `jurisdiction` — the country retrieval was scoped to, which comes from
 *     `businesses.country_code` and is never inferred (K5 §3.2).
 *   • `knowledgeVersion` — the identity of the corpus that was actually read.
 *
 * They cannot disagree in a healthy system: retrieval filters chunks on the
 * context's country, and the Day 6 jurisdiction policy enforces the same
 * boundary in the database. If they DO disagree, something is wrong with the
 * plumbing and we cannot vouch for what is on screen — so the notice is shown.
 * Erring toward an unnecessary warning is the safe direction; erring toward a
 * missing one puts invented law on screen with nothing marking it.
 *
 * A null `knowledgeVersion` means no pack was read at all (the
 * `no_published_knowledge` outcome). Nothing was quoted, so there is nothing to
 * warn about.
 */
export function isSyntheticCorpus(params: {
  jurisdiction: string | null | undefined;
  knowledgeVersion: string | null | undefined;
}): boolean {
  const { jurisdiction, knowledgeVersion } = params;

  if (!knowledgeVersion) return false;

  const packCountry = countryCodeOfKnowledgeVersion(knowledgeVersion);

  if (isUserAssignedCountryCode(jurisdiction) || isUserAssignedCountryCode(packCountry)) {
    return true;
  }

  // Malformed version, or a pack from a country other than the one searched.
  // Both are integrity problems rather than routine states.
  return packCountry === null || (typeof jurisdiction === 'string' && packCountry !== jurisdiction);
}

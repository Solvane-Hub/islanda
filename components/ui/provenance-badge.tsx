import { Badge } from '@/components/ui/badge';

/**
 * Provenance badge — the visible promise that Islanda never blends origins.
 *
 * Every business fact shows where it came from and whether it has been
 * verified. These are the product's non-negotiable categories (§2): a founder
 * saying "my tax id is X" is `founder_unverified`, never `verified`, because no
 * verification mechanism exists yet (§6). "Not yet established" is its own
 * honest state — the fact is simply absent, not assumed.
 *
 * A pure presentation primitive: it maps a kind to a label and tone and nothing
 * else. The tones read correctly on the dark workspace surface because Badge's
 * tokens are remapped under `.workspace-env`.
 */
export type ProvenanceKind =
  | 'founder_provided'
  | 'founder_unverified'
  | 'evidence_verified'
  | 'ai_inferred'
  | 'external_public_data'
  | 'user_document'
  | 'verification_unavailable'
  | 'not_established';

type ProvenanceMeta = { label: string; tone: React.ComponentProps<typeof Badge>['tone'] };

const PROVENANCE: Record<ProvenanceKind, ProvenanceMeta> = {
  founder_provided: { label: 'Founder provided', tone: 'neutral' },
  founder_unverified: { label: 'Founder provided · Not verified', tone: 'warning' },
  evidence_verified: { label: 'Evidence verified', tone: 'success' },
  ai_inferred: { label: 'AI suggested', tone: 'brand' },
  external_public_data: { label: 'Public data', tone: 'info' },
  user_document: { label: 'From your document', tone: 'info' },
  verification_unavailable: { label: 'Verification unavailable', tone: 'neutral' },
  not_established: { label: 'Not yet established', tone: 'neutral' },
};

/**
 * Map a stored fact's provenance + verification to a badge kind.
 *
 * Verified state wins (only reachable via external/evidence provenance, by DB
 * CHECK); otherwise the origin is shown as-is. Used for metrics and documents.
 * Sensitive identifiers use their own mapping (they emphasise "not verified").
 */
export function provenanceKindFor(
  provenance:
    | 'founder_provided'
    | 'evidence_verified'
    | 'ai_inferred'
    | 'external_public_data'
    | 'user_document',
  verification: 'unverified' | 'verified' | 'verification_unavailable',
): ProvenanceKind {
  if (verification === 'verified') return 'evidence_verified';
  if (verification === 'verification_unavailable') return 'verification_unavailable';
  return provenance;
}

export function ProvenanceBadge({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const meta = PROVENANCE[kind];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

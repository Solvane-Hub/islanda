import { Badge } from '@/components/ui/badge';
import type { EpistemicType } from '@/lib/intelligence/types';

/**
 * Renders an evidence item's epistemic type as a small chip, so the reader
 * always sees whether something is a recorded fact, a derived calculation, a
 * founder claim, or an inference — the distinctions must never blur.
 */
const META: Record<
  EpistemicType,
  { label: string; tone: React.ComponentProps<typeof Badge>['tone'] }
> = {
  FACT: { label: 'Fact', tone: 'neutral' },
  VERIFIED_FACT: { label: 'Verified', tone: 'success' },
  FOUNDER_PROVIDED: { label: 'Founder provided', tone: 'neutral' },
  DOCUMENT_DERIVED: { label: 'From document', tone: 'info' },
  EXTERNAL_DATA: { label: 'External data', tone: 'info' },
  CALCULATION: { label: 'Derived', tone: 'brand' },
  REGULATORY_EVIDENCE: { label: 'Cited law', tone: 'success' },
  RECOMMENDATION: { label: 'Recommendation', tone: 'warning' },
  INFERENCE: { label: 'Inference', tone: 'warning' },
  UNKNOWN: { label: 'Unknown', tone: 'neutral' },
};

export function EpistemicBadge({ type, className }: { type: EpistemicType; className?: string }) {
  const meta = META[type];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

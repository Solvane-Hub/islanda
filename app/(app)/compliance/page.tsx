import type { Metadata } from 'next';
import { RoadmapRoute } from '../_components/roadmap-route';

export const metadata: Metadata = { title: 'Compliance' };

/**
 * Compliance is not built yet.
 *
 * Everything except the title and the purpose sentence is shared with the other
 * roadmap surfaces, including the prerequisite states — which are COMPUTED from
 * the database rather than asserted here. See `RoadmapRoute`.
 */
export default function CompliancePage() {
  return (
    <RoadmapRoute
      title="Compliance"
      purpose="The registrations, licences, permits and filings that apply to your business — each one traced back to the Act, regulation or notice it came from."
    />
  );
}

import type { Metadata } from 'next';
import { requireReleased } from '@/lib/product/release';
import { RoadmapRoute } from '../_components/roadmap-route';

export const metadata: Metadata = { title: 'Business requirements' };

/**
 * Compliance is not built yet.
 *
 * Everything except the title and the purpose sentence is shared with the other
 * roadmap surfaces, including the prerequisite states — which are COMPUTED from
 * the database rather than asserted here. See `RoadmapRoute`.
 */
export default function CompliancePage() {
  // Not built: reachable only in internal environments, a 404 in production.
  requireReleased('requirements_guidance');
  return (
    <RoadmapRoute
      title="Business requirements"
      purpose="This will show which registrations, licences and permits may apply to your business, each linked to the official law or notice it comes from. It is not available yet."
    />
  );
}

import type { Metadata } from 'next';
import { RoadmapRoute } from '../_components/roadmap-route';

export const metadata: Metadata = { title: 'Important dates' };

/**
 * Timeline is not built yet.
 *
 * Everything except the title and the purpose sentence is shared with the other
 * roadmap surfaces, including the prerequisite states — which are COMPUTED from
 * the database rather than asserted here. See `RoadmapRoute`.
 */
export default function TimelinePage() {
  return (
    <RoadmapRoute
      title="Important dates"
      purpose="This will show what needs to happen first, the order of the steps after it, and the deadlines and renewals to keep track of. It is not available yet."
    />
  );
}

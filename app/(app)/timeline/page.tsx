import type { Metadata } from 'next';
import { RoadmapRoute } from '../_components/roadmap-route';

export const metadata: Metadata = { title: 'Timeline' };

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
      title="Timeline"
      purpose="Every requirement your business has to meet, sequenced by what blocks what, with the dates that actually matter surfaced against them."
    />
  );
}

import type { Metadata } from 'next';
import { RoadmapRoute } from '../_components/roadmap-route';

export const metadata: Metadata = { title: 'Funding' };

/**
 * Funding is not built yet.
 *
 * Everything except the title and the purpose sentence is shared with the other
 * roadmap surfaces, including the prerequisite states — which are COMPUTED from
 * the database rather than asserted here. See `RoadmapRoute`.
 */
export default function FundingPage() {
  return (
    <RoadmapRoute
      title="Funding"
      purpose="Programmes and facilities assessed against where your business genuinely is, with the eligibility rules that decided the match shown alongside."
    />
  );
}

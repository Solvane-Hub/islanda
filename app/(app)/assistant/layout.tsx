import { requireReleased } from '@/lib/product/release';

/**
 * Nova is built but not yet released to founders (SF1/SF3). In production this
 * whole segment is a 404 — the page, "How Nova works", everything under it —
 * however the URL was reached. The server actions check again on their own.
 */
export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  requireReleased('cited_answers');
  return children;
}

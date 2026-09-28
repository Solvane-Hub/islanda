import {
  Banknote,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Waypoints,
} from 'lucide-react';

/**
 * Primary navigation — organized by product sector (P7 Phase 1), not by
 * build status. Routes for phases not yet built still get `available: false`
 * and render as visibly disabled rather than hidden or linked to a dead end;
 * what changed is that they now sit inside the sector they conceptually
 * belong to (Intelligence) instead of being pulled out into their own
 * "Coming soon" group. `SidebarNav`'s existing per-item muted styling and
 * "Soon" badge are what keep them honestly secondary — a group heading was
 * never the thing doing that work.
 */
export interface NavItem {
  href: string;
  label: string;
  available: boolean;
  icon: LucideIcon;
  /**
   * True for an in-page anchor into another route's section, for a concept
   * (Goals, Financials) that is real and built but has no page of its own
   * yet — not a new route invented to satisfy the nav structure. `usePathname`
   * never includes a hash, so these naturally never match as the active
   * route; the page they point into (Overview) carries that state instead.
   */
  isAnchor?: boolean;
}

export interface NavSector {
  /** Omitted for Overview — a lone heading above one item is noise. */
  label?: string;
  items: readonly NavItem[];
}

export const NAV_SECTORS: readonly NavSector[] = [
  {
    items: [{ href: '/dashboard', label: 'Overview', available: true, icon: LayoutDashboard }],
  },
  {
    label: 'Business',
    items: [
      { href: '/intake', label: 'Business', available: true, icon: ClipboardList },
      {
        href: '/dashboard#goals',
        label: 'Goals',
        available: true,
        icon: Target,
        isAnchor: true,
      },
      { href: '/documents', label: 'Documents', available: true, icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        href: '/dashboard#financials',
        label: 'Financials',
        available: true,
        icon: TrendingUp,
        isAnchor: true,
      },
      /**
       * Nova is `available`. It was listed under "Coming soon" long after it
       * shipped. The extractive reasoner, its envelope gate, citation
       * grounding, jurisdiction-scoped retrieval, rate limiting and execution
       * recording are all built and tested, and a Knowledge Pack is
       * published — so describing it as forthcoming was the same class of
       * error as describing an unbuilt surface as ready, in the other
       * direction.
       *
       * The route gates itself: with no published pack for the founder's
       * jurisdiction it shows the roadmap surface rather than a composer
       * (app/(app)/assistant/page.tsx), so promoting it here cannot imply a
       * capability the corpus does not support.
       */
      { href: '/assistant', label: 'Nova', available: true, icon: Sparkles },
      { href: '/compliance', label: 'Compliance', available: false, icon: ShieldCheck },
      { href: '/timeline', label: 'Timeline', available: false, icon: Waypoints },
      { href: '/funding', label: 'Funding', available: false, icon: Banknote },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', available: true, icon: Settings }],
  },
] as const;

/** Flat list retained for any caller that needs every route. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTORS.flatMap((g) => g.items);

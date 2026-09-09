import {
  Banknote,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from 'lucide-react';

/**
 * Primary navigation.
 *
 * Routes for phases not yet built are listed with `available: false` and render
 * as visibly disabled. Hiding them would leave the founder unable to see where
 * the product is going; linking them would lead to a dead end. Showing them as
 * "coming in a later phase" is the honest option.
 */
export interface NavItem {
  href: string;
  label: string;
  available: boolean;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Omitted for the first group — a lone heading above "Dashboard" is noise. */
  label?: string;
  items: readonly NavItem[];
}

/**
 * Grouped so the unfinished routes sit together under one honest heading
 * instead of being scattered through the list, each individually greyed out.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', available: true, icon: LayoutDashboard },
      /**
       * Nova sits directly under the dashboard, and is `available`.
       *
       * It was listed under "Coming soon" long after it shipped. The extractive
       * reasoner, its envelope gate, citation grounding, jurisdiction-scoped
       * retrieval, rate limiting and execution recording are all built and
       * tested, and a Knowledge Pack is published — so describing it as
       * forthcoming was the same class of error as describing an unbuilt
       * surface as ready, in the other direction.
       *
       * The route gates itself: with no published pack for the founder's
       * jurisdiction it shows the roadmap surface rather than a composer
       * (app/(app)/assistant/page.tsx), so promoting it here cannot imply a
       * capability the corpus does not support.
       */
      { href: '/assistant', label: 'Nova', available: true, icon: Sparkles },
      { href: '/intake', label: 'Business intake', available: true, icon: ClipboardList },
      { href: '/documents', label: 'Documents', available: true, icon: FileText },
    ],
  },
  {
    label: 'Coming soon',
    items: [
      { href: '/timeline', label: 'Timeline', available: false, icon: Waypoints },
      { href: '/compliance', label: 'Compliance', available: false, icon: ShieldCheck },
      { href: '/funding', label: 'Funding', available: false, icon: Banknote },
    ],
  },
  {
    items: [{ href: '/settings', label: 'Settings', available: true, icon: Settings }],
  },
] as const;

/** Flat list retained for any caller that needs every route. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

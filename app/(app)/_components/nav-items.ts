import {
  Banknote,
  CalendarClock,
  ClipboardList,
  FileText,
  House,
  IdCard,
  LifeBuoy,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { capability } from '@/lib/product/availability';

/**
 * Primary navigation — grouped by what a person is trying to do, not by how
 * the system is built.
 *
 *   Home · Your business (summary, details, goals, money, documents) · Get help
 *   · Coming later · Settings
 *
 * Every existing route keeps its URL; only labels and grouping changed, so
 * deep links still work. "Coming later" items are still listed (with a "Soon"
 * badge) rather than hidden, and their availability is read from the product
 * availability register — the same source the public homepage uses — so the
 * app cannot advertise a surface the homepage calls unbuilt, or the reverse.
 */
export interface NavItem {
  href: string;
  label: string;
  available: boolean;
  icon: LucideIcon;
  /**
   * True for an in-page anchor into another route's section, for a concept
   * (goals, money) that is real and built but has no page of its own yet — not
   * a new route invented to satisfy the nav structure. `usePathname` never
   * includes a hash, so these never match as the active route; the page they
   * point into (Home) carries that state instead.
   */
  isAnchor?: boolean;
  /** Other path prefixes this item owns for "you are here" — e.g. the intake form under Business details. */
  alsoActiveFor?: readonly string[];
}

export interface NavSector {
  /** Omitted for Home — a lone heading above one item is noise. */
  label?: string;
  items: readonly NavItem[];
}

const built = (id: Parameters<typeof capability>[0]) => capability(id).status === 'available';

export const NAV_SECTORS: readonly NavSector[] = [
  {
    items: [{ href: '/dashboard', label: 'Home', available: true, icon: House }],
  },
  {
    label: 'Your business',
    items: [
      // The Business Passport, introduced by what it is for.
      { href: '/passport', label: 'My Business', available: true, icon: IdCard },
      {
        href: '/intake/review',
        label: 'Business details',
        available: true,
        icon: ClipboardList,
        alsoActiveFor: ['/intake'],
      },
      {
        href: '/dashboard#goals',
        label: 'My goals',
        available: true,
        icon: Target,
        isAnchor: true,
      },
      {
        href: '/dashboard#financials',
        label: 'Money and sales',
        available: true,
        icon: TrendingUp,
        isAnchor: true,
      },
      { href: '/documents', label: 'Documents', available: true, icon: FileText },
    ],
  },
  {
    label: 'Help',
    items: [
      /**
       * Nova. The extractive reasoner, its envelope gate, citation grounding,
       * jurisdiction-scoped retrieval, rate limiting and execution recording
       * are built and tested, and the route gates itself on a published
       * Knowledge Pack — so it is listed as available, under the name of the
       * job it does rather than the name of the assistant.
       */
      { href: '/assistant', label: 'Get help', available: true, icon: LifeBuoy },
    ],
  },
  {
    label: 'Coming later',
    items: [
      {
        href: '/compliance',
        label: 'Requirements',
        available: built('requirements_guidance'),
        icon: ShieldCheck,
      },
      {
        href: '/timeline',
        label: 'Important dates',
        available: built('important_dates'),
        icon: CalendarClock,
      },
      { href: '/funding', label: 'Funding', available: built('funding'), icon: Banknote },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', available: true, icon: Settings }],
  },
] as const;

/** Flat list retained for any caller that needs every route. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTORS.flatMap((g) => g.items);

/** Whether `item` is where the reader is. Anchors never are (no hash in a pathname). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.isAnchor) return false;
  const owns = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (owns(item.href)) return true;
  // A more specific item owns its own path: "/intake/review" is Business details
  // through its href, and "/intake" (the form) through `alsoActiveFor`.
  return (item.alsoActiveFor ?? []).some(owns);
}

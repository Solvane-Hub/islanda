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
import { isVisible, type CapabilityId } from '@/lib/product/availability';

/**
 * Primary navigation — grouped by what a person is trying to do, not by how
 * the system is built.
 *
 *   Home · Your business (summary, details, goals, money, documents) · Settings
 *
 * Every existing route keeps its URL; only labels and grouping changed, so
 * deep links still work.
 *
 * Build privately, release deliberately: an item tied to an unreleased
 * capability (lib/product/availability.ts) is not listed at all for users —
 * no "Soon" badge, no greyed-out row that leads to a placeholder. In internal
 * environments the server passes `showUnreleased` and those items appear under
 * "Internal preview", marked as such. `navSectorsFor` is the only place that
 * decides, and the routes themselves 404 in production (lib/product/release.ts).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The capability this item exposes, when it is not part of the core app. */
  capability?: CapabilityId;
  /** Set by `navSectorsFor` on an unreleased item shown in an internal environment. */
  preview?: boolean;
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

export const NAV_SECTORS: readonly NavSector[] = [
  {
    items: [{ href: '/dashboard', label: 'Home', icon: House }],
  },
  {
    label: 'Your business',
    items: [
      // The Business Passport, introduced by what it is for.
      { href: '/passport', label: 'My Business', icon: IdCard },
      {
        href: '/intake/review',
        label: 'Business details',
        icon: ClipboardList,
        alsoActiveFor: ['/intake'],
      },
      {
        href: '/dashboard#goals',
        label: 'My goals',
        icon: Target,
        isAnchor: true,
      },
      {
        href: '/dashboard#financials',
        label: 'Money and sales',
        icon: TrendingUp,
        isAnchor: true,
      },
      { href: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Help',
    items: [
      /**
       * Nova. The extractive reasoner is built and tested, but its release to
       * founders waits on the disclaimer and accountability decision (SF1/SF3),
       * so it is an internal item until `cited_answers` is released.
       */
      { href: '/assistant', label: 'Get help', icon: LifeBuoy, capability: 'cited_answers' },
    ],
  },
  {
    // Placeholder routes for capabilities that are not built. Internal only.
    label: 'Internal preview',
    items: [
      {
        href: '/compliance',
        label: 'Requirements',
        icon: ShieldCheck,
        capability: 'requirements_guidance',
      },
      {
        href: '/timeline',
        label: 'Important dates',
        icon: CalendarClock,
        capability: 'important_dates',
      },
      { href: '/funding', label: 'Funding', icon: Banknote, capability: 'funding' },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
] as const;

/** Flat list of every route, released or not — for tests and route audits, not for rendering. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTORS.flatMap((g) => g.items);

/**
 * The navigation a person in this environment may see. Unreleased items are
 * dropped (or, internally, kept and marked `preview`); a sector left empty is
 * dropped with them, so no heading ever sits over nothing.
 */
export function navSectorsFor(showUnreleased: boolean): NavSector[] {
  return NAV_SECTORS.map((sector) => ({
    ...sector,
    items: sector.items
      .filter((item) => !item.capability || isVisible(item.capability, showUnreleased))
      .map((item) =>
        item.capability && !isVisible(item.capability, false) ? { ...item, preview: true } : item,
      ),
  })).filter((sector) => sector.items.length > 0);
}

/** Whether `item` is where the reader is. Anchors never are (no hash in a pathname). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.isAnchor) return false;
  const owns = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (owns(item.href)) return true;
  // A more specific item owns its own path: "/intake/review" is Business details
  // through its href, and "/intake" (the form) through `alsoActiveFor`.
  return (item.alsoActiveFor ?? []).some(owns);
}

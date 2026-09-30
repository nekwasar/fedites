/**
 * Nav service (configuration.md §4): badges, deep links, and state restoration
 * behave identically in all patterns via this service. Clients render any
 * pattern from this one description — geometry moves, items stay (I2).
 */
import { type NavConfig, type NavItem, type Device, fixedNavItems } from "./schema.js";
import type { ResolvedView } from "./resolve.js";

export interface NavTarget {
  route: string;
}

export const navRoutes: Record<NavItem, NavTarget> = {
  groups: { route: "/" },
  feed: { route: "/feed" },
  chat: { route: "/chat" },
  events: { route: "/events" },
  menu: { route: "/menu" },
  manage: { route: "/manage" },
};

export interface NavItemView {
  item: NavItem;
  label: string;
  route: string;
  /** Only role-holders see Manage (spec.md §3). */
  requiresRole: boolean;
}

export function visibleItems(nav: NavConfig, hasDutyRole: boolean): NavItemView[] {
  const items: NavItem[] = hasDutyRole ? [...fixedNavItems, "manage"] : [...fixedNavItems];
  return items.map((item) => ({
    item,
    label: nav.labels[item] ?? item,
    route: navRoutes[item].route,
    requiresRole: item === "manage",
  }));
}

/** Pick the pattern for a device; unknown combos fall back to defaults. */
export function patternFor(view: ResolvedView, device: Device): string {
  return device === "mobile" ? view.nav.mobile : view.nav.desktop;
}

export { fixedNavItems };

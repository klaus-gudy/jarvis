import {
  Building2Icon,
  BuildingIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserCogIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import type { Permission, RoleKind } from "@/lib/permissions";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  /**
   * Rendered as a submenu under this item. A parent with children owns no page
   * of its own — `/settings` only redirects to the first child — so nothing
   * navigates to `url` directly except the redirect.
   */
  items?: NavItem[];
  /**
   * Kept in the list but not shown in the sidebar — a section that exists in
   * the codebase and is not offered yet.
   *
   * Declared here rather than deleted so the entry, its icon and its wording
   * survive intact, and so `findPageTitle` still names the route if anything
   * reaches it. Turning a section back on is removing this one line, plus the
   * redirect in its `page.tsx`.
   */
  hidden?: boolean;
  /**
   * What a staff member needs to see this entry (any one of them). The page
   * enforces the same requirement through `requireStaffPage` — hiding the link
   * is only a courtesy.
   */
  permission?: Permission | readonly Permission[];
};

/** Any one of these opens Settings → Organization (the page checks the same). */
export const ORGANIZATION_SETTINGS_PERMISSIONS = [
  "org:manage",
  "org:backup",
  "org:restore",
  "org:delete",
] as const satisfies readonly Permission[];

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    permission: "dashboard:read",
    icon: LayoutDashboardIcon,
    description: "Overview of your organization",
  },
  {
    title: "Properties",
    url: "/properties",
    permission: "property:read",
    icon: BuildingIcon,
    description: "Buildings and the units inside them",
  },
  {
    title: "Tenants",
    url: "/tenants",
    permission: "tenant:read",
    icon: UsersIcon,
    description: "People renting units in your properties",
  },
  {
    title: "Leases",
    url: "/leases",
    permission: "lease:read",
    icon: FileTextIcon,
    description: "Agreements linking tenants to units",
  },
  {
    title: "Payments",
    url: "/payments",
    permission: "payment:read",
    icon: WalletIcon,
    description: "Rent payments recorded against invoices",
  },
  {
    title: "Users",
    url: "/users",
    permission: "member:read",
    icon: UserCogIcon,
    description: "Members of your organization and their roles",
  },
  {
    title: "Roles & permissions",
    url: "/roles",
    permission: "role:manage",
    icon: ShieldCheckIcon,
    description: "Roles people can hold, and what each one may do",
  },
  {
    title: "Settings",
    url: "/settings",
    permission: ["template:manage", ...ORGANIZATION_SETTINGS_PERMISSIONS],
    icon: SettingsIcon,
    description: "How your organization works",
    items: [
      {
        title: "Organization",
        url: "/settings/organization",
        permission: ORGANIZATION_SETTINGS_PERMISSIONS,
        icon: Building2Icon,
        description: "Owner, backup and restore, and deleting the organization",
      },
      {
        title: "Lease templates",
        url: "/settings/lease-templates",
        permission: "template:manage",
        icon: ScrollTextIcon,
        description: "Contract wording reused for every lease you generate",
      },
    ],
  },
];

/**
 * What the sidebar actually renders.
 *
 * `navItems` stays complete on purpose: `findActiveNavItem` and
 * `findPageTitle` walk it, so a hidden section keeps its title and its
 * highlighting rather than falling back to the bare app name.
 */
export const visibleNavItems = navItems.filter((item) => !item.hidden);

type Viewer = { kind: RoleKind; permissions: ReadonlySet<Permission> | readonly Permission[] };

function allows(viewer: Viewer, requirement?: Permission | readonly Permission[]) {
  if (!requirement) return true;
  const held = viewer.permissions;
  const has = (p: Permission) =>
    held instanceof Set ? held.has(p) : (held as readonly Permission[]).includes(p);
  return typeof requirement === "string" ? has(requirement) : requirement.some(has);
}

/** The sidebar for one viewer: hidden sections and unpermitted ones removed. */
export function navItemsFor(viewer: Viewer): NavItem[] {
  return visibleNavItems
    .filter((item) => allows(viewer, item.permission))
    .map((item) =>
      item.items
        ? { ...item, items: item.items.filter((child) => allows(viewer, child.permission)) }
        : item
    )
    .filter((item) => !item.items || item.items.length > 0);
}

/**
 * Where to send a staff member who opened a page they may not see: the first
 * sidebar entry they can open, or null when there is none.
 */
export function firstAllowedPath(viewer: Viewer): string | null {
  const first = navItemsFor(viewer)[0];
  if (!first) return null;
  return first.items?.[0]?.url ?? first.url;
}

/**
 * Pages reachable from somewhere other than the sidebar — the user menu, and
 * the dashboard's Recent activity panel. They are not `navItems` (nothing should highlight in the sidebar when
 * you are on one), but the header still needs a title for them, which would
 * otherwise fall back to the bare app name.
 */
const secondaryPageTitles: Record<string, string> = {
  "/profile": "Profile",
  "/activity": "Activity",
};

function matchesPath(url: string, pathname: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * Longest-prefix match so nested routes (e.g. /properties/123) stay
 * highlighted. A parent matches when one of its children does, so Settings
 * stays lit while you are inside a template.
 */
export function findActiveNavItem(pathname: string) {
  return navItems
    .filter(
      (item) =>
        matchesPath(item.url, pathname) ||
        item.items?.some((child) => matchesPath(child.url, pathname))
    )
    .sort((a, b) => b.url.length - a.url.length)[0];
}

/** The submenu entry in force, if the path is inside one. */
export function findActiveSubItem(pathname: string) {
  return navItems
    .flatMap((item) => item.items ?? [])
    .filter((child) => matchesPath(child.url, pathname))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

/** Header title for any route, sidebar item or not. */
export function findPageTitle(pathname: string) {
  const match = Object.keys(secondaryPageTitles)
    .filter((url) => matchesPath(url, pathname))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return secondaryPageTitles[match];

  // The child wins over its parent: "Lease templates" says where you are,
  // "Settings" only says which drawer it came out of.
  return (
    findActiveSubItem(pathname)?.title ??
    findActiveNavItem(pathname)?.title ??
    "Jarvis"
  );
}

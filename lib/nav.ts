import {
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
};

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
    description: "Overview of your organization",
  },
  {
    title: "Properties",
    url: "/properties",
    icon: BuildingIcon,
    description: "Buildings and the units inside them",
  },
  {
    title: "Tenants",
    url: "/tenants",
    icon: UsersIcon,
    description: "People renting units in your properties",
  },
  {
    title: "Leases",
    url: "/leases",
    icon: FileTextIcon,
    description: "Agreements linking tenants to units",
  },
  {
    title: "Payments",
    url: "/payments",
    icon: WalletIcon,
    description: "Rent payments recorded against invoices",
  },
  {
    title: "Users",
    url: "/users",
    icon: UserCogIcon,
    description: "Members of your organization and their roles",
  },
  {
    title: "Roles & permissions",
    url: "/roles",
    icon: ShieldCheckIcon,
    description: "Roles people can hold, and what each one may do",
    /*
      Hidden for now: roles are seeded and read (registration, the Users page,
      tenant creation all depend on `lib/roles.ts`), but nothing yet *enforces*
      a permission, so the page offers a control that does not control
      anything. `app/(app)/roles/page.tsx` redirects to match — a hidden tab
      whose URL still worked would be a section you can only reach by accident.
    */
    hidden: true,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: SettingsIcon,
    description: "How your organization works",
    items: [
      {
        title: "Lease templates",
        url: "/settings/lease-templates",
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

/**
 * Pages reachable from somewhere other than the sidebar — the user menu, for
 * now. They are not `navItems` (nothing should highlight in the sidebar when
 * you are on one), but the header still needs a title for them, which would
 * otherwise fall back to the bare app name.
 */
const secondaryPageTitles: Record<string, string> = {
  "/profile": "Profile",
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

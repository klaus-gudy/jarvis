import {
  BuildingIcon,
  FileTextIcon,
  LayoutDashboardIcon,
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
  },
];

/**
 * Pages reachable from somewhere other than the sidebar — the user menu, for
 * now. They are not `navItems` (nothing should highlight in the sidebar when
 * you are on one), but the header still needs a title for them, which would
 * otherwise fall back to the bare app name.
 */
const secondaryPageTitles: Record<string, string> = {
  "/profile": "Profile",
};

/** Longest-prefix match so nested routes (e.g. /properties/123) stay highlighted. */
export function findActiveNavItem(pathname: string) {
  return navItems
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

/** Header title for any route, sidebar item or not. */
export function findPageTitle(pathname: string) {
  const match = Object.keys(secondaryPageTitles)
    .filter((url) => pathname === url || pathname.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];

  return match
    ? secondaryPageTitles[match]
    : findActiveNavItem(pathname)?.title ?? "Jarvis";
}

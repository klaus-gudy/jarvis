import {
  BuildingIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserCogIcon,
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

/** Longest-prefix match so nested routes (e.g. /properties/123) stay highlighted. */
export function findActiveNavItem(pathname: string) {
  return navItems
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

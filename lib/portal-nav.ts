import {
  FileTextIcon,
  FolderOpenIcon,
  HomeIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";

import type { NavItem } from "@/lib/nav";

/**
 * The tenant portal's menu. No permissions: every tenant sees all of it, and
 * every page behind it reads only the tenant's own records (`lib/portal.ts`).
 */
export const portalNavItems: NavItem[] = [
  {
    title: "Home",
    url: "/portal",
    icon: HomeIcon,
    description: "Your tenancy at a glance",
  },
  {
    title: "My lease",
    url: "/portal/lease",
    icon: FileTextIcon,
    description: "Your lease, its contract and past leases",
  },
  {
    title: "Payments",
    url: "/portal/payments",
    icon: WalletIcon,
    description: "What you owe and what you have paid",
  },
  {
    title: "Documents",
    url: "/portal/documents",
    icon: FolderOpenIcon,
    description: "Contracts and files your landlord keeps for you",
  },
  {
    title: "Profile",
    url: "/portal/profile",
    icon: UserRoundIcon,
    description: "Your details, password and signature",
  },
];

/** Longest matching prefix, so `/portal/lease` doesn't also light up Home. */
export function findActivePortalItem(pathname: string): NavItem | undefined {
  return portalNavItems
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

import { redirect } from "next/navigation";

import { requireStaffPage } from "@/lib/authz";
import { ORGANIZATION_SETTINGS_PERMISSIONS, navItemsFor } from "@/lib/nav";

/**
 * Settings owns no page of its own — it is a drawer. A typed `/settings` (or
 * the sidebar parent, if it ever becomes a link) lands on the first submenu
 * entry this viewer may open, so a member who can manage templates but not the
 * organization isn't bounced through a page they can't see.
 */
export default async function SettingsPage() {
  const ctx = await requireStaffPage([
    "template:manage",
    ...ORGANIZATION_SETTINGS_PERMISSIONS,
  ]);
  const settings = ctx
    ? navItemsFor(ctx).find((item) => item.url === "/settings")
    : undefined;
  redirect(settings?.items?.[0]?.url ?? "/settings/lease-templates");
}

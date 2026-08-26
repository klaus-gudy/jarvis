import { redirect } from "next/navigation";

/**
 * Settings owns no page of its own yet — it is a drawer with one thing in it.
 * The redirect exists so a typed `/settings` (or the sidebar parent, if it ever
 * becomes a link) lands somewhere rather than 404ing.
 */
export default function SettingsPage() {
  redirect("/settings/lease-templates");
}

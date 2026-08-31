import { redirect } from "next/navigation";

/**
 * Hidden for now — see the `hidden` flag on this section in `lib/nav.ts`.
 *
 * Roles are seeded and read all over the app (registration, the Users page,
 * tenant creation), but nothing yet *enforces* a permission, so this page
 * offered a control that controlled nothing. The tab is gone from the sidebar
 * and the URL redirects rather than 404s: the route is being withheld, not
 * removed, and a 404 would say the wrong thing about a page that still exists
 * in the codebase.
 *
 * **To bring it back**: drop `hidden: true` from the Roles entry in
 * `lib/nav.ts`, restore this file's previous body from git
 * (`git show HEAD:'app/(app)/roles/page.tsx'`), and re-add the `roles` tour to
 * `lib/tours.ts`. `components/roles/*`, `lib/roles.ts` and `/api/roles` were
 * left untouched.
 */
export default function RolesPage() {
  redirect("/dashboard");
}

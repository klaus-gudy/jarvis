import { redirect } from "next/navigation";

import { needsEmailVerification } from "@/lib/auth/email-verification";
import { getCurrentUser } from "@/lib/auth/session";
import { planCheckoutHref, PRICING_PLANS, subscribePath, type BillingPeriod } from "@/lib/site";

/**
 * The gate every "pay" button goes through. A payment is only worth taking
 * when it can be credited to an organization, so this makes sure there is one
 * before snippe ever sees the visitor:
 *
 * - signed out → register (an account and its organization in one step), and
 *   come back here — `?next=` carries the choice through sign-up;
 * - unverified email → verify first, then back here;
 * - signed in with no organization → create one (the app's own prompt), then
 *   back here;
 * - signed in, but not allowed to manage the organization → Settings → Billing,
 *   which says who can pay;
 * - otherwise → snippe's checkout, with the organization in `meta`.
 *
 * Public in `proxy.ts` because the first case is a signed-out visitor.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const plan = PRICING_PLANS.find((candidate) => candidate.slug === params.get("plan"));
  const billing = params.get("billing");
  if (!plan || (billing !== "monthly" && billing !== "yearly")) redirect("/#pricing");

  const self = subscribePath(plan.slug, billing as BillingPeriod);
  const next = `next=${encodeURIComponent(self)}`;

  const user = await getCurrentUser();
  if (!user) redirect(`/register?${next}`);
  if (needsEmailVerification(user)) redirect(`/verify-email?${next}`);
  if (!user.activeOrgId || !user.activeMembership) redirect(`/dashboard?${next}`);
  if (!user.activeMembership.permissions.includes("org:manage")) {
    redirect("/settings/billing");
  }

  redirect(planCheckoutHref(plan.slug, billing as BillingPeriod, user.activeOrgId));
}

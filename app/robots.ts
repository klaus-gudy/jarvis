import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * `/` is the only page a crawler should ever index — everything else is either
 * behind the session cookie or an auth form, and none of it is content.
 *
 * The disallows are belt and braces rather than the actual protection:
 * `proxy.ts` already redirects an unauthenticated request for any app route to
 * `/login`, so a crawler cannot reach one. Listing them keeps the sign-in and
 * password-reset forms out of the index, where they would compete with the
 * landing page for the brand query and offer a searcher nothing.
 *
 * `/invite/` is disallowed for a different and sharper reason: those URLs carry
 * a single-use token that authorises whoever holds it. One indexed invite link
 * is a stranger joining an organisation.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/invite/",
        "/dashboard",
        "/properties",
        "/tenants",
        "/leases",
        "/payments",
        "/users",
        "/roles",
        "/members",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-otp",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

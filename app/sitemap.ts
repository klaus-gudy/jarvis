import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * One entry, because there is one indexable page.
 *
 * A sitemap listing routes that redirect to `/login` would report a site of
 * broken URLs to Search Console, which is worse than a short honest one. The
 * landing page's sections are anchors on this same URL, not separate documents,
 * so they do not belong here either.
 *
 * Add a row per page as real content arrives — a blog, a guide for landlords,
 * a terms page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

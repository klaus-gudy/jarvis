/**
 * Everything the public landing page says about itself, in one place.
 *
 * Two consumers read from here and they must never disagree: the rendered page
 * and the JSON-LD handed to search engines. An FAQ answer that differs from its
 * `FAQPage` entry is exactly the "content mismatch" Google penalises, so the
 * questions are defined once and both sides map over the same array.
 *
 * Dependency-free on purpose — `app/sitemap.ts` and `app/robots.ts` are cached
 * route handlers and the page is statically prerendered; nothing here may reach
 * for Prisma or a request-time API.
 */

/**
 * Absolute origin, needed for canonical URLs, OG tags, sitemap and robots —
 * all of which must be absolute to be valid.
 *
 * Falls back to the dev port rather than to an invented domain: a wrong
 * canonical pointing at a domain that isn't ours is worse than an obviously
 * local one. **Set `NEXT_PUBLIC_SITE_URL` on the deploy target.**
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3347"
).replace(/\/$/, "");

export const SITE_NAME = "Rentoo";

/** The one-line answer to "what is this?", reused as the meta description. */
export const SITE_TAGLINE =
  "Property management software for Tanzanian landlords. Track rent, tenants, leases and payments in one place — in TZS, with M-Pesa, Tigo Pesa and Airtel Money.";

/** Sections the top navigation scroll-spies between, in page order. */
export const NAV_SECTIONS = [
  { id: "features", label: "Features" },
  { id: "why-us", label: "Why us" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/**
 * Objection handling, in the order a landlord actually raises it: can I do
 * this, does it fit how I already work, what happens to my tenants' details,
 * and what will it cost. Answers stay short — a wall of text on an FAQ reads
 * as a warning sign.
 */
export const FAQS = [
  {
    question: "Do I need to be good with computers to use Rentops?",
    answer:
      "No. If you can use WhatsApp, you can use Rentops. You add a building, add the units inside it, then add tenants. Everything else — who owes what, which lease is ending, how much rent came in — is worked out for you and shown on one screen.",
  },
  {
    question: "I already keep my tenants in an Excel sheet. Do I have to type them all again?",
    answer:
      "No. Download the template, paste your existing list into it, and upload it. Rentops checks every row before saving anything, shows you exactly which rows have a problem and why, and imports the rest. Units and tenants both work this way.",
  },
  {
    question: "My tenants pay by M-Pesa. Does that work?",
    answer:
      "Yes. When you record a payment you choose how it came in — M-Pesa, Tigo Pesa, Airtel Money, Halopesa, cash, bank transfer or cheque. Rentops does not move money itself; it records what you received, so your books match your statements.",
  },
  {
    question: "Can a tenant pay rent in instalments?",
    answer:
      "Yes. Each lease gets one invoice for the full amount, and you record as many payments against it as you need. The invoice shows Unpaid, Partly paid or Paid on its own, and the balance updates as you go — so a tenant paying 200,000 of 750,000 is never lost track of.",
  },
  {
    question: "Who can see my tenants' information?",
    answer:
      "Only you and the people you invite. Every property, tenant, lease and payment belongs to your organisation and is filtered by it on every single request — another landlord using Rentops cannot see your records, and you cannot see theirs. Passwords are hashed, sign-in attempts are rate limited, and sessions expire.",
  },
  {
    question: "Can my caretaker or manager use it too?",
    answer:
      "Yes. Send them an invite link and they get their own login under your organisation — you never share your password. You can revoke an invitation before it is used, and remove a member at any time.",
  },
  {
    question: "Does it work on my phone?",
    answer:
      "Yes. Rentops is a website, so there is nothing to install and nothing to update. Every list becomes a card view on a small screen instead of a table you have to scroll sideways.",
  },
  {
    question: "Is it really free?",
    answer:
      "It is free while Rentops is in beta — no card, no trial countdown. When paid plans arrive you will be told well before anything changes, and your data will still be yours.",
  },
] as const;

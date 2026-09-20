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
    question: "Do I need to be good with computers to use Rentoo?",
    answer:
      "No. If you can use WhatsApp, you can use Rentoo. You add a building, add the units inside it, then add tenants. Everything else — who owes what, which lease is ending, how much rent came in — is worked out for you and shown on one screen.",
  },
  {
    question: "I already keep my tenants in an Excel sheet. Do I have to type them all again?",
    answer:
      "No. Download the template, paste your existing list into it, and upload it. Rentoo checks every row before saving anything, shows you exactly which rows have a problem and why, and imports the rest. Units and tenants both work this way.",
  },
  {
    question: "My tenants pay by M-Pesa. Does that work?",
    answer:
      "Yes. When you record a payment you choose how it came in — M-Pesa, Tigo Pesa, Airtel Money, Halopesa, cash, bank transfer or cheque. Rentoo does not move money itself; it records what you received, so your books match your statements.",
  },
  {
    question: "Can a tenant pay rent in instalments?",
    answer:
      "Yes. Each lease gets one invoice for the full amount, and you record as many payments against it as you need. The invoice shows Unpaid, Partly paid or Paid on its own, and the balance updates as you go — so a tenant paying 200,000 of 750,000 is never lost track of.",
  },
  {
    question: "Who can see my tenants' information?",
    answer:
      "Only you and the people you invite. Every property, tenant, lease and payment belongs to your organisation and is filtered by it on every single request — another landlord using Rentoo cannot see your records, and you cannot see theirs. Passwords are hashed, sign-in attempts are rate limited, and sessions expire.",
  },
  {
    question: "Can my caretaker or manager use it too?",
    answer:
      "Yes. Send them an invite link and they get their own login under your organisation — you never share your password. You can revoke an invitation before it is used, and remove a member at any time.",
  },
  {
    question: "Does it work on my phone?",
    answer:
      "Yes. Rentoo is a website, so there is nothing to install and nothing to update. Every list becomes a card view on a small screen instead of a table you have to scroll sideways.",
  },
  {
    question: "What does it cost?",
    answer:
      "Three packages, priced in TZS. Mikumi is for a landlord with one building, Kilimanjaro for a growing portfolio that needs contracts, SMS and a team, and Serengeti for management companies. Pay yearly and two months are free. You can move up or down a package at any time, and there are no setup or hidden fees.",
  },
] as const;

/* ----------------------------------------------------------------- pricing */

export type BillingPeriod = "monthly" | "yearly";

/**
 * Months a year's subscription pays for. Two of the twelve are free, and that
 * is the entire discount — expressed as a count of months rather than a
 * percentage so the saving stays a round TZS figure at every price point.
 *
 * It is also what converts the stored yearly price into a monthly one: the two
 * figures on the card are one number and this constant, never two numbers that
 * somebody has to keep in step.
 */
export const YEARLY_MONTHS_CHARGED = 10;

export type PricingPlan = {
  /** Carried into the signup URL, and the id a checkout flow will price by. */
  slug: string;
  name: string;
  /** Who the package is for — one line, above the price. */
  audience: string;
  /**
   * What a year costs, paid up front. **This is the figure the packages are
   * priced in**; the monthly rate is derived from it by `monthlyPrice`, not
   * stored, so the two can never drift apart.
   */
  yearlyPrice: number;
  /** Exactly one plan is `featured`; it takes the "Most popular" badge. */
  featured: boolean;
  /**
   * What the package includes, in the order a buyer evaluates it — the
   * countable entitlements among them.
   *
   * Limits live in this one list rather than in a label/value table of their
   * own: the table doubled every card's height, and half of it was dashes
   * saying what the package does *not* do. A package states what it gives you,
   * and what is missing is implied by the "Everything in …" line above the
   * package that adds it.
   */
  features: string[];
};

/**
 * The three packages, named after Tanzanian parks and mountains, ordered small
 * to large.
 *
 * This array is the **single source of pricing on the site**: the cards, the
 * billing toggle and the `SoftwareApplication` offers in the page's JSON-LD all
 * map over it. A price shown to a visitor that differs from the one handed to a
 * search engine is the mismatch this file exists to prevent, and it is also the
 * one a crawler penalises.
 *
 * A higher package always *contains* the one below it, which is why each
 * feature list opens with "Everything in …" rather than repeating the lines
 * above it — the repetition is what makes three columns unreadable on a phone.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    slug: "mikumi",
    name: "Mikumi",
    audience: "For small property owners",
    yearlyPrice: 25_000,
    featured: false,
    features: [
      "1 property, 5 units",
      "Tenant management",
      "Lease management",
      "Invoices and payments",
      "Document storage",
      "Email notifications",
    ],
  },
  {
    slug: "kilimanjaro",
    name: "Kilimanjaro",
    audience: "For growing landlords and property managers",
    yearlyPrice: 65_000,
    featured: true,
    features: [
      "Everything in Mikumi, plus",
      "Unlimited properties, units and team",
      "Lease contract generation",
      "Email and SMS notifications",
      "Automated rent reminders and renewals",
    ],
  },
  {
    slug: "serengeti",
    name: "Serengeti",
    audience: "For property management companies",
    yearlyPrice: 150_000,
    featured: false,
    features: [
      "Everything in Kilimanjaro, plus",
      "Advanced reporting and analytics",
      "Email, SMS and WhatsApp notifications",
      "Maintenance requests",
      "Integrations, backup and restore",
      "Priority support",
      "Secure payments",
    ],
  },
];

/**
 * What one month costs, derived from the year's price rather than stored beside
 * it.
 *
 * The yearly figure buys ten months, so the monthly rate is a tenth of it —
 * 25,000 a year is 2,500 a month, and paying that way for twelve months costs
 * 30,000. Rounded because nothing stops a future annual price dividing
 * untidily, and a rate quoted to the shilling is a rate somebody has to bill.
 */
export function monthlyPrice(plan: PricingPlan): number {
  return Math.round(plan.yearlyPrice / YEARLY_MONTHS_CHARGED);
}

/**
 * What paying yearly saves against twelve monthly payments — the two free
 * months, and how the discount is worded on the page.
 *
 * Computed from the *rounded* monthly rate rather than from
 * `12 - YEARLY_MONTHS_CHARGED`, so the figure shown is always exactly the
 * difference between the two prices on the card, even if a price is one day
 * set to something that does not divide by ten.
 */
export function yearlySaving(plan: PricingPlan): number {
  return monthlyPrice(plan) * 12 - plan.yearlyPrice;
}

/**
 * Thousands separators, pinned to `en-US` grouping rather than the visitor's
 * locale. The cards are rendered on the server and hydrated on the client, and
 * a number that groups differently in the two is a hydration mismatch.
 */
export function formatTzs(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

/**
 * The hosted checkout every "pay us" button leads to — **an external page, on
 * a domain we do not own**, which is the thing to keep in mind about every
 * consequence below: leaving the site is now a step in buying, nothing here
 * can style or validate that page, and money is taken by snippe rather than by
 * this app.
 *
 * A constant rather than an env var because it is a fixed public URL with no
 * per-environment variant — a staging deploy pointing at the same link is
 * correct, since there is no test checkout to point at instead.
 */
export const CHECKOUT_URL = "https://snippe.me/pay/rentoo";

/**
 * Where a package's button goes: the hosted checkout, with the choice the
 * visitor just made riding along as query parameters.
 *
 * The parameters are a **hint, not an instruction** — snippe decides what it
 * does with them, and if it ignores them entirely the visitor simply picks the
 * package there, which is why nothing in the app depends on them arriving.
 * Keeping this as the one function that knows where a package leads is what
 * made swapping registration for a payment link a one-line change rather than
 * six call sites in the pricing card, and it is what will make swapping snippe
 * for something else one too.
 */
export function planCheckoutHref(slug: string, billing: BillingPeriod): string {
  return `${CHECKOUT_URL}?plan=${slug}&billing=${billing}`;
}

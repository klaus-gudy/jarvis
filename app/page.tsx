import type { Metadata } from "next";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingMotionProvider } from "@/components/landing/motion";
import {
  Faq,
  Features,
  FinalCta,
  Footer,
  Hero,
  Pricing,
  WhyUs,
} from "@/components/landing/sections";
import { FAQS, PRICING_PLANS, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

/**
 * The public landing page — the only route reachable signed out other than the
 * auth pages and an invite link.
 *
 * A signed-in visitor never gets here: `proxy.ts` sends them to `/dashboard`,
 * which is also why this file may not read `cookies()`. Staying free of
 * request-time APIs is what lets Next prerender it at build time, so a first-
 * time visitor is served static HTML and a crawler never waits on a render.
 */

const TITLE = `${SITE_NAME} — Property management software for landlords in Tanzania`;

export const metadata: Metadata = {
  /*
   * `absolute` opts out of the root layout's `%s · Rentops` template, which
   * would otherwise append the brand to a title that already opens with it.
   */
  title: { absolute: TITLE },
  description: SITE_TAGLINE,
  keywords: [
    "property management software Tanzania",
    "rent collection software Tanzania",
    "landlord software Dar es Salaam",
    "tenant management system",
    "lease management software",
    "rent tracking M-Pesa",
    "property management app TZS",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_TAGLINE,
    locale: "en_TZ",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_TAGLINE,
  },
};

/**
 * Structured data, as one `@graph` so the three nodes can reference each other
 * rather than repeating the publisher.
 *
 * `FAQPage` is built from the same `FAQS` array the accordion renders — the
 * requirement is that every answer marked up here is visible on the page, and
 * sharing the source is what guarantees it rather than a promise to keep two
 * lists in step.
 */
function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_TAGLINE,
        areaServed: { "@type": "Country", name: "Tanzania" },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        description: SITE_TAGLINE,
        publisher: { "@id": `${SITE_URL}/#organization` },
        /*
         * One `Offer` per package, built from the same `PRICING_PLANS` the
         * cards render. The monthly price is the one quoted: it is what an
         * unqualified "price" means for a subscription, and it is the figure
         * the page shows by default — a search result advertising the
         * discounted yearly total would undercut the card a visitor then lands
         * on.
         */
        offers: PRICING_PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: String(plan.monthlyPrice),
          priceCurrency: "TZS",
          category: "subscription",
        })),
        featureList: [
          "Property management",
          "Tenant management",
          "Lease tracking and renewal",
          "Rent and payment tracking",
          "Invoicing and receipts",
          "Maintenance request tracking",
          "Automated SMS, WhatsApp and email reminders",
          "Mobile-first design",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

export default function LandingPage() {
  return (
    <>
      {/*
       * Motion applies `initial` during SSR, so every revealed block ships as
       * `opacity: 0` and waits for JavaScript to bring it in. With JavaScript
       * off that wait never ends and the page reads as blank — this rule is
       * what makes the content unconditionally visible in that case. It costs
       * nothing when scripting is on, because the browser never applies it.
       */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <LandingMotionProvider>
        <LandingNav />

        {/* `#landing-root` is also the hook globals.css uses to scope smooth scrolling to this page. */}
        <main id="landing-root">
          <Hero />
          <Features />
          <WhyUs />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>

        <Footer />
      </LandingMotionProvider>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
    </>
  );
}

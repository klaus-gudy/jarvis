import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

/**
 * The card that appears when the site is shared on WhatsApp, X, LinkedIn or
 * Slack — which, for a product aimed at landlords in Dar es Salaam, is where
 * most first impressions will happen.
 *
 * Generated rather than checked in as a PNG so it cannot drift from the copy it
 * quotes, and so the brand colours have one definition. Both hexes are the same
 * ones `app/(auth)/layout.tsx` uses, and for the same reason given there: this
 * is rendered outside the document, so there are no theme tokens to read.
 */

export const alt = `${SITE_NAME} — property management for landlords in Tanzania`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#1c2f40";
const GOLD = "#a68446";

/**
 * The logo, inlined.
 *
 * Satori renders `<img>` from a data URI dependably, where support for arbitrary
 * inline `<svg>` children is thinner — and a missing mark on a share card is not
 * something anyone would notice until it was out in the world. Percent-encoded
 * rather than base64 so it stays readable and needs no `Buffer`.
 */
const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="88" height="88">
    <rect width="56" height="56" rx="12" fill="${GOLD}"/>
    <path d="M12.5 42 V27 L28 14 L43.5 27 V42" stroke="#FFFFFF" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M23.6 42 V32 H32.4 V42" stroke="#FFFFFF" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="43.5" cy="27" r="3.65" fill="#d6e4f0"/>
  </svg>`
)}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: NAVY,
          backgroundImage: `radial-gradient(70% 60% at 80% 10%, ${GOLD}40, transparent)`,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Plain <img>: this tree is rendered by satori into a PNG, not by a browser, so next/image has nothing to optimise here. */}
          <img src={MARK} width={88} height={88} alt="" />
          <span style={{ color: "#ffffff", fontSize: 44, fontWeight: 600 }}>
            {SITE_NAME}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#ffffff",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            Property management that tells you who has paid.
          </span>
          <span
            style={{
              marginTop: 28,
              color: "rgba(255,255,255,0.72)",
              fontSize: 30,
              maxWidth: 900,
            }}
          >
            Buildings, tenants, leases and rent in one place — in TZS, for
            landlords in Tanzania.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: GOLD,
            }}
          />
          <span style={{ color: GOLD, fontSize: 26, fontWeight: 600 }}>
            Free while in beta
          </span>
        </div>
      </div>
    ),
    size
  );
}

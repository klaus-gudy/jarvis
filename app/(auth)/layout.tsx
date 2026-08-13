import { BuildingIcon, ReceiptIcon, WrenchIcon } from "lucide-react";

import { RentopsLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Brand colours are fixed hex rather than theme tokens, matching logo.tsx's
 * convention — but the hexes themselves are lifted straight from the app's own
 * palette rather than invented: #1c2f40 is light-mode --primary (what every
 * primary button already looks like) and #a68446 is the gold used by the logo
 * badge, the sidebar accent and the property occupancy bar. The panel is the
 * app's own colours, not a separate mini-brand.
 */
const NAVY = "#1c2f40";
const GOLD = "#a68446";

/**
 * The brand panel reveals a line at a time rather than arriving all at once —
 * mark, headline, blurb, then the three features, then the footer. Reading
 * order and appearance order match, so the eye is led down the panel instead of
 * being handed the whole thing to sort out.
 *
 * `fill-mode-both` is not optional: tw-animate-css leaves `animation-fill-mode`
 * at `none`, so a delayed element would paint at its *final* position for the
 * length of its delay and only then jump back to animate. `both` holds it at
 * the start state until its turn comes.
 *
 * Everything is `motion-safe:`, so under reduced motion the panel simply is
 * where it belongs, with no delay and nothing moving.
 */
const REVEAL =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 duration-700 ease-out fill-mode-both";

/**
 * Written out rather than computed from the index: Tailwind scans source text
 * for candidates, so a class built at runtime (`delay-${n}`) is never generated.
 */
const FEATURE_DELAY = ["delay-450", "delay-550", "delay-650"];

const FEATURES = [
  {
    icon: BuildingIcon,
    text: "Every property, unit and lease in one portfolio",
  },
  {
    icon: ReceiptIcon,
    text: "Rent, invoices and receipts tracked end to end",
  },
  {
    icon: WrenchIcon,
    text: "Maintenance routed to the right technician, fast",
  },
] as const;

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel — hidden on small screens, where AuthHeader carries the logo. */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{ backgroundColor: NAVY }}
      >
        {/* The glow washes in on its own, slower and undelayed, so the panel is
            lit before anything lands on it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 motion-safe:animate-in motion-safe:fade-in-0 duration-1000 fill-mode-both"
          style={{
            background: `radial-gradient(90% 70% at 75% 15%, ${GOLD}26, transparent)`,
          }}
        />

        <div
          className={cn(
            "relative flex items-center gap-2.5 text-lg font-semibold tracking-tight",
            REVEAL,
            "delay-75"
          )}
        >
          <RentopsLogo className="size-9" />
          Rentops
        </div>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <p
              className={cn(
                "text-4xl font-semibold leading-tight tracking-tight text-balance",
                REVEAL,
                "delay-200"
              )}
            >
              Property management,{" "}
              <span style={{ color: GOLD }}>the calm way.</span>
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed text-white/75",
                REVEAL,
                "delay-300"
              )}
            >
              Sign in to manage your portfolio — buildings, tenants, billing and
              maintenance, all from one place.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.text}
                className={cn(
                  "flex items-center gap-4",
                  REVEAL,
                  FEATURE_DELAY[index]
                )}
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${GOLD}26` }}
                >
                  <feature.icon
                    className="size-5"
                    style={{ color: GOLD }}
                    aria-hidden
                  />
                </span>
                <span className="text-sm text-white/90">{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p
          className={cn("relative text-xs text-white/50", REVEAL, "delay-800")}
        >
          © {new Date().getFullYear()} Rentops · Dar es Salaam
        </p>
      </aside>

      <main className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

import { BuildingIcon, ReceiptIcon, WrenchIcon } from "lucide-react";

import { RentopsLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(90% 70% at 75% 15%, ${GOLD}26, transparent)`,
          }}
        />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <RentopsLogo className="size-9" />
          Rentops
        </div>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-balance">
              Property management,{" "}
              <span style={{ color: GOLD }}>the calm way.</span>
            </p>
            <p className="text-sm leading-relaxed text-white/75">
              Sign in to manage your portfolio — buildings, tenants, billing and
              maintenance, all from one place.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-4">
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

        <p className="relative text-xs text-white/50">
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

import { BuildingIcon, ReceiptIcon, WrenchIcon } from "lucide-react";

import { NyumbaLogo } from "@/components/logo";

/**
 * Brand colours are fixed rather than theme tokens (the logo.tsx convention):
 * the panel must stay deep green with the gold accent in both light and dark
 * mode. The right side uses theme tokens so the forms follow the app theme.
 */
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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0b4a36] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_75%_15%,rgba(255,255,255,0.09),transparent)]"
        />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <NyumbaLogo className="size-9" />
          Nyumba
        </div>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-balance">
              Property management,{" "}
              <span className="text-[#e8c547]">the calm way.</span>
            </p>
            <p className="text-sm leading-relaxed text-white/75">
              Sign in to manage your portfolio — buildings, tenants, billing and
              maintenance, all from one place.
            </p>
          </div>

          <ul className="space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm text-white/90">{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Nyumba PMS · Dar es Salaam
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

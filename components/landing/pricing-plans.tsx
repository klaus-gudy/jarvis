"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatTzs,
  planCheckoutHref,
  PRICING_PLANS,
  yearlyPrice,
  yearlySaving,
  type BillingPeriod,
  type PricingPlan,
} from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The three packages and the monthly/yearly switch above them.
 *
 * A client island only because the switch is state the whole grid reads. The
 * prices themselves come from `PRICING_PLANS` and are rendered on the server
 * like the rest of the page — a visitor with JavaScript disabled still sees
 * every package and every monthly price, and only loses the ability to flip to
 * yearly. That is why `monthly` is the initial state rather than the discounted
 * option: the fallback has to be the price actually charged by default.
 *
 * Yearly deliberately shows the **year's** total and the saving, never a
 * per-month equivalent. "20,833 TZS/month, billed annually" is a number nobody
 * is ever charged, and pricing pages that lead with it are the reason buyers
 * distrust the toggle.
 */

const BILLING_OPTIONS: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function BillingToggle({
  billing,
  onChange,
}: {
  billing: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/*
       * A radiogroup rather than a switch: a switch is on or off, and "yearly"
       * is not the "on" state of "monthly" — they are two choices of equal
       * standing, which is also what lets each one be reachable by name to a
       * screen reader.
       */}
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border bg-card p-1"
      >
        {BILLING_OPTIONS.map(({ value, label }) => {
          const selected = billing === value;

          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(value)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                selected
                  ? "bg-[var(--stat)] text-[var(--stat-foreground)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Pay yearly and{" "}
        <span className="font-medium text-foreground">two months are free</span>.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  billing,
}: {
  plan: PricingPlan;
  billing: BillingPeriod;
}) {
  const yearly = billing === "yearly";
  const price = yearly ? yearlyPrice(plan) : plan.monthlyPrice;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm sm:p-7",
        /*
         * The featured card is marked by a ring and a badge, not by being
         * larger or darker. Scaling one column up leaves the other two reading
         * as the consolation prizes, which costs more sales than the highlight
         * wins.
         */
        plan.featured && "border-[var(--stat-accent)] ring-1 ring-[var(--stat-accent)]"
      )}
    >
      {plan.featured ? (
        <span className="absolute -top-3 left-6 rounded-full bg-[var(--stat-accent)] px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
          Most popular
        </span>
      ) : null}

      <h3 className="font-heading text-xl font-semibold tracking-tight">
        {plan.name}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
        {plan.audience}
      </p>

      <div className="mt-6">
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
            {formatTzs(price)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">TZS</span>
        </div>

        {/*
         * Fixed height so the three cards' feature lists stay on one line with
         * each other as the toggle moves — without it the grid jumps by the
         * height of the saving line every time someone flips the switch.
         */}
        <p className="mt-1 h-5 text-sm text-muted-foreground">
          {yearly ? (
            <>
              per year ·{" "}
              <span className="font-medium text-[var(--stat-accent)]">
                save {formatTzs(yearlySaving(plan))} TZS
              </span>
            </>
          ) : (
            "per month"
          )}
        </p>
      </div>

      <div className="mt-6">
        <Button
          render={<Link href={planCheckoutHref(plan.slug, billing)} />}
          nativeButton={false}
          variant={plan.featured ? "default" : "outline"}
          className={cn(
            "h-11 w-full gap-2 text-base",
            plan.featured
              ? "bg-[var(--stat-accent)] text-white hover:bg-[var(--stat-accent)]/90"
              : "border-primary/40 text-primary hover:border-primary hover:text-primary dark:border-primary/50"
          )}
        >
          Choose {plan.name}
          <ArrowRightIcon />
        </Button>
      </div>

      <ul className="mt-7 space-y-3 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon
              className="mt-0.5 size-4 shrink-0 text-[var(--stat-accent)]"
              aria-hidden
            />
            <span className="leading-snug text-pretty">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingPlans() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  return (
    <>
      <div className="mt-10 flex justify-center">
        <BillingToggle billing={billing} onChange={setBilling} />
      </div>

      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.slug} plan={plan} billing={billing} />
        ))}
      </div>
    </>
  );
}

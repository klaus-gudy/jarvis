import Link from "next/link";
import {
  ArrowRightIcon,
  BanknoteIcon,
  BuildingIcon,
  CalendarClockIcon,
  CheckIcon,
  DoorOpenIcon,
  FileSpreadsheetIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { HeroContrast } from "@/components/landing/hero-contrast";
import { LandingFaq } from "@/components/landing/faq";
import { HoverLift, Reveal, Stagger, StaggerItem } from "@/components/landing/motion";
import { RentopsLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { NAV_SECTIONS } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The page's content, as server components.
 *
 * Only the motion wrappers, the preview and the FAQ accordion are client code —
 * every word here is rendered on the server and sits in the HTML a crawler is
 * served, rather than being assembled after hydration.
 *
 * **Nothing on this page claims a capability the app does not have.** Each
 * feature line maps to shipped behaviour, and there is deliberately no
 * testimonial, customer count or "trusted by" figure, because there is nobody
 * to quote yet. If that changes, add real names — do not soften an invented one.
 */

/* ------------------------------------------------------------------ shared */

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      /*
       * `scroll-mt-24` clears the fixed header when a nav link jumps here. The
       * generous vertical rhythm is the main defence against the page feeling
       * like work to read: one idea per screen, with room around it.
       */
      className={cn("scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28", className)}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--stat-accent)] uppercase">
        {eyebrow}
      </p>
      <h2 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {blurb ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
          {blurb}
        </p>
      ) : null}
    </Reveal>
  );
}

/* -------------------------------------------------------------------- hero */

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24">
      {/* A single warm wash behind the fold, so the page opens on something. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(70%_55%_at_50%_0%,var(--stat-accent),transparent)] opacity-[0.13]"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal delay={0.05}>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              Property management that tells you{" "}
              <span className="text-[var(--stat-accent)]">who has paid.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Rentops keeps every building, unit, tenant, lease and payment in
              one place — priced in TZS, paid by M-Pesa, Tigo Pesa, Airtel Money
              or cash. Made for landlords in Tanzania.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                render={<Link href="/register" />}
                nativeButton={false}
                className="h-12 gap-2 px-6 text-base"
              >
                Get started free
                <ArrowRightIcon />
              </Button>
              <Button
                variant="outline"
                render={<Link href="#features" />}
                nativeButton={false}
                className="h-12 border-primary/40 px-6 text-base text-primary hover:border-primary hover:text-primary dark:border-primary/50"
              >
                See what you get
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No card needed", "Works on your phone", "Your data stays yours"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-[var(--stat-accent)]" />
                    {item}
                  </li>
                )
              )}
            </ul>
          </Reveal>
        </div>

        {/*
         * Desktop only, and `lg` specifically because that is where the hero
         * becomes two columns — below it the graphic stacks under the copy,
         * which pushes the CTAs up the page and turns the first screen into
         * scrolling rather than an offer. The headline and buttons carry the
         * hero on a phone; the contrast is a supporting argument, not the point.
         *
         * A CSS `hidden` rather than `useIsMobile`: that hook reports desktop on
         * the server, so the graphic would render and then vanish on hydration.
         */}
        <HeroContrast className="hidden lg:block lg:pl-4" />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- problem */

const PROBLEMS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageCircleIcon,
    title: "Rent chased on WhatsApp",
    body: "You remember who paid last month. Probably. And the month before that?",
  },
  {
    icon: CalendarClockIcon,
    title: "A lease ended and nobody noticed",
    body: "The tenant is still in the unit. The agreement ran out in March.",
  },
  {
    icon: DoorOpenIcon,
    title: "Which units are empty right now?",
    body: "You have to count them. Every time somebody asks. Including you.",
  },
];

export function Problem() {
  return (
    <Section className="border-y bg-card/40">
      <SectionHeading
        eyebrow="Sound familiar?"
        title="Managing buildings shouldn't mean managing notebooks."
      />

      <Stagger className="mt-14 grid gap-5 sm:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, body }) => (
          <StaggerItem key={title}>
            <div className="h-full rounded-xl border bg-card p-6">
              <Icon className="size-6 text-muted-foreground" aria-hidden />
              <h3 className="font-heading mt-4 text-base font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.15}>
        <p className="mt-12 text-center text-lg font-medium text-balance">
          Rentops answers all three on one screen.
        </p>
      </Reveal>
    </Section>
  );
}

/* ---------------------------------------------------------------- features */

/**
 * `wide` is only set on the import card, and it is doing real work rather than
 * decorating the grid. "I am not retyping every tenant" is the objection that
 * stops a landlord signing up, so it gets the full row — and it also squares
 * the layout, since seven cards across three columns would otherwise leave the
 * last one stranded beside two gaps.
 */
const FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
  wide?: boolean;
  proof?: string[];
}[] = [
  {
    icon: BuildingIcon,
    title: "Buildings and units",
    body: "Every property, and every unit inside it — rent, size, floor, block, minimum tenure and amenities.",
  },
  {
    icon: UsersIcon,
    title: "Tenants and leases",
    body: "Who is in which unit, and until when. Each tenant's status works itself out: active, upcoming or moved on.",
  },
  {
    icon: ReceiptIcon,
    title: "Invoices and part-payments",
    body: "One invoice per lease, and as many payments against it as it takes. Unpaid, partly paid or paid — kept current for you.",
  },
  {
    icon: WalletIcon,
    title: "Money, at a glance",
    body: "Rent collected this year, what is still outstanding, and exactly what your empty units are costing you each month.",
  },
  {
    icon: CalendarClockIcon,
    title: "Nothing slips past you",
    body: "Leases expiring, renewals due and move-ins coming up, on the dashboard. Units you choose can renew themselves.",
  },
  {
    icon: SearchIcon,
    title: "Find anything, instantly",
    body: "One search box across properties, units, tenants, leases and payments. Search a phone number, get the tenant.",
  },
  {
    icon: FileSpreadsheetIcon,
    title: "Bring the list you already have",
    body: "You are not typing your tenants in one by one. Download the template, paste your existing spreadsheet into it, and upload.",
    wide: true,
    proof: [
      "Every row checked before anything is saved",
      "A bad phone number is named, with its row",
      "Units and tenants both work this way",
    ],
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="What you get"
        title="Everything a landlord needs. Nothing else."
        blurb="They all feed the same screen. There is no module to configure and no training to sit through."
      />

      <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body, wide, proof }) => (
          <StaggerItem
            key={title}
            className={cn(wide && "sm:col-span-2 lg:col-span-3")}
          >
            <HoverLift>
              <div
                className={cn(
                  "h-full rounded-xl border bg-card p-6 shadow-sm",
                  wide && "border-[var(--stat-accent)]/40 sm:p-8"
                )}
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--stat-accent),transparent_88%)]">
                  <Icon className="size-5 text-[var(--stat-accent)]" aria-hidden />
                </span>
                <h3
                  className={cn(
                    "font-heading mt-5 font-semibold",
                    wide ? "text-xl" : "text-base"
                  )}
                >
                  {title}
                </h3>
                <p
                  className={cn(
                    "mt-2 leading-relaxed text-muted-foreground",
                    wide ? "max-w-2xl" : "text-sm"
                  )}
                >
                  {body}
                </p>

                {proof ? (
                  <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                    {proof.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckIcon
                          className="mt-0.5 size-4 shrink-0 text-[var(--stat-accent)]"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </HoverLift>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ---------------------------------------------------------------- security */

const ASSURANCES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheckIcon,
    title: "Your organisation, and only yours",
    body: "Every property, tenant, lease and payment belongs to your organisation and is filtered by it on every single request. Another landlord using Rentops cannot see your records.",
  },
  {
    icon: UserPlusIcon,
    title: "Your team, on their own logins",
    body: "Invite a manager or caretaker by link and they get their own account under your organisation. Nobody shares a password. Revoke an invite before it is used, or remove a member later.",
  },
  {
    icon: LockKeyholeIcon,
    title: "Passwords are never stored",
    body: "Only an irreversible hash of one. Sign-in attempts are rate limited per account as well as per address, so guessing at your password is slow going, and sessions expire on their own.",
  },
  {
    icon: BanknoteIcon,
    title: "We never touch your money",
    body: "Rentops records the rent you have received; it does not collect it. There is no bank account to connect and no card to hand over — so there is nothing of that kind here to lose.",
  },
];

export function Security() {
  return (
    /*
     * Picked up the shaded band that the removed "How it works" section used to
     * carry. The page alternates plain and shaded sections so each one reads as
     * a separate idea; without this, Features and Security would run together
     * as one long stretch of page background.
     */
    <Section id="security" className="border-y bg-card/40">
      <SectionHeading
        eyebrow="Your data"
        title="Your tenants' details stay yours."
        blurb="Asking a landlord to type in other people's names and phone numbers is asking for trust. Here is precisely what happens to them."
      />

      <Stagger className="mt-14 grid gap-5 sm:grid-cols-2">
        {ASSURANCES.map(({ icon: Icon, title, body }) => (
          <StaggerItem key={title}>
            <div className="flex h-full gap-4 rounded-xl border bg-card p-6">
              <Icon
                className="mt-0.5 size-5 shrink-0 text-[var(--stat-accent)]"
                aria-hidden
              />
              <div>
                <h3 className="font-heading text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ----------------------------------------------------------------- pricing */

export function Pricing() {
  return (
    /* No band of its own — the navy slab inside is already its own surface. */
    <Section id="pricing">
      <Reveal className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border bg-[var(--stat)] p-8 text-center text-[var(--stat-foreground)] shadow-xl sm:p-12">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--stat-accent)] uppercase">
            Pricing
          </p>

          <h2 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Free while we are in beta.
          </h2>

          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[var(--stat-foreground)]/75 text-pretty">
            Every feature, however many properties, units and tenants you have.
            No card, and no countdown running in the corner.
          </p>

          <ul className="mx-auto mt-8 flex max-w-lg flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
            {[
              "All features included",
              "Unlimited properties",
              "Unlimited tenants",
              "No card required",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-[var(--stat-accent)]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9">
            <Button
              render={<Link href="/register" />}
              nativeButton={false}
              className="h-12 gap-2 bg-[var(--stat-accent)] px-6 text-base text-white"
            >
              Create your free account
              <ArrowRightIcon />
            </Button>
          </div>

          <p className="mt-5 text-xs text-[var(--stat-foreground)]/60">
            When paid plans arrive you will hear about it well in advance — and
            your data will still be yours.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------------------- faq */

export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading
        eyebrow="Questions"
        title="The things landlords ask first."
      />

      <Reveal className="mx-auto mt-12 max-w-3xl">
        <LandingFaq />
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------------- final cta */

export function FinalCta() {
  return (
    <Section className="border-t">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Start with one building.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
          You do not have to move everything at once. Add one property, one unit
          and one tenant, and see whether it earns its place.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            render={<Link href="/register" />}
            nativeButton={false}
            className="h-12 gap-2 px-6 text-base"
          >
            Get started free
            <ArrowRightIcon />
          </Button>
          <Button
            variant="outline"
            render={<Link href="/login" />}
            nativeButton={false}
            className="h-12 border-primary/40 px-6 text-base text-primary hover:border-primary hover:text-primary dark:border-primary/50"
          >
            I already have an account
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ footer */

export function Footer() {
  return (
    <footer className="border-t bg-card/40 px-4 py-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <span className="inline-flex items-center gap-2.5">
            <RentopsLogo className="size-8" />
            <span className="font-heading text-lg font-semibold tracking-tight">
              Rentops
            </span>
          </span>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Property management for landlords in Tanzania — buildings, tenants,
            leases and rent, in one place.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2.5 text-sm">
          {NAV_SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5 text-sm">
          <Link
            href="/login"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="font-medium text-foreground transition-colors hover:text-[var(--stat-accent)]"
          >
            Get started free
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl border-t pt-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rentops · Dar es Salaam, Tanzania
        </p>
      </div>
    </footer>
  );
}

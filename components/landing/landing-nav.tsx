"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { m, useMotionValueEvent, useScroll, useSpring } from "motion/react";

import { RentopsLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_SECTIONS } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The public site's header.
 *
 * Three things make it navigable rather than decorative, and each is doing a
 * job:
 *
 * 1. **A progress hairline** along its bottom edge, so the page's length is
 *    legible at a glance — the honest answer to "how much more of this is
 *    there?", which a long marketing page owes the reader.
 * 2. **A pill that slides between links** as you scroll, so the header always
 *    reports where you are instead of only where you can go.
 * 3. **It only takes a background once you've left the top**, so the hero is
 *    uninterrupted but the links never sit on top of live content.
 */

/**
 * A horizontal band across the upper-middle of the viewport. A section is
 * "current" while it crosses the band, which is far steadier than measuring
 * distance to the top — no jitter as headings pass, and no section can win by
 * being taller. Every section here clears 30vh, so none can slip through it.
 */
const SPY_BAND = "-15% 0px -55% 0px";

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { scrollY, scrollYProgress } = useScroll();

  /*
   * Springing the raw progress keeps the bar from twitching on trackpad
   * momentum. `restDelta` lets it actually settle instead of animating
   * imperceptibly forever.
   */
  const progress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    restDelta: 0.001,
  });

  /*
   * A motion event rather than a scroll listener with state: this runs off
   * motion's single rAF loop, and `setScrolled` with an unchanged boolean is a
   * no-op in React, so a whole page of scrolling costs two renders — one at the
   * threshold going down, one coming back.
   */
  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 16);
  });

  useEffect(() => {
    const sections = NAV_SECTIONS.map(({ id }) =>
      document.getElementById(id)
    ).filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) return;

    /*
     * The observer reports changes, not the current set, so membership is
     * accumulated here. Resolving through `NAV_SECTIONS` rather than the
     * entries means that when two sections share the band the earlier one
     * wins — the indicator moves down the page in order and never jumps back.
     */
    const inBand = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActiveId(NAV_SECTIONS.find(({ id }) => inBand.has(id))?.id ?? null);
      },
      { rootMargin: SPY_BAND }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        scrolled
          ? "border-border/70 bg-background/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      )}
    >
      {/* Reading progress. Purely informational, so it is hidden from the tree. */}
      <m.div
        aria-hidden
        style={{ scaleX: progress }}
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--stat-accent)]"
      />

      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RentopsLogo className="size-8" />
          <span className="font-heading">Rentoo</span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center lg:flex">
          {NAV_SECTIONS.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/*
                 * One element shared across five links by `layoutId` — motion
                 * animates it from the old link's box to the new one, so the
                 * indicator travels instead of blinking. This is the single
                 * reason the feature bundle is `domMax`.
                 */}
                {isActive && (
                  <m.span
                    layoutId="landing-nav-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary/10 dark:bg-primary/15"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{label}</span>
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          <Button
            variant="outline"
            render={<Link href="/login" />}
            nativeButton={false}
            className="hidden border-primary/40 text-primary hover:border-primary hover:text-primary dark:border-primary/50 sm:inline-flex"
          >
            Sign in
          </Button>

          <Button
            render={<Link href="/register" />}
            nativeButton={false}
            className="hidden h-9 px-4 sm:inline-flex"
          >
            Get started
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" />}
              className="lg:hidden"
            >
              <MenuIcon />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>

            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <RentopsLogo className="size-7" />
                  Rentoo
                </SheetTitle>
              </SheetHeader>

              <nav aria-label="Sections" className="flex flex-col px-4">
                {NAV_SECTIONS.map(({ id, label }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-3 text-base font-medium transition-colors",
                      activeId === id
                        ? "bg-primary/10 text-primary dark:bg-primary/15"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {label}
                  </a>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2 border-t p-4">
                <Button
                  render={<Link href="/register" />}
                  nativeButton={false}
                  className="h-10 w-full"
                  onClick={() => setOpen(false)}
                >
                  Get started free
                </Button>
                <Button
                  variant="outline"
                  render={<Link href="/login" />}
                  nativeButton={false}
                  className="h-10 w-full border-primary/40 text-primary hover:border-primary hover:text-primary dark:border-primary/50"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

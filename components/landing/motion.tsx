"use client";

import { LazyMotion, MotionConfig, m, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The landing page's motion primitives.
 *
 * Everything here takes `children` and renders them untouched, so the copy
 * itself stays in server components: the wrapper is the only thing that ships
 * to the browser, and the text is in the server HTML for crawlers rather than
 * being assembled on the client.
 *
 * `strict` on `LazyMotion` makes a stray `motion.div` throw instead of silently
 * dragging the full bundle back in — the whole point of the split, enforced
 * rather than left to memory. Only `m.*` compiles under it.
 *
 * `reducedMotion="user"` is the accessible default: under
 * `prefers-reduced-motion` motion drops every transform and layout animation
 * and keeps opacity, so content still arrives without anything sliding.
 */

const loadFeatures = () =>
  import("./motion-features").then((mod) => mod.default);

/**
 * The same curve as the auth-page ripple (`cubic-bezier(.22,1,.36,1)`): most of
 * the travel happens immediately, then it spreads and settles. Reused rather
 * than re-picked so motion across the app reads as one hand.
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Viewport trigger shared by every reveal, so nothing fires at a different depth. */
const VIEWPORT = { once: true, amount: 0.25 } as const;

export function LandingMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/**
 * Two variant sets, differing only in where the delay comes from — and that
 * difference is the whole reason they aren't one.
 *
 * A variant's own `transition` beats the component's `transition` prop, so
 * writing `transition={{ delay }}` alongside a variant that already declares
 * one gets the delay silently dropped. `Reveal` therefore takes its delay
 * through `custom`, which is the mechanism built for exactly this.
 *
 * `StaggerItem` must *not* declare a delay: a container's `staggerChildren`
 * schedules its children by setting that same field, so naming it here — even
 * as `0` — would overwrite the stagger and land every item at once.
 */
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay },
  }),
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/**
 * One block that fades and lifts as it comes into view.
 *
 * `data-reveal` is not decorative — it is what the `<noscript>` rule on the
 * page targets to force these back to `opacity: 1`. Motion applies `initial`
 * during SSR, so without that rule a visitor with JavaScript off would be
 * served a page of invisible sections.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <m.div
      data-reveal
      className={className}
      variants={revealVariants}
      custom={delay}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
    >
      {children}
    </m.div>
  );
}

const staggerVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

/**
 * A list whose children arrive one after another rather than as a slab.
 *
 * The container carries no visual change of its own — it only owns the timing,
 * so it must not be given `data-reveal`; the items each have their own.
 */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={staggerVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div data-reveal className={className} variants={staggerItemVariants}>
      {children}
    </m.div>
  );
}

/**
 * A card that lifts slightly under the pointer. `whileHover` rather than a CSS
 * `:hover` transition because motion interrupts correctly: moving off
 * mid-animation eases back from wherever it got to, where CSS restarts from the
 * end state. `whileTap` gives touch users the same acknowledgement.
 */
export function HoverLift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={cn("h-full", className)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      {children}
    </m.div>
  );
}

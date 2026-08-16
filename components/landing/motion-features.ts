/**
 * The animation feature bundle, in its own module so it lands in its own chunk.
 *
 * `LazyMotion` is given a loader that dynamically imports this file, which is
 * what keeps the ~30kb feature set out of the initial payload — the landing
 * page paints from a ~5kb `m` runtime and pulls the rest in behind it. Written
 * as a separate module rather than `import("motion/react").then(m => m.domMax)`
 * because that form re-imports a module the entry chunk already depends on, and
 * bundlers are free to merge it back in.
 *
 * `domMax` rather than the lighter `domAnimation`: the nav's active-section
 * indicator slides between links via a shared `layoutId`, and layout animations
 * are the one thing `domAnimation` leaves out.
 */
import { domMax } from "motion/react";

export default domMax;

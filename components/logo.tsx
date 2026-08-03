import { cn } from "@/lib/utils";

/** Brand colours live here rather than in the theme: the mark must read the same on every surface. */
const BLUE = "#d6e4f0";
const GOLD = "#a68446";

/**
 * The Nyumba mark — a gabled house with a gold eave accent.
 *
 * Sized by `className` rather than width/height attributes, because any svg
 * inside a SidebarMenuButton is clamped to size-4 by the sidebar's
 * `[&_svg]:size-4` rule; only a class (with `!`) can win that.
 */
export function NyumbaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 56"
      className={cn("size-8 shrink-0", className)}
      role="img"
      aria-label="Nyumba"
    >
      <rect width="56" height="56" rx="12" fill={GOLD} />
      <path
        d="M12.5 42 V27 L28 14 L43.5 27 V42"
        stroke="#FFFFFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M23.6 42 V32 H32.4 V42"
        stroke="#FFFFFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="43.5" cy="27" r="3.65" fill={BLUE} />
    </svg>
  );
}

/**
 * Mark plus wordmark, for surfaces with no other branding (login, register,
 * invite). The name is real text rather than an svg <text> node so it uses the
 * app's font and inherits the current colour instead of hard-coding white.
 */
export function NyumbaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NyumbaLogo className="size-9" />
      <span className="text-xl font-semibold tracking-tight">Nyumba</span>
    </span>
  );
}

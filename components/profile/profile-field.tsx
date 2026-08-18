import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A labelled value styled to sit in a form grid, matching the input rhythm
 * without being one.
 *
 * Deliberately a div and not a `disabled` input: this is display, not a
 * control the user is temporarily locked out of, and a disabled input is
 * skipped by keyboard navigation and announced as unavailable rather than
 * simply read out. Editing happens in the dialog behind "Edit profile".
 *
 * A missing value gets the italic-muted treatment placeholders use everywhere
 * else (Phase 29), so "Not set" can't be mistaken for stored content.
 */
export function ProfileField({
  label,
  value,
  icon: Icon,
  required = false,
  className,
}: {
  label: string;
  value: string | null | undefined;
  icon: LucideIcon;
  required?: boolean;
  className?: string;
}) {
  return (
    // A <dl> pair, not a Field + FieldLabel: FieldLabel renders a real <label>,
    // and a label with no control to point at is a dangling association.
    <div className={cn("grid gap-2", className)}>
      <dt className="flex items-center gap-2 text-sm leading-none font-medium">
        {label}
        {required && (
          // Decorative — it echoes the dialog's required marker so the two
          // views of the same field agree.
          <span aria-hidden="true" className="-ml-1.5 text-destructive">
            *
          </span>
        )}
      </dt>
      <dd className="flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2 text-sm dark:bg-input/30">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span
          className={cn("truncate", !value && "italic text-muted-foreground/60")}
        >
          {value || "Not set"}
        </span>
      </dd>
    </div>
  );
}

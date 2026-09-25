import type { LucideIcon } from "lucide-react";

import { CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The header every card on the profile page uses, so the four stay the same
 * height whether or not they carry an action.
 *
 * Two classes on the action are what make that true, and both are needed:
 *
 * `-my-1` — `CardHeader` is a grid whose row grows to its tallest item, and a
 * `size="sm"` button is 28px against a 22px title line. The negative margin
 * pulls the button's *layout* height back under the title's, so the title
 * governs; the button still renders and hit-tests at its full 28px.
 *
 * `row-span-1` — `CardAction` ships `row-span-2` for the case where a
 * description sits under the title. With no description there is only one real
 * row, so the span invents an implicit second one and the grid's `gap-1` adds
 * 4px of nothing. Together: 45px → 43px → 39px, matching the plain headers.
 */
export function ProfileCardHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="border-b">
      <CardTitle className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        {title}
      </CardTitle>
      {action && (
        <CardAction className="row-span-1 -my-1">{action}</CardAction>
      )}
    </CardHeader>
  );
}

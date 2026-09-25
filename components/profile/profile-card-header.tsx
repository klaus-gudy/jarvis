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
  stackAction = false,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /**
   * For an action too wide to share a phone-width row with its title — the
   * Organization card's two data buttons beside a two-word title ran off the
   * card. Below 28rem *of card width* (a container query, so it follows the
   * card rather than the screen) the action drops to its own full-width row
   * under the title; wider, it sits beside it like every other header.
   */
  stackAction?: boolean;
}) {
  return (
    <CardHeader className="border-b">
      <CardTitle className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        {title}
      </CardTitle>
      {action && (
        <CardAction
          className={cn(
            "row-span-1 -my-1",
            stackAction &&
              "@max-md/card-header:col-span-2 @max-md/card-header:col-start-1 @max-md/card-header:row-start-2 @max-md/card-header:mt-2 @max-md/card-header:mb-0 @max-md/card-header:justify-self-stretch"
          )}
        >
          {action}
        </CardAction>
      )}
    </CardHeader>
  );
}

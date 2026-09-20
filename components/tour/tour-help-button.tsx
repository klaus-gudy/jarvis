"use client";

import { CircleQuestionMarkIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { useTour } from "@/components/tour/tour-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOURS } from "@/lib/tours";

/**
 * Replays the current page's tour, or clears every tour so they greet their
 * pages again. Sits beside the theme toggle because both are "how this app
 * behaves for me" controls rather than anything to do with the data on screen.
 */
export function TourHelpButton({ className }: { className?: string }) {
  const { availableTour, restartCurrent, resetAll } = useTour();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            data-tour="tour-help"
            aria-label="Help and tours"
            className={className}
          >
            <CircleQuestionMarkIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="w-60">
        {/* Base UI requires a label to sit inside a group — outside one it
            throws for a missing MenuGroupContext. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Guided tours
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {/* Kept in place and disabled rather than hidden on a page with no
            tour, so the menu doesn't change shape as you move around. */}
        <DropdownMenuItem onClick={restartCurrent} disabled={!availableTour}>
          <PlayIcon />
          {availableTour ? availableTour.label : "No tour on this page"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            resetAll();
            toast.success("Tours reset", {
              description: `All ${TOURS.length} tours will show again as you visit each page.`,
            });
          }}
        >
          <RotateCcwIcon />
          Reset all tours
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

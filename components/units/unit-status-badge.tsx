import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Occupied/Vacant, plus "Inactive" when the unit (or its property) is out of
 * tracking — the same pair in the unit tables and their phone cards.
 */
export function UnitStatusBadge({
  status,
  active,
  className,
}: {
  status: "Occupied" | "Vacant";
  active: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Badge
        variant={status === "Occupied" ? "secondary" : "outline"}
        className="rounded-full font-normal"
      >
        {status}
      </Badge>
      {!active && (
        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
          Inactive
        </Badge>
      )}
    </span>
  );
}

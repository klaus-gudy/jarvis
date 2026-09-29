"use client";

import Link from "next/link";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatCurrencyFull } from "@/lib/format";

export type UnitPreview = {
  label: string;
  propertyName: string;
  unitType: string | null;
  sizeSqm: number | null;
  rentAmount: number;
  floor: string | null;
  block: string | null;
};

/**
 * A unit label that previews the unit's spec and asking rent on hover, and
 * opens the unit page on click. Pass `href` only when the viewer holds
 * `property:read`. `children` replaces the visible label where the cell adds
 * to it, e.g. "A1 (past)".
 */
export function UnitHoverCard({
  unit,
  href,
  className,
  align = "start",
  children,
}: {
  unit: UnitPreview;
  href: string | null;
  className?: string;
  align?: "start" | "center" | "end";
  children?: React.ReactNode;
}) {
  const label = children ?? unit.label;
  if (!href) return <span className={className}>{label}</span>;

  const rows = [
    ["Type", unit.unitType],
    ["Size", unit.sizeSqm != null ? `${unit.sizeSqm} m²` : null],
    ["Block", unit.block],
    ["Floor", unit.floor],
  ].filter((row): row is [string, string] => row[1] != null && row[1] !== "");

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        render={<Link href={href} className={className} />}
      >
        {label}
      </HoverCardTrigger>
      <HoverCardContent align={align} className="w-64 space-y-3 p-3 text-left">
        <div>
          <p className="truncate font-medium">Unit {unit.label}</p>
          <p className="truncate text-xs text-muted-foreground">{unit.propertyName}</p>
        </div>
        <dl className="space-y-1.5 text-xs">
          {rows.map(([term, value]) => (
            <div key={term} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Rent</dt>
            <dd className="font-mono tabular-nums">
              {formatCurrencyFull(unit.rentAmount)}/mo
            </dd>
          </div>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

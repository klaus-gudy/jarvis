"use client";

import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export type PropertyPreview = {
  name: string;
  address: string;
  category: string;
  type: "RESIDENTIAL" | "COMMERCIAL";
};

/**
 * A property name that previews where and what it is on hover, and opens the
 * property on click. Pass `href` only when the viewer holds `property:read`;
 * without it this is the bare name.
 */
export function PropertyHoverCard({
  property,
  href,
  className,
  align = "start",
}: {
  property: PropertyPreview;
  href: string | null;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  if (!href) return <span className={className}>{property.name}</span>;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        render={<Link href={href} className={className} />}
      >
        {property.name}
      </HoverCardTrigger>
      <HoverCardContent align={align} className="w-72 space-y-2 p-3 text-left">
        <div>
          <p className="truncate font-medium">{property.name}</p>
          <p className="text-xs text-muted-foreground">
            {property.category} ·{" "}
            {property.type === "COMMERCIAL" ? "Commercial" : "Residential"}
          </p>
        </div>
        <p className="flex items-start gap-2 text-xs">
          <MapPinIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
          <span>{property.address}</span>
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

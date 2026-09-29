"use client";

import Link from "next/link";
import { MailIcon, PhoneIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { initials } from "@/lib/user-display";

export type TenantPreview = {
  name: string;
  phone: string | null;
  email: string | null;
  photoId?: string | null;
  /** One short line under the name, e.g. "Unit A1 · Morogoro estate". */
  context?: string | null;
};

/**
 * A tenant's name as a link to their member page that, on hover, shows who
 * they are and how to reach them — so a phone number is a glance away instead
 * of a page away. Callers pass `href` only when the viewer may open that page;
 * without it this is plain text, never a card, so a role that can't read
 * tenants doesn't see their contact details here either.
 */
export function TenantHoverCard({
  tenant,
  href,
  className,
  align = "end",
}: {
  tenant: TenantPreview;
  href: string | null;
  className?: string;
  /** `end` suits a right-aligned detail row, `start` a table cell. */
  align?: "start" | "center" | "end";
}) {
  if (!href) return <span className={className}>{tenant.name}</span>;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        render={<Link href={href} className={className} />}
      >
        {tenant.name}
      </HoverCardTrigger>
      <HoverCardContent align={align} className="w-72 space-y-3 p-3 text-left">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            {tenant.photoId && (
              <AvatarImage src={`/api/documents/${tenant.photoId}`} alt={tenant.name} />
            )}
            <AvatarFallback>{initials(tenant.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{tenant.name}</p>
            {tenant.context && (
              <p className="truncate text-xs text-muted-foreground">{tenant.context}</p>
            )}
          </div>
        </div>
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <dt>
              <PhoneIcon className="size-3.5 text-muted-foreground" />
              <span className="sr-only">Phone</span>
            </dt>
            <dd className="truncate">{tenant.phone ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <MailIcon className="size-3.5 text-muted-foreground" />
              <span className="sr-only">Email</span>
            </dt>
            <dd className="truncate">{tenant.email ?? "—"}</dd>
          </div>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

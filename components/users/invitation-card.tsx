"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { InvitationRow } from "@/lib/invitations";

/**
 * A pending invite as one card, for the mobile list on the Users page.
 *
 * `name` is nullable — an invite can be identified by email or phone alone —
 * so the heading falls back the same way the table's column does, rather than
 * rendering an empty line where a name should be.
 */
export function InvitationCard({ invitation }: { invitation: InvitationRow }) {
  const label = invitation.name ?? invitation.email ?? invitation.phone ?? "Invite";
  const contact = [invitation.phone, invitation.email].filter(Boolean).join(" · ");

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{label}</p>
        <Badge className="shrink-0 rounded-full font-normal" variant="outline">
          {invitation.roleName}
        </Badge>
      </div>

      {contact && (
        <p className="truncate text-xs text-muted-foreground">{contact}</p>
      )}

      <p className="text-xs text-muted-foreground">
        {invitation.isExpired ? (
          <span className="text-destructive">
            Expired {formatDate(new Date(invitation.expiresAt))}
          </span>
        ) : (
          <>Expires {formatDate(new Date(invitation.expiresAt))}</>
        )}
      </p>
    </div>
  );
}

"use client";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import type { MemberRow } from "@/lib/members";

/**
 * A member as one card, for the mobile list on the Users page.
 *
 * No "cannot sign in" caption — Phase 16 removed it from the table for being
 * noise, and it would be the same noise here. The Invite action, which is what
 * that state actually calls for, is in the actions sheet and only appears for
 * a member who needs it.
 */
export function MemberCard({ member }: { member: MemberRow }) {
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <PersonCell name={member.name} photoId={member.photoId} />
        <Badge className="shrink-0 rounded-full font-normal" variant="outline">
          {member.roleName}
        </Badge>
      </div>

      <div className="space-y-1 pl-[42px] text-xs text-muted-foreground">
        <p className="truncate">
          {member.phone ?? <span className="italic">No phone</span>}
        </p>
        <p className="truncate">
          {member.email ?? <span className="italic">No email</span>}
        </p>
      </div>
    </div>
  );
}

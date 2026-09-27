"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { PersonCell } from "@/components/person-cell";
import { DataTable } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { RoleMember } from "@/lib/roles";

/**
 * Everyone holding one role — the same columns and mobile card as the Users
 * page, minus the Role column (it's this page's role for every row). Rows open
 * the member's page; role changes happen there or on /users.
 */
export function RoleMembersTable({ members }: { members: RoleMember[] }) {
  const columns = React.useMemo<ColumnDef<RoleMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} photoId={row.original.photoId} />
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) =>
          row.original.email ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "joinedAt",
        header: "Date joined",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(new Date(row.original.joinedAt))}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={members}
      searchPlaceholder="Search people…"
      emptyMessage="Nobody holds this role yet. Assign it from the Users page, or invite someone into it."
      getRowHref={(member) => `/members/${member.membershipId}`}
      renderCard={(member) => (
        <div className="min-w-0 space-y-2.5">
          <PersonCell name={member.name} photoId={member.photoId} />
          <div className="space-y-1 pl-[42px] text-xs text-muted-foreground">
            <p className="truncate">{member.phone ?? <span className="italic">No phone</span>}</p>
            <p className="truncate">{member.email ?? <span className="italic">No email</span>}</p>
          </div>
        </div>
      )}
    />
  );
}

"use client";

import * as React from "react";
import { EyeIcon, PlusIcon } from "lucide-react";

import { LeaseFormDialog } from "@/components/leases/lease-form-dialog";
import { MemberLeaseCard } from "@/components/members/member-lease-card";
import {
  buildMemberLeaseColumns,
  type MemberLeaseRow,
} from "@/components/members/member-lease-columns";
import { Button } from "@/components/ui/button";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import type { LeaseOptions } from "@/lib/leases";

/**
 * A member's leases, in the same `DataTable` the org-wide leases page uses.
 *
 * The create button only appears for tenants: `createLease` requires the
 * membership to hold the Tenant role and 404s otherwise, so offering it to an
 * Owner or a caretaker would be an affordance that can only fail.
 */
export function MemberLeasesTab({
  leases,
  membershipId,
  isTenant,
  roleName,
  options,
}: {
  leases: MemberLeaseRow[];
  membershipId: string;
  isTenant: boolean;
  roleName: string;
  options: LeaseOptions | null;
}) {
  const [formOpen, setFormOpen] = React.useState(false);

  const columns = React.useMemo(() => buildMemberLeaseColumns(), []);

  return (
    <div className="space-y-3">
      {isTenant && options && (
        <div className="flex justify-end">
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon />
            Create lease
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={leases}
        searchColumnId="propertyName"
        searchPlaceholder="Search leases…"
        facetFilters={[
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Status",
            options: [
              { label: "Active", value: "Active" },
              { label: "Upcoming", value: "Upcoming" },
              { label: "Ended", value: "Ended" },
            ],
          },
        ]}
        emptyMessage={
          isTenant
            ? "This tenant has no leases yet. Use “Create lease” to add one."
            : `${roleName} members do not normally hold leases.`
        }
        getRowHref={(lease) => `/leases/${lease.id}`}
        renderCard={(lease) => <MemberLeaseCard lease={lease} />}
        // Mobile only, and nothing to drift from: this table has never had a
        // desktop actions column — opening a lease is a double-click there.
        rowActions={(lease): RowAction[] => [
          {
            label: "View lease",
            icon: EyeIcon,
            href: `/leases/${lease.id}`,
          },
        ]}
      />

      {options && (
        <LeaseFormDialog
          key={String(formOpen)}
          open={formOpen}
          onOpenChange={setFormOpen}
          options={options}
          lockedTenantId={membershipId}
        />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { EyeIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

import { LeaseFormDialog } from "@/components/leases/lease-form-dialog";
import {
  RenewLeaseDialog,
  type RenewableLease,
} from "@/components/leases/renew-lease-dialog";
import { MemberLeaseCard } from "@/components/members/member-lease-card";
import {
  buildMemberLeaseColumns,
  type MemberLeaseRow,
} from "@/components/members/member-lease-columns";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import type { LeaseOptions } from "@/lib/leases";

/**
 * A member's leases, in the same `DataTable` the org-wide leases page uses.
 *
 * The create button only appears for tenants: `createLease` requires the
 * membership to hold the Tenant role and 404s otherwise, so offering it to an
 * Owner or a caretaker would be an affordance that can only fail.
 *
 * "Renew lease" sits beside it for Ended leases only — a running lease is left
 * to auto-renew, so it can't be renewed early by accident.
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
  /** The lease the renew dialog opens on; null while it is closed. */
  const [renewing, setRenewing] = React.useState<string | null>(null);

  const canReadProperties = useCan("property:read");
  const canReadLeases = useCan("lease:read");
  const canWriteLeases = useCan("lease:write");
  const columns = React.useMemo(
    () => buildMemberLeaseColumns({ canReadProperties, canReadLeases }),
    [canReadProperties, canReadLeases]
  );

  // Newest first, as the rows arrive, so the button opens on the latest term.
  const renewable: RenewableLease[] = React.useMemo(
    () =>
      leases
        .filter((lease) => lease.status === "Ended")
        .map((lease) => ({
          id: lease.id,
          reference: lease.reference,
          propertyName: lease.propertyName,
          unitLabel: lease.unitLabel,
          endDate: lease.endDate,
          durationMonths: lease.durationMonths,
          monthlyRent: lease.monthlyRent,
          autoRenew: lease.autoRenew,
          unitRentAmount: lease.unit.rentAmount,
          minTenureMonths: lease.minTenureMonths,
        })),
    [leases]
  );
  const canRenew = isTenant && canWriteLeases && renewable.length > 0;

  return (
    <div className="space-y-3">
      {isTenant && canWriteLeases && (options || canRenew) && (
        <div className="flex justify-end gap-2">
          {canRenew && (
            <Button variant="outline" onClick={() => setRenewing(renewable[0].id)}>
              <RefreshCwIcon />
              Renew lease
            </Button>
          )}
          {options && (
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon />
              Create lease
            </Button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={leases}
        stateKey={`member-leases:${membershipId}`}
        searchPlaceholder="Search leases…"
        facetFilters={[
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Status",
            multiple: true,
            options: [
              { label: "Active", value: "Active" },
              { label: "Upcoming", value: "Upcoming" },
              { label: "Ended", value: "Ended" },
              { label: "Renewed", value: "Renewed" },
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
          ...(isTenant && canWriteLeases
            ? [
                {
                  label: "Renew lease",
                  icon: RefreshCwIcon,
                  onSelect: () => setRenewing(lease.id),
                  disabled: !renewable.some((item) => item.id === lease.id),
                  disabledReason:
                    lease.status === "Renewed"
                      ? "Already renewed"
                      : "Only an ended lease can be renewed",
                },
              ]
            : []),
        ]}
      />

      {renewing && (
        <RenewLeaseDialog
          key={renewing}
          open
          onOpenChange={(open) => !open && setRenewing(null)}
          leases={renewable}
          initialLeaseId={renewing}
        />
      )}

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

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { ImportExportActions } from "@/components/import-export-actions";
import { ImportDialog } from "@/components/import-dialog";
import { LeaseFormDialog } from "@/components/leases/lease-form-dialog";
import { MemberEditDialog } from "@/components/member-edit-dialog";
import { TenantCard } from "@/components/tenants/tenant-card";
import { buildTenantColumns } from "@/components/tenants/tenant-columns";
import { TenantFormDialog } from "@/components/tenants/tenant-form-dialog";
import { gateActions, useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableView,
  type RowAction,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeaseOptions } from "@/lib/leases";
import type { TenantRow } from "@/lib/tenants";
import type { CreateTenantInput } from "@/lib/tenants-schemas";

/** A tenant can be given a lease only when they aren't in one already. */
const CAN_ASSIGN_LEASE: Record<TenantRow["status"], boolean> = {
  Prospect: true,
  Vacated: true,
  Active: false,
  Upcoming: false,
};

export function TenantsTable({
  tenants,
  leaseOptions,
}: {
  tenants: TenantRow[];
  leaseOptions: LeaseOptions;
}) {
  const router = useRouter();
  const viewRef = React.useRef<DataTableView<TenantRow>>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TenantRow | null>(null);
  const [editing, setEditing] = React.useState<TenantRow | null>(null);
  const [assigning, setAssigning] = React.useState<TenantRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * The single description of what you can do to a tenant. The desktop icon
   * strip is built from it, and `DataTable` hands the same list to its mobile
   * actions sheet — so neither surface can drift from the other.
   */
  const canLease = useCan("lease:write");
  const canWrite = useCan("tenant:write");
  const canEdit = useCan(["tenant:write", "member:write"]);
  const baseRowActions = React.useCallback(
    (tenant: TenantRow): RowAction[] => [
      /*
       * Leads, because putting a tenant into a unit is the job this page
       * exists for. Greyed rather than dropped when they are already in one,
       * so the four actions keep the same position on every row.
       */
      {
        label: `Assign lease to ${tenant.name}`,
        icon: FileTextIcon,
        onSelect: () => setAssigning(tenant),
        disabled: !CAN_ASSIGN_LEASE[tenant.status],
        disabledReason:
          tenant.status === "Active"
            ? "Already in a unit"
            : "Lease already signed",
      },
      {
        label: `View ${tenant.name}`,
        icon: EyeIcon,
        href: `/members/${tenant.membershipId}`,
      },
      {
        label: `Edit ${tenant.name}`,
        icon: PencilIcon,
        onSelect: () => setEditing(tenant),
      },
      {
        label: `Remove ${tenant.name}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => {
          setError(null);
          setDeleting(tenant);
        },
      },
    ],
    []
  );
  // Greyed out, not hidden, when the role can't use them; the API enforces it.
  const rowActions = React.useCallback(
    (row: TenantRow) => gateActions(baseRowActions(row), [["Assign lease", canLease], ["Edit", canEdit], ["Remove", canWrite]]),
    [baseRowActions, canLease, canWrite, canEdit]
  );

  const columns = React.useMemo(
    () => buildTenantColumns({ rowActions }),
    [rowActions]
  );

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/tenants/${deleting.membershipId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not remove this tenant";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      {/* Equal shares of the row on a phone (one button fills it alone); a right-aligned row from `sm`. */}
      <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:justify-end">
        <ImportExportActions
          exportUrl="/api/tenants/export"
          exportLabel="Export tenants"
          filenameFallback="tenants.xlsx"
          getIds={() =>
            viewRef.current?.visibleRows()?.map((t) => t.membershipId) ?? null
          }
          importLabel="Import tenants"
          onImport={() => setImportOpen(true)}
          canImport={canWrite}
        />
        <Button
          disabled={!canWrite}
          title={canWrite ? undefined : "Your role doesn't allow this"} data-tour="add-tenant" onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Add tenant
        </Button>
      </div>

      <DataTable
        viewRef={viewRef}
        stateKey="tenants"
        columns={columns}
        data={tenants}
        searchPlaceholder="Search tenants…"
        facetFilters={[
          {
            columnId: "propertyName",
            placeholder: "All properties",
            label: "Property",
            multiple: true,
            // From the tenants on screen, so the list can't offer a property
            // with nobody in it. Tenants with no unit yet carry null and are
            // simply excluded once a property is chosen.
            options: [
              ...new Set(
                tenants
                  .map((tenant) => tenant.propertyName)
                  .filter((name): name is string => name !== null)
              ),
            ]
              .sort()
              .map((name) => ({ label: name, value: name })),
          },
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Status",
            multiple: true,
            options: [
              { label: "Active", value: "Active" },
              { label: "Upcoming", value: "Upcoming" },
              { label: "Prospect", value: "Prospect" },
              { label: "Vacated", value: "Vacated" },
            ],
          },
        ]}
        emptyMessage="No tenants yet. Use “Add tenant” to record the first one."
        getRowHref={(tenant) => `/members/${tenant.membershipId}`}
        renderCard={(tenant) => <TenantCard tenant={tenant} />}
        rowActions={rowActions}
      />

      {/* The tenant is fixed by the row that opened it — `lockedTenantId` is
          the same guard the member page uses, so a lease started from someone's
          row can't quietly end up belonging to another tenant. */}
      {assigning && (
        <LeaseFormDialog
          key={assigning.membershipId}
          open
          onOpenChange={(open) => !open && setAssigning(null)}
          options={leaseOptions}
          lockedTenantId={assigning.membershipId}
        />
      )}

      <MemberEditDialog
        key={`edit-${editing?.membershipId ?? "none"}`}
        member={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <TenantFormDialog
        key={String(formOpen)}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {/* Remounted per open so a finished import doesn't reopen on its summary. */}
      <ImportDialog<CreateTenantInput>
        key={`import-${importOpen}`}
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import tenants"
        description="Fill the template with one row per tenant, then upload it back here."
        noun="tenant"
        templateUrl="/api/tenants/template"
        parseUrl="/api/tenants/import"
        createUrl="/api/tenants"
        templateHint="Download the .xlsx — first name and phone are required, the rest is optional."
        renderSummary={(tenant) => (
          <>
            {tenant.phone}
            {tenant.email ? ` · ${tenant.email}` : ""}
          </>
        )}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?.status === "Active"
                ? "This tenant has an active lease — removing them deletes it too. This cannot be undone."
                : "This removes them from your organization. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Removing…" : "Remove tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

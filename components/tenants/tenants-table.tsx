"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { MemberEditDialog } from "@/components/member-edit-dialog";
import { buildTenantColumns } from "@/components/tenants/tenant-columns";
import { TenantFormDialog } from "@/components/tenants/tenant-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TenantRow } from "@/lib/tenants";

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TenantRow | null>(null);
  const [editing, setEditing] = React.useState<TenantRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const columns = React.useMemo(
    () =>
      buildTenantColumns({
        onEdit: (tenant) => setEditing(tenant),
        onDelete: (tenant) => {
          setError(null);
          setDeleting(tenant);
        },
      }),
    []
  );

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/tenants/${deleting.membershipId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setDeleting(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setError(data?.error ?? "Could not remove this tenant");
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Add tenant
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        searchColumnId="name"
        searchPlaceholder="Search tenants…"
        facetFilters={[
          {
            columnId: "status",
            placeholder: "All statuses",
            options: [
              { label: "Active", value: "Active" },
              { label: "Prospect", value: "Prospect" },
              { label: "Vacated", value: "Vacated" },
            ],
          },
        ]}
        emptyMessage="No tenants yet. Use “Add tenant” to record the first one."
        getRowHref={(tenant) => `/members/${tenant.membershipId}`}
      />

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

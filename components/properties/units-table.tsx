"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import {
  buildUnitColumns,
  type UnitRow,
} from "@/components/properties/unit-columns";
import {
  UnitFormDialog,
  type UnitFormValues,
} from "@/components/properties/unit-form-dialog";
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
import { UNIT_TYPE_OPTIONS } from "@/lib/unit-options";

const NONE = "__none__";

function toFormValues(unit: UnitRow): UnitFormValues {
  return {
    label: unit.label,
    rentAmount: String(unit.rentAmount),
    minTenureMonths:
      unit.minTenureMonths == null ? NONE : String(unit.minTenureMonths),
    unitType: unit.unitType ?? NONE,
    floor: unit.floor ?? "",
    block: unit.block ?? "",
    sizeSqm: unit.sizeSqm == null ? "" : String(unit.sizeSqm),
    amenities: unit.amenities,
  };
}

export function UnitsTable({
  propertyId,
  units,
}: {
  propertyId: string;
  units: UnitRow[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UnitRow | null>(null);
  const [deleting, setDeleting] = React.useState<UnitRow | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const columns = React.useMemo(
    () =>
      buildUnitColumns({
        onEdit: (unit) => {
          setEditing(unit);
          setFormOpen(true);
        },
        onDelete: (unit) => {
          setDeleteError(null);
          setDeleting(unit);
        },
      }),
    []
  );

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);

    const response = await fetch(
      `/api/properties/${propertyId}/units/${deleting.id}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      setDeleting(null);
      setDeletePending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setDeleteError(data?.error ?? "Could not delete this unit");
    setDeletePending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon />
          Add unit
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={units}
        searchColumnId="label"
        searchPlaceholder="Filter units…"
        facetFilters={[
          {
            columnId: "status",
            placeholder: "All statuses",
            options: [
              { label: "Occupied", value: "Occupied" },
              { label: "Vacant", value: "Vacant" },
            ],
          },
          {
            columnId: "unitType",
            placeholder: "All types",
            options: UNIT_TYPE_OPTIONS.map((type) => ({ label: type, value: type })),
          },
        ]}
        emptyMessage="No units yet. Use “Add unit” to create the first one."
      />

      {/* Remount on each open so the form re-seeds from initialValues, rather
          than resetting state inside an effect. */}
      <UnitFormDialog
        key={`${editing?.id ?? "new"}:${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        propertyId={propertyId}
        unitId={editing?.id}
        initialValues={editing ? toFormValues(editing) : undefined}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unit {deleting?.label}?</DialogTitle>
            <DialogDescription>
              {deleting?.status === "Occupied"
                ? "This unit is currently occupied — deleting it also removes its lease. This cannot be undone."
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";

import {
  PropertyFormDialog,
  type PropertyFormValues,
} from "@/components/properties/property-form-dialog";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";

/**
 * The property page's header button. Deactivate and Delete live on the
 * Actions tab, where there is room to say what each one does.
 */
export function PropertyActions({
  propertyId,
  ownerName,
  initialValues,
}: {
  propertyId: string;
  ownerName: string;
  initialValues: PropertyFormValues;
}) {
  const canWrite = useCan("property:write");
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    // Full width on a phone; `shrink-0` from `sm` up keeps a long property
    // name from squeezing the button instead of truncating itself.
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setEditOpen(true)}
        disabled={!canWrite}
        title={canWrite ? undefined : "Your role doesn't allow this"}
      >
        <PencilIcon />
        Edit
      </Button>

      {/* Conditionally mounted so it re-seeds from the latest `initialValues`
          on every open, rather than keeping whatever was typed the time
          before — the same pattern the lease and unit edit dialogs use. */}
      {editOpen && (
        <PropertyFormDialog
          key={propertyId}
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          ownerName={ownerName}
          property={{ id: propertyId, ...initialValues }}
        />
      )}
    </div>
  );
}

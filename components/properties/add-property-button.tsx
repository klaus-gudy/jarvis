"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { PropertyFormDialog } from "@/components/properties/property-form-dialog";
import { Button } from "@/components/ui/button";

export function AddPropertyButton({ ownerName }: { ownerName: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button data-tour="add-property" onClick={() => setOpen(true)}>
        <PlusIcon />
        Add property
      </Button>
      {/* Keyed on `open` so cancelling and reopening starts from a blank form
          again, rather than showing what was typed before — the pattern
          every create dialog in this codebase uses. */}
      <PropertyFormDialog
        key={String(open)}
        open={open}
        onOpenChange={setOpen}
        ownerName={ownerName}
      />
    </>
  );
}

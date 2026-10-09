"use client";

import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import {
  RenewLeaseDialog,
  type RenewableLease,
} from "@/components/leases/renew-lease-dialog";
import { Button } from "@/components/ui/button";

/** "Renew lease" for one lease, for server-rendered pages like the lease detail header. */
export function RenewLeaseButton({ lease }: { lease: RenewableLease }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCwIcon />
        Renew lease
      </Button>
      {open && (
        <RenewLeaseDialog
          open
          onOpenChange={setOpen}
          leases={[lease]}
          initialLeaseId={lease.id}
        />
      )}
    </>
  );
}

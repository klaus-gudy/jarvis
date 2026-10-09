"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeOffIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NOT_ALLOWED = "Your role doesn't allow this";

/**
 * One row of the Actions tab: what the action does on the left, its button on
 * the right. Stacked on a phone, where the explanation needs the full width.
 */
function ActionBlock({
  title,
  description,
  destructive,
  children,
}: {
  title: string;
  description: React.ReactNode;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(destructive && "border-destructive/40")}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className={cn("font-medium", destructive && "text-destructive")}>{title}</h3>
          <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        </div>
        <div className="shrink-0">{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Deactivate or reactivate a property or a unit — what that means is in
 * `lib/tracking.ts`. The button is disabled up front while leases are live,
 * because the server refuses it then anyway.
 */
export function TrackingStatusAction({
  kind,
  name,
  endpoint,
  active,
  liveLeases,
  inactiveParent,
}: {
  kind: "property" | "unit";
  /** "Sunset Apartments" / "Unit A1", for the dialog and toast. */
  name: string;
  /** The `/status` route to PATCH. */
  endpoint: string;
  active: boolean;
  /** Leases running now or still to start. */
  liveLeases: number;
  /** A unit inside a deactivated property stays out of tracking either way. */
  inactiveParent?: boolean;
}) {
  const canWrite = useCan("property:write");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const blocked = active && liveLeases > 0;
  const scope = kind === "property" ? "this property and its units" : "this unit";

  async function submit() {
    setPending(true);
    setError(null);
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: active ? "INACTIVE" : "ACTIVE" }),
    });

    if (response.ok) {
      setOpen(false);
      setPending(false);
      toast.success(`${name} ${active ? "deactivated" : "reactivated"}`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? `Could not update this ${kind}`;
    setError(message);
    toast.error(message);
    setPending(false);
  }

  const description = active ? (
    <>
      <p>
        Takes {scope} out of tracking: no dashboard or occupancy figures, and never
        offered when creating a lease. Leases, payments, documents and activity stay
        as they are, and you can reactivate at any time.
      </p>
      {blocked && (
        <p className="mt-1.5 text-foreground">
          {liveLeases} lease{liveLeases === 1 ? " is" : "s are"} running or about to
          start — {kind === "property" ? "they have" : "it has"} to end first.
        </p>
      )}
    </>
  ) : (
    <p>
      This {kind} is deactivated. Reactivating puts it back into the dashboard
      figures and lease pickers.
      {inactiveParent && " Its property is deactivated too, so reactivate that as well."}
    </p>
  );

  return (
    <ActionBlock
      title={active ? `Deactivate ${kind}` : `Reactivate ${kind}`}
      description={description}
    >
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={!canWrite || blocked}
        title={canWrite ? undefined : NOT_ALLOWED}
      >
        {active ? <EyeOffIcon /> : <RotateCcwIcon />}
        {active ? "Deactivate" : "Reactivate"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active ? "Deactivate" : "Reactivate"} {name}?
            </DialogTitle>
            <DialogDescription>
              {active
                ? `It drops out of the dashboard, occupancy figures and lease pickers. Nothing is deleted.`
                : `It counts toward the dashboard and can be leased again.`}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={submit} disabled={pending}>
              {pending
                ? active
                  ? "Deactivating…"
                  : "Reactivating…"
                : active
                  ? `Deactivate ${kind}`
                  : `Reactivate ${kind}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ActionBlock>
  );
}

/** The Actions tab's delete row, for a property or a unit. */
export function DeleteAction({
  kind,
  name,
  endpoint,
  consequence,
  redirectTo,
}: {
  kind: "property" | "unit";
  name: string;
  /** The record's own route, which takes DELETE. */
  endpoint: string;
  /** What else goes with it, e.g. "This also deletes its 4 units…". */
  consequence: string;
  /** Where to go once the page being looked at no longer exists. */
  redirectTo: string;
}) {
  const canWrite = useCan("property:write");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const response = await fetch(endpoint, { method: "DELETE" });

    if (response.ok) {
      setOpen(false);
      toast.success(`${name} deleted`);
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? `Could not delete this ${kind}`;
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <ActionBlock
      destructive
      title={`Delete ${kind}`}
      description={
        <p>
          Removes it for good, with everything on it. To keep the history, deactivate it
          instead.
        </p>
      }
    >
      <Button
        variant="destructive"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={!canWrite}
        title={canWrite ? undefined : NOT_ALLOWED}
      >
        <Trash2Icon />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>{consequence}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : `Delete ${kind}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ActionBlock>
  );
}

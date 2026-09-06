"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportSummary } from "@/lib/organization-import";
import { cn } from "@/lib/utils";

type Phase = "choose" | "uploading" | "done";

/**
 * Restores a backup downloaded from "Export data" into this organization.
 *
 * Unlike `ImportDialog` (units, tenants), there is no per-row review: the
 * five sheets reference each other, so accepting some rows and rejecting
 * others would leave leases pointing at units that were never created. The
 * server validates the whole file and either restores everything or nothing,
 * so this dialog only has a file picker and a result.
 */
export function OrganizationImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [phase, setPhase] = React.useState<Phase>("choose");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<string[]>([]);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [dragging, setDragging] = React.useState(false);

  async function handleFile(file: File) {
    setPhase("uploading");
    setFileName(file.name);
    setError(null);
    setIssues([]);

    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/organizations/import", {
      method: "POST",
      body,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "This file couldn't be restored.");
      setIssues(data?.issues ?? []);
      setPhase("choose");
      toast.error(data?.error ?? "This file couldn't be restored.");
      return;
    }

    setSummary(data.summary);
    setPhase("done");
    toast.success("Backup restored");
    router.refresh();
  }

  function reset() {
    setPhase("choose");
    setFileName(null);
    setError(null);
    setIssues([]);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "uploading") return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            Upload a backup downloaded from “Export data”. The organization
            must be empty — created fresh for this restore.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase !== "done" && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void handleFile(file);
                }}
                disabled={phase === "uploading"}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50 hover:bg-muted/40",
                  phase === "uploading" && "pointer-events-none opacity-70"
                )}
              >
                {phase === "uploading" ? (
                  <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <UploadIcon className="size-6 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {phase === "uploading"
                    ? "Restoring…"
                    : "Drop the backup .xlsx here"}
                </span>
                {phase !== "uploading" && (
                  <span className="text-xs text-muted-foreground">
                    or click to browse
                  </span>
                )}
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />

              {error && (
                <div className="space-y-2">
                  <p className="flex items-start gap-2 text-sm text-destructive">
                    <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </p>
                  {issues.length > 0 && (
                    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      {issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {phase === "done" && summary && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <FileSpreadsheetIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{fileName}</span>
              </p>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                <li className="rounded-lg border p-2.5">
                  <span className="block text-lg font-semibold tabular-nums">
                    {summary.properties}
                  </span>
                  properties
                </li>
                <li className="rounded-lg border p-2.5">
                  <span className="block text-lg font-semibold tabular-nums">
                    {summary.units}
                  </span>
                  units
                </li>
                <li className="rounded-lg border p-2.5">
                  <span className="block text-lg font-semibold tabular-nums">
                    {summary.memberships}
                  </span>
                  members
                </li>
                <li className="rounded-lg border p-2.5">
                  <span className="block text-lg font-semibold tabular-nums">
                    {summary.leases}
                  </span>
                  leases
                </li>
                <li className="col-span-2 rounded-lg border p-2.5">
                  <span className="block text-lg font-semibold tabular-nums">
                    {summary.payments}
                  </span>
                  payments
                </li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === "choose" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {phase === "uploading" && (
            <Button disabled>
              <Loader2Icon className="animate-spin" />
              Restoring…
            </Button>
          )}
          {phase === "done" && (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

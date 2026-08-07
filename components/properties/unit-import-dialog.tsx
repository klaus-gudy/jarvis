"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleIcon,
  CircleXIcon,
  DownloadIcon,
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
import { formatMoneyFull } from "@/lib/format";
import type { ParsedUnitRow } from "@/lib/unit-import";
import { cn } from "@/lib/utils";

type RowStatus =
  /** Rejected while parsing — never sent to the server. */
  | "invalid"
  | "pending"
  | "importing"
  | "success"
  | "failed";

type ImportRow = ParsedUnitRow & {
  status: RowStatus;
  /** Why it failed, once it has. */
  message: string | null;
};

type Phase = "choose" | "review" | "importing" | "done";

const STATUS_ICON: Record<RowStatus, React.ReactNode> = {
  invalid: <CircleAlertIcon className="size-4 text-destructive" />,
  pending: <CircleIcon className="size-4 text-muted-foreground/50" />,
  importing: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
  success: <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />,
  failed: <CircleXIcon className="size-4 text-destructive" />,
};

export function UnitImportDialog({
  open,
  onOpenChange,
  propertyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const [phase, setPhase] = React.useState<Phase>("choose");
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  /** Guards the refresh so a cancelled import that created rows still updates the table. */
  const createdAny = React.useRef(false);

  const importable = rows.filter((row) => row.status !== "invalid");
  const invalidCount = rows.length - importable.length;
  const succeeded = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status === "failed").length;

  async function downloadTemplate() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/properties/${propertyId}/units/template`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not build the template");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? "units-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not build the template";
      setError(message);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setWarning(null);
    setFileName(file.name);

    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`/api/properties/${propertyId}/units/import`, {
      method: "POST",
      body,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error ?? "Could not read that file";
      setError(message);
      setFileName(null);
      setUploading(false);
      toast.error(message);
      return;
    }

    const parsed: ParsedUnitRow[] = data.rows ?? [];
    setRows(
      parsed.map((row) => ({
        ...row,
        status: row.errors.length > 0 ? ("invalid" as const) : ("pending" as const),
        message: row.errors[0] ?? null,
      }))
    );
    setWarning(data.warning ?? null);
    setPhase("review");
    setUploading(false);
  }

  async function runImport() {
    setPhase("importing");

    // Sequential on purpose: duplicate labels are only detectable against rows
    // already committed, and a steady one-at-a-time trickle is what the list shows.
    for (const row of rows) {
      if (row.status === "invalid" || !row.data) continue;

      setRows((current) =>
        current.map((item) =>
          item.rowNumber === row.rowNumber
            ? { ...item, status: "importing" }
            : item
        )
      );

      // A long file scrolls the active row out of sight, which is most of the
      // point of the list. "nearest" only moves when it has actually left view.
      listRef.current
        ?.querySelector(`[data-row="${row.rowNumber}"]`)
        ?.scrollIntoView({ block: "nearest" });

      const response = await fetch(`/api/properties/${propertyId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.data),
      });

      if (response.ok) {
        createdAny.current = true;
        setRows((current) =>
          current.map((item) =>
            item.rowNumber === row.rowNumber
              ? { ...item, status: "success", message: null }
              : item
          )
        );
        continue;
      }

      const data = await response.json().catch(() => null);
      const issue = data?.issues
        ? Object.values(data.issues as Record<string, string[]>)[0]?.[0]
        : null;
      setRows((current) =>
        current.map((item) =>
          item.rowNumber === row.rowNumber
            ? {
                ...item,
                status: "failed",
                message: issue ?? data?.error ?? "Could not create this unit",
              }
            : item
        )
      );
    }

    setPhase("done");
    router.refresh();
  }

  // Reports the outcome once, after the loop has settled into "done".
  React.useEffect(() => {
    if (phase !== "done") return;
    if (failed === 0) {
      toast.success(
        `${succeeded} unit${succeeded === 1 ? "" : "s"} imported`
      );
    } else if (succeeded === 0) {
      toast.error(`Import failed — no units were created`);
    } else {
      toast.warning(`${succeeded} imported, ${failed} failed`);
    }
    // Only ever fires on the transition into "done".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function reset() {
    setPhase("choose");
    setRows([]);
    setFileName(null);
    setError(null);
    setWarning(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (createdAny.current) router.refresh();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-import would orphan the loop's state updates.
        if (!next && phase === "importing") return;
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import units</DialogTitle>
          <DialogDescription>
            Fill the template with one row per unit, then upload it back here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "choose" && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-3">
                <div className="min-w-0">
                  <p className="font-medium">Don&apos;t have a template?</p>
                  <p className="text-xs text-muted-foreground">
                    Download the .xlsx — unit name and monthly rate are
                    required, the rest is optional.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  disabled={downloading}
                >
                  {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                  {downloading ? "Preparing…" : "Download"}
                </Button>
              </div>

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
                disabled={uploading}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50 hover:bg-muted/40",
                  uploading && "pointer-events-none opacity-70"
                )}
              >
                {uploading ? (
                  <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <UploadIcon className="size-6 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {uploading ? "Reading the file…" : "Drop the filled template here"}
                </span>
                {!uploading && (
                  <span className="text-xs text-muted-foreground">
                    or click to browse — .xlsx only
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
                <p className="flex items-start gap-2 text-sm text-destructive">
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}
            </>
          )}

          {phase !== "choose" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-sm">
                  <FileSpreadsheetIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{fileName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {phase === "review"
                    ? `${importable.length} ready${invalidCount > 0 ? ` · ${invalidCount} skipped` : ""}`
                    : `${succeeded} created · ${failed} failed · ${importable.length - succeeded - failed} pending`}
                </p>
              </div>

              {warning && (
                <p className="flex items-start gap-2 rounded-lg border border-stat-accent/40 bg-stat-accent/10 p-2.5 text-xs">
                  <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-stat-accent" />
                  {warning}
                </p>
              )}

              <ul
                ref={listRef}
                className="max-h-[45vh] divide-y overflow-y-auto rounded-lg border"
              >
                {rows.map((row) => (
                  <li
                    key={row.rowNumber}
                    data-row={row.rowNumber}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <span className="mt-0.5 shrink-0">
                      {STATUS_ICON[row.status]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "truncate font-medium",
                            row.status === "invalid" && "text-muted-foreground"
                          )}
                        >
                          {row.label}
                        </span>
                        {row.data && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatMoneyFull(row.data.rentAmount)}
                            {row.data.unitType ? ` · ${row.data.unitType}` : ""}
                          </span>
                        )}
                      </div>
                      {/* Parse errors list every problem; a server rejection has one. */}
                      {row.status === "invalid" ? (
                        <p className="text-xs text-destructive">
                          {row.errors.join(" · ")}
                        </p>
                      ) : (
                        row.message && (
                          <p className="text-xs text-destructive">{row.message}</p>
                        )
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                      Row {row.rowNumber}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <DialogFooter>
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={runImport} disabled={importable.length === 0}>
                Import {importable.length} unit
                {importable.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {phase === "importing" && (
            <Button disabled>
              <Loader2Icon className="animate-spin" />
              Importing…
            </Button>
          )}
          {phase === "done" && (
            <>
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={close}>Done</Button>
            </>
          )}
          {phase === "choose" && (
            <Button variant="outline" onClick={close} disabled={uploading}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

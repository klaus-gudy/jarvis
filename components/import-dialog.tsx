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
  XIcon,
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
import type { ParsedRow } from "@/lib/xlsx-import";
import { cn } from "@/lib/utils";

type RowStatus =
  /** Rejected while parsing — never sent to the server. */
  | "invalid"
  | "pending"
  | "importing"
  | "success"
  | "failed";

type ImportRow<T> = ParsedRow<T> & {
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

/**
 * The whole bulk-import flow for one entity: download a template, upload it
 * filled, review the parsed rows, then create them one at a time with live
 * per-row status. Everything entity-specific arrives as props, so units and
 * tenants share one implementation.
 */
export function ImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  noun,
  templateUrl,
  parseUrl,
  createUrl,
  templateHint,
  renderSummary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Singular, for counts: "unit" -> "3 units imported". */
  noun: string;
  /** GET, streams the .xlsx template. */
  templateUrl: string;
  /** POST multipart, validates and returns rows without writing. */
  parseUrl: string;
  /** POST JSON, creates one record — the same endpoint the single form uses. */
  createUrl: string;
  templateHint: string;
  /** Right-hand detail on a valid row, e.g. rent and type. */
  renderSummary: (data: T) => React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const [phase, setPhase] = React.useState<Phase>("choose");
  const [rows, setRows] = React.useState<ImportRow<T>[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  /** Guards the refresh so a cancelled import that created rows still updates the table. */
  const createdAny = React.useRef(false);
  /**
   * Set by Stop, read at the top of each iteration of the import loop.
   *
   * A ref rather than state because the loop is a plain `for` running inside
   * one async call — it closes over the state it started with, so a `useState`
   * flag set mid-run would still read false on every remaining iteration.
   */
  const stopRequested = React.useRef(false);
  const [stopping, setStopping] = React.useState(false);

  const importable = rows.filter((row) => row.status !== "invalid");
  const invalidCount = rows.length - importable.length;
  const succeeded = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  /** Valid rows the loop never reached — non-zero only after a Stop. */
  const untouched = importable.length - succeeded - failed;

  async function downloadTemplate() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(templateUrl);
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
          ?.match(/filename="(.+)"/)?.[1] ?? `${noun}s-template.xlsx`;
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

    const response = await fetch(parseUrl, { method: "POST", body });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error ?? "Could not read that file";
      setError(message);
      setFileName(null);
      setUploading(false);
      toast.error(message);
      return;
    }

    const parsed: ParsedRow<T>[] = data.rows ?? [];
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
    stopRequested.current = false;
    setStopping(false);
    setPhase("importing");

    // Sequential on purpose: duplicate labels are only detectable against rows
    // already committed, and a steady one-at-a-time trickle is what the list shows.
    for (const row of rows) {
      // Checked between rows, never mid-request: a record whose POST is already
      // in flight will be created whatever this flag says, and pretending
      // otherwise would leave the list disagreeing with the database.
      if (stopRequested.current) break;
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

      const response = await fetch(createUrl, {
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
                message: issue ?? data?.error ?? `Could not create this ${noun}`,
              }
            : item
        )
      );
    }

    setStopping(false);
    setPhase("done");
    router.refresh();
  }

  // Reports the outcome once, after the loop has settled into "done".
  React.useEffect(() => {
    if (phase !== "done") return;
    // A stopped run is reported by what it left behind, not as a failure —
    // stopping is a choice, and the rows that did land are still real.
    if (stopRequested.current) {
      toast.info(
        `Import stopped — ${succeeded} ${noun}${succeeded === 1 ? "" : "s"} created, ${untouched} not imported`
      );
    } else if (failed === 0) {
      toast.success(
        `${succeeded} ${noun}${succeeded === 1 ? "" : "s"} imported`
      );
    } else if (succeeded === 0) {
      toast.error(`Import failed — no ${noun}s were created`);
    } else {
      toast.warning(`${succeeded} imported, ${failed} failed`);
    }
    // Only ever fires on the transition into "done".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * Drops one row from the import before it runs.
   *
   * The parse is all-or-nothing — a file with one unwanted row otherwise means
   * editing the spreadsheet and uploading it again — so the review list is
   * where a row gets taken out. It only removes it from *this* import: the
   * file on disk is untouched, and re-uploading brings the row back.
   */
  function removeRow(rowNumber: number) {
    setRows((current) => current.filter((row) => row.rowNumber !== rowNumber));
  }

  function reset() {
    stopRequested.current = false;
    setStopping(false);
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "choose" && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-3">
                <div className="min-w-0">
                  <p className="font-medium">Don&apos;t have a template?</p>
                  <p className="text-xs text-muted-foreground">
                    {templateHint}
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
                    : `${succeeded} created · ${failed} failed${
                        untouched > 0
                          ? ` · ${untouched} ${phase === "importing" ? "pending" : "not imported"}`
                          : ""
                      }`}
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
                            {renderSummary(row.data)}
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
                    {/* Review only: once the loop is running a row is either
                        already created or about to be, and removing it from
                        the list would hide what happened rather than undo it. */}
                    {phase === "review" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-my-1 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove row ${row.rowNumber}${row.label ? ` — ${row.label}` : ""}`}
                        onClick={() => removeRow(row.rowNumber)}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </li>
                ))}

                {rows.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Every row was removed. Choose another file, or cancel.
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        <DialogFooter>
          {phase === "review" && (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="outline" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={runImport} disabled={importable.length === 0}>
                Import {importable.length} {noun}
                {importable.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {phase === "importing" && (
            <>
              {/*
                Stops between rows rather than aborting the request in flight —
                see the loop. Whatever has already been created stays created,
                which is why this is "Stop" and not "Cancel": there is nothing
                to roll back, and the summary says what landed.
              */}
              <Button
                variant="outline"
                onClick={() => {
                  stopRequested.current = true;
                  setStopping(true);
                }}
                disabled={stopping}
              >
                {stopping ? "Stopping…" : "Stop"}
              </Button>
              <Button disabled>
                <Loader2Icon className="animate-spin" />
                {stopping ? "Finishing this row…" : "Importing…"}
              </Button>
            </>
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

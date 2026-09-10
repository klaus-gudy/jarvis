"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignatureIcon } from "lucide-react";
import { toast } from "sonner";

import { DocumentsPanel } from "@/components/documents/documents-panel";
import { Button } from "@/components/ui/button";
import type { AssetTypeView } from "@/lib/asset-types";

type DocumentView = React.ComponentProps<typeof DocumentsPanel>["documents"][number];

/**
 * Bottom left, where the global `<Toaster>` is not.
 *
 * Set per toast rather than on the Toaster itself, because moving the Toaster
 * would relocate every toast in the app — saves, deletes, upload failures — to
 * chase one of them. Generating a contract is the only thing here that runs
 * long enough to need a corner of its own, so it takes the corner and nothing
 * else changes.
 */
const TOAST_POSITION = "bottom-left" as const;

/**
 * The toast is gold (`--stat-accent`) for every variant, because `richColors`
 * is off — so without this a failure and a success differ only by their icon.
 * Overriding the three variables sonner reads is enough to repaint one toast
 * without touching the shared config.
 */
const FAILURE_STYLE = {
  "--normal-bg": "var(--destructive)",
  "--normal-text": "var(--destructive-foreground)",
  "--normal-border": "var(--destructive)",
} as React.CSSProperties;

/**
 * Undoes the above, and every call has to pass one or the other.
 *
 * Updating a toast by id **merges** options into the existing one rather than
 * replacing them, so a failure followed by a successful retry rendered "filed"
 * in destructive red — the style outlived the state it belonged to. Empty
 * strings delete the declarations from the toast element so the variables
 * inherit from the `<Toaster>` again, which keeps the default palette defined
 * in exactly one place instead of copied to here.
 */
const DEFAULT_STYLE = {
  "--normal-bg": "",
  "--normal-text": "",
  "--normal-border": "",
} as React.CSSProperties;

/**
 * The contract generated for this lease, and nothing else.
 *
 * Split from Documents the way a property splits Images from Documents: one
 * tab holds what the system produced, the other holds what people file.
 *
 * **Generating queues the work; it no longer watches it.** Rendering moved out
 * to the `document-worker` service along with the browser it needs, so this
 * process cannot see a render happen and has nothing to stream. What the button
 * can still report is the part that is decided synchronously — whether the
 * organization has a template the contract could be built from, and whether the
 * broker accepted the message.
 *
 * What it can no longer report, stated rather than glossed: a render or upload
 * that fails on the other side, and a `document-worker` that is not running.
 * Both now look like success here. The toast says "queued", which is the truth
 * and is also less than the person asked for — closing that gap needs a
 * job-status row both processes can see.
 *
 * The failure toast is the one exception to a toast's usual manners: it does
 * not auto-dismiss, because an error message that disappears before it is read
 * is the exact problem this replaced.
 */
export function ContractTab({
  leaseId,
  documents,
  assetTypes,
}: {
  leaseId: string;
  documents: DocumentView[];
  assetTypes: AssetTypeView[];
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const hasContract = documents.length > 0;

  async function handleGenerate() {
    setRunning(true);
    setFailed(false);

    // One id for the whole run, so the outcome *replaces* the pending toast
    // instead of stacking a second one on top of it.
    const toastId = `contract-${leaseId}`;

    /*
     * `??` is not enough of a guard here. A thrown `AggregateError` — a refused
     * connection, most often — carries an *empty* message, and an empty string
     * passes straight through `??` to render a failure toast that explains
     * nothing. The server describes those properly; this is the second line,
     * covering fetch's own errors.
     */
    const fail = (reported: string | undefined) => {
      const message = reported?.trim()
        ? reported
        : "No error detail was reported — check the server logs";
      setFailed(true);
      toast.error("The contract could not be queued", {
        id: toastId,
        description: (
          // The server's own words. A rewritten message is a message that
          // cannot name the template, the queue or the broker.
          <span className="mt-1 block font-mono text-xs break-words">
            {message}
          </span>
        ),
        duration: Infinity,
        closeButton: true,
        position: TOAST_POSITION,
        style: FAILURE_STYLE,
      });
    };

    toast.loading("Queueing contract", {
      id: toastId,
      description: (
        <span className="mt-1 block text-xs">
          Filling the template and handing it to the document worker
        </span>
      ),
      duration: Infinity,
      closeButton: false,
      position: TOAST_POSITION,
      style: DEFAULT_STYLE,
    });

    try {
      const response = await fetch(`/api/leases/${leaseId}/contract`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        fail(data?.error || `Request failed (${response.status})`);
        return;
      }

      const blanks = data?.missing?.length ?? 0;
      toast.success(`${data?.fileName ?? "The contract"} is being generated`, {
        id: toastId,
        description: (
          <span className="mt-1 block text-xs">
            {blanks > 0
              ? `${blanks} field${blanks === 1 ? "" : "s"} had no data. `
              : ""}
            It will appear here once the document worker has filed it.
          </span>
        ),
        duration: 8000,
        closeButton: false,
        position: TOAST_POSITION,
        style: DEFAULT_STYLE,
      });

      /*
       * Refreshed on a delay, not immediately: the PDF is rendered and filed by
       * another process, so there is nothing new to read at the moment this
       * returns. One nudge a few seconds later catches the ordinary case
       * without pretending to know when the work finished — a reload is still
       * the honest answer if the worker is slow or stopped.
       */
      setTimeout(() => router.refresh(), 4000);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      {!hasContract && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="bg-card"
            onClick={handleGenerate}
            disabled={running}
          >
            <FileSignatureIcon />
            {running ? "Queueing…" : failed ? "Try again" : "Generate contract"}
          </Button>
        </div>
      )}

      <DocumentsPanel
        subjectType="LEASE"
        subjectId={leaseId}
        assetTypes={assetTypes}
        documents={documents}
        allowUpload={false}
        emptyMessage="No contract yet. It is normally generated from your default lease template moments after a lease is created."
      />
    </div>
  );
}

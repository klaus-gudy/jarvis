"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignatureIcon } from "lucide-react";
import { toast } from "sonner";

import { DocumentsPanel } from "@/components/documents/documents-panel";
import { Button } from "@/components/ui/button";
import type { AssetTypeView } from "@/lib/asset-types";
import {
  CONTRACT_STEPS,
  CONTRACT_STEP_LABELS,
  type ContractStep,
} from "@/lib/contract-steps";

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
 * What is happening, and how much of it is left.
 *
 * Segments rather than a percentage: the three phases take wildly different
 * amounts of time (filling a template is instant, launching Chromium is not),
 * so a bar that claimed to be 33% done would be lying. Three segments only
 * claim "one of three finished", which is true.
 *
 * Built from spans with display classes rather than divs — sonner renders this
 * inside its own description element, and a span nests validly wherever that
 * lands.
 */
function ProgressBody({ done, label }: { done: number; label: string }) {
  return (
    <span className="mt-1 block">
      <span className="block text-xs">{label}</span>
      <span className="mt-1.5 flex gap-1" aria-hidden="true">
        {CONTRACT_STEPS.map((step, index) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full bg-current ${
              index < done
                ? "opacity-100"
                : index === done
                  ? "animate-pulse opacity-70"
                  : "opacity-25"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * The contract generated for this lease, and nothing else.
 *
 * Split from Documents the way a property splits Images from Documents: one
 * tab holds what the system produced, the other holds what people file.
 *
 * **Generating streams into a toast.** The button used to POST, get a 202 and
 * say "refresh in a moment" — which could report that the message was accepted
 * and nothing else. A missing browser, a refused upload, a template that would
 * not resolve: all of them looked exactly like success. Each phase now arrives
 * as it starts, and a failure arrives with its actual message.
 *
 * It lives in a toast rather than in the page so the tab stays what it is — a
 * list of the contract on file — instead of growing a progress log that is
 * meaningless for the ~99% of visits where nothing is being generated. The
 * failure toast is the one exception to a toast's usual manners: it does not
 * auto-dismiss, because an error message that disappears before it is read is
 * the exact problem this replaced.
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

    // One id for the whole run, so each phase *replaces* the last instead of
    // stacking three toasts on top of each other.
    const toastId = `contract-${leaseId}`;

    /*
     * The last phase the server said it had started. This — not the `reason`
     * on the error event — is what names where a run stopped: the server
     * reports the kind of fault, while the step it was in the middle of is
     * simply the last one it announced. Tracking it here keeps the two
     * vocabularies from having to agree.
     */
    let current: ContractStep | null = null;

    /*
     * `??` is not enough of a guard here. A thrown `AggregateError` — a refused
     * connection, most often — carries an *empty* message, and an empty string
     * passes straight through `??` to render a failure toast that explains
     * nothing. The server describes those properly now; this is the second
     * line, covering fetch's own errors and any future caller.
     */
    const fail = (reported: string | undefined) => {
      const message = reported?.trim()
        ? reported
        : "No error detail was reported — check the server logs";
      setFailed(true);
      toast.error("The contract could not be generated", {
        id: toastId,
        description: (
          <span className="mt-1 block">
            {current && (
              <span className="block text-xs opacity-90">
                Stopped at: {CONTRACT_STEP_LABELS[current]}
              </span>
            )}
            {/* The server's own words. A rewritten message is a message that
                cannot name the file, the bucket or the missing binary. */}
            <span className="mt-1 block font-mono text-xs break-words">
              {message}
            </span>
          </span>
        ),
        duration: Infinity,
        closeButton: true,
        position: TOAST_POSITION,
        style: FAILURE_STYLE,
      });
    };

    let response: Response;
    try {
      response = await fetch(`/api/leases/${leaseId}/contract`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
      });
    } catch (cause) {
      setRunning(false);
      fail(cause instanceof Error ? cause.message : String(cause));
      return;
    }

    // Refusals happen before the stream opens, so they are still plain JSON.
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      setRunning(false);
      fail(data?.error || `Request failed (${response.status})`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handle = (event: {
      type: string;
      step?: ContractStep;
      label?: string;
      message?: string;
      reason?: string;
      fileName?: string;
      missing?: string[];
    }) => {
      if (event.type === "step" && event.step) {
        current = event.step;
        toast.loading("Generating contract", {
          id: toastId,
          description: (
            <ProgressBody
              // The step that just *started* is the one in flight, so every
              // step before it is finished — the server does not begin one
              // until the previous returned.
              done={CONTRACT_STEPS.indexOf(event.step)}
              label={event.label ?? CONTRACT_STEP_LABELS[event.step]}
            />
          ),
          duration: Infinity,
          closeButton: false,
          position: TOAST_POSITION,
          style: DEFAULT_STYLE,
        });
        return;
      }

      if (event.type === "done") {
        const blanks = event.missing?.length ?? 0;
        toast.success(`${event.fileName} filed`, {
          id: toastId,
          description:
            blanks > 0
              ? `${blanks} field${blanks === 1 ? "" : "s"} had no data`
              : undefined,
          duration: 6000,
          closeButton: false,
          position: TOAST_POSITION,
          style: DEFAULT_STYLE,
        });
        router.refresh();
        return;
      }

      if (event.type === "error") {
        fail(event.message);
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; a partial frame stays in
        // the buffer until the rest of it arrives.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((part) => part.startsWith("data:"));
          if (!line) continue;
          try {
            handle(JSON.parse(line.slice(5).trim()));
          } catch {
            // A frame we cannot parse is not worth killing the stream over.
          }
        }
      }
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
            {running ? "Generating…" : failed ? "Try again" : "Generate contract"}
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

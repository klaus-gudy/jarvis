"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CheckIcon,
  FileSignatureIcon,
  LoaderIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentsPanel } from "@/components/documents/documents-panel";
import { Button } from "@/components/ui/button";
import type { AssetTypeView } from "@/lib/asset-types";
import {
  CONTRACT_STEP_LABELS,
  type ContractStep,
} from "@/lib/contract-steps";

type DocumentView = React.ComponentProps<typeof DocumentsPanel>["documents"][number];

/** One line of the live log, in the order the server reached it. */
type StepLine = { step: ContractStep; label: string; state: "running" | "done" };

type Failure = { message: string; reason: string };

/**
 * The contract generated for this lease, and nothing else.
 *
 * Split from Documents the way a property splits Images from Documents: one
 * tab holds what the system produced, the other holds what people file.
 *
 * **Generating streams.** The button used to POST, get a 202 and say "refresh
 * in a moment" — which could report that the message was accepted and nothing
 * else. A missing browser, a refused upload, a template that would not resolve:
 * all of them looked exactly like success. Now each phase arrives as it starts
 * and the failure arrives with its actual message, in the page, staying put.
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
  const [steps, setSteps] = React.useState<StepLine[]>([]);
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const hasContract = documents.length > 0;

  async function handleGenerate() {
    setRunning(true);
    setSteps([]);
    setFailure(null);

    let response: Response;
    try {
      response = await fetch(`/api/leases/${leaseId}/contract`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
      });
    } catch (cause) {
      setRunning(false);
      setFailure({
        reason: "network",
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return;
    }

    // Refusals happen before the stream opens, so they are still plain JSON.
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      setRunning(false);
      setFailure({
        reason: "request",
        message: data?.error ?? `Request failed (${response.status})`,
      });
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
        const { step, label } = event;
        setSteps((current) => [
          // Whatever was running has, by definition, finished — the server
          // only starts the next phase once the previous one returned.
          ...current.map((line) => ({ ...line, state: "done" as const })),
          { step, label: label ?? CONTRACT_STEP_LABELS[step], state: "running" },
        ]);
        return;
      }

      if (event.type === "done") {
        setSteps((current) =>
          current.map((line) => ({ ...line, state: "done" as const }))
        );
        const blanks = event.missing?.length ?? 0;
        toast.success(
          blanks > 0
            ? `${event.fileName} filed — ${blanks} field${blanks === 1 ? "" : "s"} had no data`
            : `${event.fileName} filed`
        );
        router.refresh();
        return;
      }

      if (event.type === "error") {
        setFailure({
          reason: event.reason ?? "unknown",
          message: event.message ?? "The contract could not be generated",
        });
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
      setFailure({
        reason: "stream",
        message: cause instanceof Error ? cause.message : String(cause),
      });
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
            {running ? "Generating…" : failure ? "Try again" : "Generate contract"}
          </Button>
        </div>
      )}

      {/*
        The log stays after the run finishes rather than clearing itself: when
        something failed, the step it failed *at* is half the diagnosis.
      */}
      {steps.length > 0 && (
        <ol className="space-y-1.5 rounded-lg border bg-card px-4 py-3">
          {steps.map((line) => (
            <li key={line.step} className="flex items-center gap-2 text-sm">
              {line.state === "running" && !failure ? (
                <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : line.state === "done" && !failure ? (
                <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
              ) : line.state === "running" ? (
                <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
              ) : (
                <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
              )}
              <span
                className={
                  line.state === "running" && failure
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {line.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {failure && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            The contract could not be generated
          </p>
          {/* The server's own words. A rewritten message is a message that
              cannot name the file, the bucket or the missing binary. */}
          <p className="mt-1 font-mono text-xs break-words text-destructive/90">
            {failure.message}
          </p>
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

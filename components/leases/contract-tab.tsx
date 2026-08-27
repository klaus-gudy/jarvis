"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignatureIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { DocumentsPanel } from "@/components/documents/documents-panel";
import { Button } from "@/components/ui/button";
import type { AssetTypeView } from "@/lib/asset-types";

type DocumentView = React.ComponentProps<typeof DocumentsPanel>["documents"][number];

/**
 * A lease's papers — the generated contract among them, not beside them.
 *
 * It is filed as a `FileAsset` like every other document, so it is listed,
 * downloaded and deleted by `DocumentsPanel` exactly as a scanned signed
 * agreement is. The only thing this component adds is the button that asks for
 * one to be made.
 */
export function ContractTab({
  leaseId,
  reference,
  documents,
  assetTypes,
  hasContract,
}: {
  leaseId: string;
  reference: string;
  documents: DocumentView[];
  assetTypes: AssetTypeView[];
  /** Whether a generated contract is already on file for this lease. */
  hasContract: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleGenerate() {
    setPending(true);

    const response = await fetch(`/api/leases/${leaseId}/contract`, {
      method: "POST",
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not queue the contract");
      return;
    }

    /*
      Queued, not made — the worker renders it. Saying so plainly beats a
      spinner that would have to lie about when it is finished, since this
      request genuinely cannot know.
    */
    toast.success(
      hasContract
        ? "Regenerating the contract — refresh in a moment."
        : "Generating the contract — refresh in a moment."
    );
    // A best-effort nudge: the row often lands before someone looks away.
    setTimeout(() => router.refresh(), 2500);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {hasContract
            ? `The contract for ${reference}, generated from your default lease template.`
            : `No contract on file for ${reference} yet.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={handleGenerate}
          disabled={pending}
        >
          {hasContract ? <RefreshCwIcon /> : <FileSignatureIcon />}
          {pending
            ? "Queueing…"
            : hasContract
              ? "Regenerate contract"
              : "Generate contract"}
        </Button>
      </div>

      <DocumentsPanel
        subjectType="LEASE"
        subjectId={leaseId}
        assetTypes={assetTypes}
        documents={documents}
        emptyMessage="No contract documents yet. Generate one from your lease template, or upload a signed copy."
        uploadLabel="Upload document"
      />
    </div>
  );
}

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
 * The contract generated for this lease, and nothing else.
 *
 * Split from Documents the way a property splits Images from Documents: one
 * tab holds what the system produced, the other holds what people file. They
 * are read for different reasons and only one of them is uploaded into.
 *
 * **The Generate button appears only when there is no contract.** In the
 * normal case the worker has already made one and a button beside it would be
 * a second way to do the same thing. But a lease signed before contracts
 * existed, or one whose render dead-lettered, would otherwise show an empty
 * tab with no way out — so the button is the recovery, present exactly when
 * there is something to recover from. `worker/backfill-contracts.ts` is the
 * same operation for every lease at once.
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
  const [pending, setPending] = React.useState(false);
  const hasContract = documents.length > 0;

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
    toast.success("Generating the contract — refresh in a moment.");
    // A best-effort nudge: the row often lands before someone looks away.
    setTimeout(() => router.refresh(), 2500);
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
            disabled={pending}
          >
            <FileSignatureIcon />
            {pending ? "Queueing…" : "Generate contract"}
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

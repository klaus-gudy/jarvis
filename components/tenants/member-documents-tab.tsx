"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadDialog } from "@/components/tenants/document-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ASSET_TYPE_LABELS,
  formatFileSize,
  TENANT_ASSET_TYPES,
} from "@/lib/document-options";
import { formatDate } from "@/lib/format";
import type { FileAssetType } from "@/lib/generated/prisma/enums";

/**
 * The documents held against one member — NIDA, passport, employment letter,
 * anything else scanned in. Serialised rather than passed as `DocumentRow`:
 * `createdAt` is a Date, and Dates do not survive the server/client boundary.
 */
export type MemberDocument = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: FileAssetType;
  /** ISO string. */
  createdAt: string;
  uploadedByName: string | null;
};

function DocumentIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) {
    return <ImageIcon className="size-4.5 text-muted-foreground" />;
  }
  if (fileType === "application/pdf") {
    return <FileTextIcon className="size-4.5 text-muted-foreground" />;
  }
  return <FileIcon className="size-4.5 text-muted-foreground" />;
}

export function MemberDocumentsTab({
  membershipId,
  documents,
  memberName,
}: {
  membershipId: string;
  documents: MemberDocument[];
  memberName: string;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<MemberDocument | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const response = await fetch(`/api/documents/${deleting.id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete the document");
      return;
    }

    setDeleting(null);
    toast.success("Document deleted");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
          <div className="min-w-0">
            <CardTitle className="text-base">Documents</CardTitle>
            <p className="text-sm text-muted-foreground">
              Identification and supporting files held for this member.
            </p>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <PlusIcon />
            Upload
          </Button>
        </CardHeader>

        <CardContent className={documents.length > 0 ? "p-0" : undefined}>
          {documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No documents yet. Upload a NIDA card, passport or employment
              letter to keep it on file.
            </p>
          ) : (
            <ul className="divide-y">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <DocumentIcon fileType={document.fileType} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Opens in a new tab rather than navigating: the
                          response is a PDF or an image, and replacing the page
                          with it loses the member you were looking at. */}
                      <a
                        href={`/api/documents/${document.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium hover:underline"
                      >
                        {document.fileName}
                      </a>
                      <Badge variant="outline" className="shrink-0">
                        {ASSET_TYPE_LABELS[document.assetType]}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFileSize(document.sizeBytes)} ·{" "}
                      {formatDate(new Date(document.createdAt))}
                      {document.uploadedByName
                        ? ` · ${document.uploadedByName}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Download ${document.fileName}`}
                      nativeButton={false}
                      render={
                        <a
                          href={`/api/documents/${document.id}?download`}
                          // The route sets Content-Disposition: attachment, so
                          // this needs no `download` attribute — and must not
                          // have one, since it is a cross-route link.
                        />
                      }
                    >
                      <DownloadIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${document.fileName}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(document)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DocumentUploadDialog
        key={String(uploadOpen)}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        subjectType="membership"
        subjectId={membershipId}
        assetTypes={TENANT_ASSET_TYPES}
        title="Upload document"
        description={`Kept against ${memberName} and visible to this organization only.`}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              {deleting?.fileName} will be removed from the file store. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

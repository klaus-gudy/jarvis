"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssetTypeView } from "@/lib/asset-types";
import type { DocumentView } from "@/lib/document-options";
import { formatDate } from "@/lib/format";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";

function DocumentIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) {
    return <ImageIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (fileType === "application/pdf") {
    return <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}

/**
 * The documents held against one subject — a member's NIDA, a property's title
 * deed, later a lease's signed agreement. One component for all of them, since
 * a document list differs only in which types it offers and which record it
 * hangs off: two tables that drift apart is exactly what a second copy buys.
 *
 * No card header. Every caller already sits under a heading that says
 * "Documents" — a tab, or a section title — and repeating the word only pushes
 * the first row further down.
 */
export function DocumentsPanel({
  subjectType,
  subjectId,
  documents,
  assetTypes,
  emptyMessage,
  uploadLabel = "Upload document",
}: {
  subjectType: FileAssetSubject;
  subjectId: string | null;
  documents: DocumentView[];
  assetTypes: AssetTypeView[];
  emptyMessage: string;
  uploadLabel?: string;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<DocumentView | null>(null);
  const [deleting, setDeleting] = React.useState<DocumentView | null>(null);
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <PlusIcon />
          {uploadLabel}
        </Button>
      </div>

      <Card>
        <CardContent className={documents.length > 0 ? "px-0" : undefined}>
          {documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            // No scroll wrapper here: `Table` already renders its own
            // `data-slot="table-container"` with `overflow-x-auto`, and nesting
            // a second one just creates a scroller that never scrolls.
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date added</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">
                      {/* The name opens the viewer too — a row you can only
                          act on from a 28px icon at the far right reads as
                          inert. */}
                      <button
                        type="button"
                        onClick={() => setViewing(document)}
                        className="flex max-w-[22rem] items-center gap-2 text-left hover:underline"
                      >
                        <DocumentIcon fileType={document.fileType} />
                        <span className="truncate">{document.fileName}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {document.assetType.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(new Date(document.createdAt))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {document.uploadedByName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View ${document.fileName}`}
                          onClick={() => setViewing(document)}
                        >
                          <EyeIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download ${document.fileName}`}
                          nativeButton={false}
                          render={
                            <a
                              href={`/api/documents/${document.id}?download`}
                              // The route sets Content-Disposition: attachment,
                              // so this needs no `download` attribute — and must
                              // not have one, since it is a cross-route link.
                            />
                          }
                        >
                          <DownloadIcon />
                        </Button>
                        {/* Always red, not just on hover — matches the delete
                            action on every other table in the app (e.g.
                            PaymentAccountsCard): danger reads from the icon at
                            rest, not as a hover surprise. */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${document.fileName}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleting(document)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DocumentViewerDialog
        document={viewing}
        onClose={() => setViewing(null)}
      />

      <DocumentUploadDialog
        key={String(uploadOpen)}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        subjectType={subjectType}
        subjectId={subjectId}
        assetTypes={assetTypes}
        existingTypeIds={documents.map((document) => document.assetType.id)}
        title={uploadLabel}
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
    </div>
  );
}

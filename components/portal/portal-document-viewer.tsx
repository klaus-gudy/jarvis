"use client"

import * as React from "react"

import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog"

export type PortalViewableDocument = {
  id: string
  fileName: string
  fileType: string
  sizeBytes: number
  /** Shown as the badge beside the file name. */
  label: string
}

/**
 * A tenant's file, opened in the same viewer the landlord uses rather than a
 * new tab — which some browsers turn into a download. Download stays one click
 * away in the dialog's footer.
 *
 * The trigger is a plain `<button>` styled by the caller, so it can be a
 * primary button, a quick-action row or a link in a list.
 */
export function PortalDocumentViewer({
  document,
  className,
  children,
}: {
  document: PortalViewableDocument
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <DocumentViewerDialog
        document={open ? { ...document, assetType: { label: document.label } } : null}
        onClose={() => setOpen(false)}
        basePath="/api/portal/documents"
      />
    </>
  )
}

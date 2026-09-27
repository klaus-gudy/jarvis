"use client"

import * as React from "react"
import { DownloadIcon, EyeIcon } from "lucide-react"

import { DocumentIcon } from "@/components/documents/documents-panel"
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog"
import { LeaseStatusPill } from "@/components/portal/lease-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDate } from "@/lib/format"
import type { LeaseStatus } from "@/lib/leases"

/** One file on one of the tenant's leases, flattened for the table. */
export type LeaseDocumentRow = {
  id: string
  fileName: string
  fileType: string
  sizeBytes: number
  /** The file's type, e.g. "Generated contract". */
  label: string
  /** ISO string. */
  createdAt: string
  /** "Property · Unit A3". */
  lease: string
  leaseStatus: LeaseStatus
  /** ISO strings. */
  startDate: string
  endDate: string
  durationMonths: number
}

function term(row: LeaseDocumentRow) {
  const months = `${row.durationMonths} month${row.durationMonths === 1 ? "" : "s"}`
  return `${formatDate(new Date(row.startDate))} – ${formatDate(new Date(row.endDate))} · ${months}`
}

/**
 * The tenant's lease files, laid out exactly like the landlord's
 * `DocumentsPanel` (the "My documents" tab beside it): a plain table in a card
 * — File name, Type, Lease, Date added, Actions — and a card per file on a
 * phone. Lease replaces Uploaded by and names the lease with its term, so every
 * row says which lease it belongs to. Read-only: View and Download, no Delete.
 */
export function LeaseDocumentsTable({ rows }: { rows: LeaseDocumentRow[] }) {
  const isMobile = useIsMobile()
  const [viewing, setViewing] = React.useState<LeaseDocumentRow | null>(null)

  const download = (row: LeaseDocumentRow) => `/api/portal/documents/${row.id}?download`

  return (
    <>
      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing yet. Your contract will appear here once it is generated.
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10"
            >
              <button
                type="button"
                onClick={() => setViewing(row)}
                className="min-w-0 flex-1 space-y-1.5 text-left outline-none"
              >
                <div className="flex items-center gap-2">
                  <DocumentIcon fileType={row.fileType} />
                  <span className="truncate text-sm font-medium">{row.fileName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant="outline" className="font-normal">
                    {row.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(new Date(row.createdAt))}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="truncate">{row.lease}</span>
                  <LeaseStatusPill status={row.leaseStatus} />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{term(row)}</p>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 shrink-0"
                aria-label={`Download ${row.fileName}`}
                nativeButton={false}
                render={<a href={download(row)} />}
              >
                <DownloadIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lease</TableHead>
                  <TableHead>Date added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => setViewing(row)}
                        className="flex max-w-[22rem] items-center gap-2 text-left hover:underline"
                      >
                        <DocumentIcon fileType={row.fileType} />
                        <span className="truncate">{row.fileName}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {row.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap">{row.lease}</span>
                          <LeaseStatusPill status={row.leaseStatus} />
                        </div>
                        <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          {term(row)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(new Date(row.createdAt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View ${row.fileName}`}
                          onClick={() => setViewing(row)}
                        >
                          <EyeIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download ${row.fileName}`}
                          nativeButton={false}
                          render={<a href={download(row)} />}
                        >
                          <DownloadIcon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DocumentViewerDialog
        document={viewing ? { ...viewing, assetType: { label: viewing.label } } : null}
        onClose={() => setViewing(null)}
        basePath="/api/portal/documents"
      />
    </>
  )
}

import { FolderOpenIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { DocumentLink } from "@/components/portal/lease-parts"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireTenantPage } from "@/lib/authz"
import { formatDate } from "@/lib/format"
import { getPortalDocuments, type PortalDocument } from "@/lib/portal"

export const metadata = { title: "Documents" }

export default async function PortalDocumentsPage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const { leases, own } = await getPortalDocuments(access)
  if (leases.length === 0 && own.length === 0) {
    return (
      <EmptyState
        icon={FolderOpenIcon}
        title="No documents yet"
        description="Your contracts and any files your landlord keeps for you will appear here."
      />
    )
  }

  return (
    // The Home dashboard uses the full width; reading pages stay narrow.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {leases.map((lease) => (
        <Card key={lease.id}>
          <CardHeader>
            <CardTitle>{lease.title}</CardTitle>
            <CardDescription>{lease.reference}</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentList documents={lease.documents} />
          </CardContent>
        </Card>
      ))}

      {own.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your files</CardTitle>
            <CardDescription>Filed under you rather than a lease.</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentList documents={own} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DocumentList({ documents }: { documents: PortalDocument[] }) {
  return (
    <ul className="divide-y rounded-md border text-sm">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <DocumentLink id={doc.id}>{doc.fileName}</DocumentLink>
          <span className="shrink-0 text-right text-muted-foreground">
            {doc.label}
            <span className="hidden sm:inline"> · {formatDate(doc.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

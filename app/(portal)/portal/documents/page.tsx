import { DocumentsPanel } from "@/components/documents/documents-panel"
import { DocumentLink } from "@/components/portal/lease-parts"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listAssetTypes } from "@/lib/asset-types"
import { requireTenantPage } from "@/lib/authz"
import { listDocuments } from "@/lib/documents"
import { formatDate } from "@/lib/format"
import { getPortalLeaseDocuments, type PortalDocument } from "@/lib/portal"

export const metadata = { title: "Documents" }

/**
 * Two halves. **Your documents** is the tenant's own checklist — every
 * document type an organization keeps for a member (NIDA, passport, employment
 * letter…), uploaded or not, each missing one with its own Upload button. It is
 * the same `DocumentsPanel` the landlord sees on the member page, filing into
 * the same `/api/documents`, which lets any member manage files under their own
 * membership. **Lease documents** are the landlord's (the contract above all),
 * so they are listed to open, not to change.
 */
export default async function PortalDocumentsPage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const [assets, assetTypes, leases] = await Promise.all([
    listDocuments(access.organizationId, "MEMBERSHIP", access.membershipId),
    listAssetTypes(access.organizationId, "MEMBERSHIP"),
    getPortalLeaseDocuments(access),
  ])
  // The profile photo is a membership file too, but it lives on the Profile
  // page's avatar — same split as the landlord's member page.
  const documents = assets
    .filter((asset) => !asset.assetType.isPhoto)
    // Dates must be serialisable to cross the server/client boundary.
    .map((asset) => ({ ...asset, createdAt: asset.createdAt.toISOString() }))
  const documentTypes = assetTypes.filter((type) => !type.isPhoto)

  return (
    // The Home dashboard uses the full width; reading pages stay narrow.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Your documents</h2>
          <p className="text-sm text-muted-foreground">
            Copies your landlord keeps on file for you. Upload anything still missing.
          </p>
        </div>
        <DocumentsPanel
          subjectType="MEMBERSHIP"
          subjectId={access.membershipId}
          documents={documents}
          assetTypes={documentTypes}
          emptyMessage="No document types are set up yet."
        />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Lease documents</h2>
          <p className="text-sm text-muted-foreground">
            Contracts and files your landlord has added to your leases.
          </p>
        </div>
        {leases.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing yet. Your contract will appear here once it is generated.
              </p>
            </CardContent>
          </Card>
        ) : (
          leases.map((lease) => (
            <Card key={lease.id}>
              <CardHeader>
                <CardTitle>{lease.title}</CardTitle>
                <CardDescription>{lease.reference}</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList documents={lease.documents} />
              </CardContent>
            </Card>
          ))
        )}
      </section>
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

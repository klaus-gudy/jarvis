import { DocumentsPanel } from "@/components/documents/documents-panel"
import { LeaseDocumentsTable } from "@/components/portal/lease-documents-table"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listAssetTypes } from "@/lib/asset-types"
import { requireTenantPage } from "@/lib/authz"
import { listDocuments } from "@/lib/documents"
import { getPortalLeaseDocuments } from "@/lib/portal"

export const metadata = { title: "Documents" }

/**
 * Two tabs. **My documents** is the tenant's own checklist — every
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
  // One row per file, each carrying its lease — serialised for the client table.
  const leaseRows = leases.flatMap((lease) =>
    lease.documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      sizeBytes: doc.sizeBytes,
      label: doc.label,
      createdAt: doc.createdAt.toISOString(),
      lease: lease.title,
      unit: lease.unit,
      leaseStatus: lease.status,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate.toISOString(),
      durationMonths: lease.durationMonths,
    }))
  )
  const leaseFileCount = leaseRows.length

  return (
    // The Home dashboard uses the full width; reading pages stay narrow.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* Same tab strip as the landlord's member page. */}
      <Tabs defaultValue="mine">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="mine" className="flex-none gap-2 px-3">
            My documents
            {/* Hidden at zero — a "0" beside a tab reads as a problem. */}
            {documents.length > 0 && <Count value={documents.length} />}
          </TabsTrigger>
          <TabsTrigger value="leases" className="flex-none gap-2 px-3">
            Lease documents
            {leaseFileCount > 0 && <Count value={leaseFileCount} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-3 pt-5">
          <DocumentsPanel
            subjectType="MEMBERSHIP"
            subjectId={access.membershipId}
            documents={documents}
            assetTypes={documentTypes}
            emptyMessage="No document types are set up yet."
          />
        </TabsContent>

        <TabsContent value="leases" className="space-y-3 pt-5">
          <LeaseDocumentsTable rows={leaseRows} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">{value}</span>
  )
}

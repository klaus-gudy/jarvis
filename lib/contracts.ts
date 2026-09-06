import type { ContractStepReporter } from "@/lib/contract-steps";
import { createDocument, deleteDocument } from "@/lib/documents";
import { CONTRACT_CSS } from "@/lib/lease-document-style";
import {
  ensureDefaultLeaseTemplate,
  generateLeaseContract,
} from "@/lib/lease-templates";
import { htmlToPdf } from "@/lib/pdf";
import { leaseReference } from "@/lib/leases";
import { prisma } from "@/lib/prisma";

/**
 * Lease template → filled HTML → PDF → object storage → a `FileAsset` row.
 *
 * The four steps are deliberately separate things that already existed:
 * `generateLeaseContract` fills the placeholders from the database,
 * `htmlToPdf` renders, and `createDocument` is the same single door every
 * uploaded file goes through — so a generated contract is stored, listed,
 * downloaded and deleted by exactly the code that handles a scanned one. That
 * is what "consistent with how we keep our records" has to mean in practice:
 * not a parallel table for machine-made files.
 */

/** The seeded type from `20260826150000_lease_contract_type`. */
export const LEASE_CONTRACT_TYPE_ID = "sys_LEASE_CONTRACT";

export type ContractResult =
  | { ok: true; documentId: string; fileName: string; missing: string[] }
  | {
      ok: false;
      reason: "no-template" | "no-lease" | "storage" | "render";
      message: string;
    };

/**
 * Turns a thrown value into something worth showing a person.
 *
 * `cause.message` alone is not enough. Node throws an **`AggregateError` with
 * an empty message** when a connection is refused on several addresses — which
 * is precisely what a stopped MinIO looks like — so the toast that exists to
 * explain the failure rendered a blank line under "Stopped at". The detail is
 * all in `errors[]` and in `code`, never in `message`.
 *
 * So: unwrap aggregates, and fall back to the error's `code` (`ECONNREFUSED`)
 * or its class name rather than to nothing. Whatever comes back is the string
 * the worker logs and the Contract tab prints, so "" is never an answer.
 */
export function describeError(cause: unknown): string {
  if (!(cause instanceof Error)) return String(cause) || "Unknown error";

  const parts = [cause.message.trim()];

  // AggregateError.errors — each one carries the address it could not reach.
  const nested = (cause as AggregateError).errors;
  if (Array.isArray(nested)) {
    const seen = new Set<string>();
    for (const item of nested) {
      const text = describeError(item);
      if (text && !seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
    }
  }

  const described = parts.filter(Boolean).join(" — ");
  if (described) return described;

  const code = (cause as NodeJS.ErrnoException).code;
  return code ? `${cause.name}: ${code}` : cause.name;
}

/**
 * Wraps the filled body in a document Chromium can print.
 *
 * The stylesheet is `CONTRACT_CSS` — the same one the editor surface and the
 * preview iframe read. A second, print-only stylesheet would be a second
 * definition of what a contract looks like, and the two would disagree within
 * a month.
 */
function printableDocument(bodyHtml: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; }
  html, body { margin: 0; background: #fff; }
  ${CONTRACT_CSS}
  /* The screen version centres a 720px page inside a grey surround; on paper
     the page *is* the paper, so the wrapper gives up its own margins. */
  .jarvis-doc .contract { max-width: none; margin: 0; padding: 0; }
  /* Nothing in a contract should be split across a page break mid-signature. */
  .jarvis-doc table, .jarvis-doc .signatures { break-inside: avoid; }
  .jarvis-doc h1, .jarvis-doc h2, .jarvis-doc h3 { break-after: avoid; }
</style></head><body class="jarvis-doc">${bodyHtml}</body></html>`;
}

/**
 * Generates and files the contract for one lease, replacing any previous one.
 *
 * Returns a result rather than throwing for the outcomes a caller can act on —
 * "this organization has no template yet" is a normal state, not a fault, and
 * the worker should not retry it forever.
 */
export async function generateAndStoreContract(
  organizationId: string,
  leaseId: string,
  onStep: ContractStepReporter = () => {}
): Promise<ContractResult> {
  onStep("template");
  let rendered = await generateLeaseContract(organizationId, leaseId);

  /*
   * No template is no longer a dead end. An organization signing its first
   * lease gets the standard starter, filed as its default, and this attempt
   * carries on — the alternative was an empty Contract tab and a settings page
   * nobody knew to visit. Only retried once, and only for this reason: a
   * second miss means the write itself failed, not that the template was
   * missing.
   */
  if ("error" in rendered && rendered.error === "no-template") {
    const ensured = await ensureDefaultLeaseTemplate(organizationId);
    if (ensured) {
      console.log(
        ensured.created
          ? `[contracts] created a default lease template for org ${organizationId}`
          : `[contracts] promoted an existing template to default for org ${organizationId}`
      );
      rendered = await generateLeaseContract(organizationId, leaseId);
    }
  }

  if ("error" in rendered) {
    return rendered.error === "no-template"
      ? {
          ok: false,
          reason: "no-template",
          message:
            "This organization has no lease template, and one could not be created automatically.",
        }
      : {
          ok: false,
          reason: "no-lease",
          message: "Lease not found in this organization.",
        };
  }

  const { contract } = rendered;

  let pdf: Uint8Array;
  onStep("render");
  try {
    pdf = await htmlToPdf(printableDocument(contract.html), {
      footerText: `${contract.template.name} · ${contract.contractNumber}`,
    });
  } catch (cause) {
    return {
      ok: false,
      reason: "render",
      message: describeError(cause),
    };
  }

  onStep("store");

  // `allowsMultiple` is false on this type, so the previous contract has to go
  // before the new one can land. Deleted through `deleteDocument` rather than
  // by a raw query, so the object in the bucket goes with the row.
  const previous = await prisma.fileAsset.findFirst({
    where: { organizationId, leaseId, assetTypeId: LEASE_CONTRACT_TYPE_ID },
    select: { id: true },
  });
  if (previous) await deleteDocument(organizationId, previous.id);

  const fileName = `contract-${contract.contractNumber}.pdf`;

  try {
    const result = await createDocument(
      organizationId,
      // Generated, not uploaded — see the parameter's own note.
      null,
      {
        assetTypeId: LEASE_CONTRACT_TYPE_ID,
        subjectType: "LEASE",
        subjectId: leaseId,
      },
      { name: fileName, type: "application/pdf", bytes: pdf }
    );

    if ("error" in result) {
      return {
        ok: false,
        reason: "storage",
        message: `Could not file the contract: ${result.error}`,
      };
    }

    return {
      ok: true,
      documentId: result.document.id,
      fileName,
      // Surfaced, not swallowed: a contract with seven blank fill lines is
      // worth knowing about, and the worker logs it against the lease.
      missing: contract.missing,
    };
  } catch (cause) {
    return {
      ok: false,
      reason: "storage",
      message: describeError(cause),
    };
  }
}

export type LeaseMissingContract = {
  leaseId: string;
  organizationId: string;
  reference: string;
};

/**
 * Leases with no generated contract on file.
 *
 * The recovery for everything the event path cannot reach on its own: leases
 * signed before contracts existed, ones whose render dead-lettered twice, and
 * ones created while the broker or the worker was down. Scoped through the
 * membership, matching every other lease query — an `organizationId` narrows
 * it to one tenancy, omitting it sweeps them all, which is what an operator
 * running a one-off backfill actually wants.
 */
export async function findLeasesMissingContracts(
  organizationId?: string,
  limit?: number
): Promise<LeaseMissingContract[]> {
  const leases = await prisma.lease.findMany({
    where: {
      ...(organizationId
        ? {
            membership: { organizationId },
            unit: { property: { organizationId } },
          }
        : {}),
      // `none` rather than filtering in JS: the count of leases *with* a
      // contract grows without bound, and this only ever wants the gap.
      fileAssets: { none: { assetTypeId: LEASE_CONTRACT_TYPE_ID } },
    },
    // Oldest first, so a partial run makes predictable progress rather than
    // re-doing the same head of the list each time.
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
    select: { id: true, membership: { select: { organizationId: true } } },
  });

  return leases.map((lease) => ({
    leaseId: lease.id,
    organizationId: lease.membership.organizationId,
    reference: leaseReference(lease.id),
  }));
}

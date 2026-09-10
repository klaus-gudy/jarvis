import { ACCEPTED_FILE_TYPES } from "@/lib/document-options";
import {
  contractFileName,
  LEASE_CONTRACT_TYPE_ID,
} from "@/lib/contract-constants";
import { buildObjectKey } from "@/lib/documents";
import { describeError } from "@/lib/errors";
import type { LeaseCreatedEvent } from "@/lib/events/config";
import { CONTRACT_CSS } from "@/lib/lease-document-style";
import {
  ensureDefaultLeaseTemplate,
  generateLeaseContract,
} from "@/lib/lease-templates";
import { leaseReference } from "@/lib/leases";
import { prisma } from "@/lib/prisma";

/**
 * Lease template → filled HTML → **a message**.
 *
 * This file used to render the PDF too, through `lib/pdf.ts` and a headless
 * Chromium held in whatever process imported it. It does not any more: the
 * `document-worker` service owns rendering, and what this produces is the
 * message that asks it to — the finished HTML, and the object key the PDF is to
 * be stored under.
 *
 * The split is what removes a ~100MB browser from the web app. It also puts the
 * two halves of the decision in the same place and at the right time: the
 * wording filed is the wording in force when the lease was signed, rather than
 * whatever the template happens to say when a queue is next drained.
 */

export { LEASE_CONTRACT_TYPE_ID };

/**
 * A complete, self-contained HTML document.
 *
 * `document-worker` renders what it is given and adds nothing — and it blocks
 * every network request the page makes, so a linked stylesheet would not merely
 * be discouraged, it would silently fail and file an unstyled contract. The
 * stylesheet is inlined here for that reason, not as an optimisation.
 */
function printableDocument(bodyHtml: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${CONTRACT_CSS}
  /* The screen version centres a 720px page inside a grey surround; on paper
     the page *is* the paper, so the wrapper gives up its own margins. */
  .jarvis-doc .contract { max-width: none; margin: 0; padding: 0; }
  /* Nothing in a contract should be split across a page break mid-signature. */
  .jarvis-doc table, .jarvis-doc .signatures { break-inside: avoid; }
  .jarvis-doc h1, .jarvis-doc h2, .jarvis-doc h3 { break-after: avoid; }
</style></head><body class="jarvis-doc">${bodyHtml}</body></html>`;
}

export type ContractPlanFailure = {
  reason: "no-template" | "no-lease" | "unexpected";
  message: string;
};

/**
 * The message to publish, and the few facts about it worth reporting back to
 * whoever asked.
 *
 * `event` is deliberately the *whole* message and nothing more — the fields
 * beside it are not sent. `document-worker` would ignore them and cannot echo
 * them back, so putting them on the wire would be payload that only looks like
 * it is doing something. They exist so the Generate button can say which file
 * is coming and how many fields were left blank.
 */
export type ContractPlan = {
  event: LeaseCreatedEvent;
  contractNumber: string;
  fileName: string;
  missing: string[];
};

/**
 * The `lease.created` message for one lease, or why there isn't one.
 *
 * Called by the **producer** — the lease route and the backfill — after the
 * lease is committed and before the event is published. It does the two cheap
 * parts of making a contract (a template read and a `randomUUID()`) so that the
 * message says what the document contains and where it goes, rather than only
 * naming a lease for someone else to go and look up.
 *
 * The key comes from `buildObjectKey`, the same function every uploaded file's
 * key comes from — a generated contract has no business living somewhere a
 * scanned one wouldn't.
 *
 * **Never throws.** The lease is already committed by the time this runs, and a
 * template that will not resolve must not turn a successful signing into a 500.
 * Failures come back as a value the caller logs and moves past; the lease
 * simply has no contract until someone retries or the backfill sweeps it up.
 */
export async function buildContractPlan(
  organizationId: string,
  leaseId: string
): Promise<{ plan: ContractPlan } | { error: ContractPlanFailure }> {
  try {
    let rendered = await generateLeaseContract(organizationId, leaseId);

    /*
     * No template is not a dead end. An organization signing its first lease
     * gets the standard starter, filed as its default, and this attempt carries
     * on — the alternative was an empty Contract tab and a settings page nobody
     * knew to visit. Only retried once, and only for this reason: a second miss
     * means the write itself failed, not that the template was missing.
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
      return {
        error:
          rendered.error === "no-template"
            ? {
                reason: "no-template",
                message:
                  "This organization has no lease template, and one could not be created automatically.",
              }
            : {
                reason: "no-lease",
                message: "Lease not found in this organization.",
              },
      };
    }

    const { contract } = rendered;

    return {
      plan: {
        event: {
          // The wrapped document, not `contract.html`. Sending the bare body
          // would file a contract with no stylesheet at all — see
          // `printableDocument`.
          html: printableDocument(contract.html),
          objectKey: buildObjectKey({
            organizationId,
            subjectType: "LEASE",
            subjectId: leaseId,
            extension: ACCEPTED_FILE_TYPES["application/pdf"].extension,
          }),
          footerText: `${contract.template.name} · ${contract.contractNumber}`,
          // Carried so it comes back on `document.stored` and the row can be
          // filed without re-reading the lease. Opaque to the renderer.
          meta: {
            organizationId,
            leaseId,
            contractNumber: contract.contractNumber,
            fileName: contractFileName(contract.contractNumber),
            missing: contract.missing,
          },
        },
        contractNumber: contract.contractNumber,
        fileName: contractFileName(contract.contractNumber),
        // Surfaced, not swallowed: a contract with seven blank fill lines is
        // worth knowing about, and it is worth saying so while the person who
        // pressed the button is still looking.
        missing: contract.missing,
      },
    };
  } catch (cause) {
    return { error: { reason: "unexpected", message: describeError(cause) } };
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

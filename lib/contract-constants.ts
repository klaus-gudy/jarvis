/**
 * Facts about a lease contract that carry no dependencies.
 *
 * Same reason `lib/contract-steps.ts` exists: `lib/contracts.ts` reaches the
 * database, and a page that only needs to know *which asset type a contract is*
 * should not import Prisma to find out. `app/(app)/leases/[id]/page.tsx` used
 * to import `LEASE_CONTRACT_TYPE_ID` from `lib/contracts.ts`, which — while
 * that file still imported `lib/pdf.ts` — put Playwright in the Next server
 * graph for an ordinary page render.
 */

/** The seeded type from `20260826150000_lease_contract_type`. */
export const LEASE_CONTRACT_TYPE_ID = "sys_LEASE_CONTRACT";

/** The name a filed contract carries on download. One definition, two callers. */
export function contractFileName(contractNumber: string) {
  return `contract-${contractNumber}.pdf`;
}

/**
 * Client-safe half of the invoice module: types and pure helpers only, no
 * Prisma import. A client component importing a *runtime* value (not just a
 * type) from `lib/invoices.ts` would pull the driver into the browser bundle
 * and fail the build on `pg`'s `require('dns')` — same split, same reason, as
 * `lib/search-types.ts` and `lib/auth/constants.ts`.
 */

export type InvoiceStatus = "Unpaid" | "Partial" | "Paid";

/** Every status, in the order a filter should offer them. */
export const INVOICE_STATUSES = ["Unpaid", "Partial", "Paid"] as const;

/**
 * Status is derived, never stored — same rule this codebase already applies
 * to LeaseStatus and TenantStatus, so it can never drift from what's actually
 * been paid.
 */
export function deriveInvoiceStatus(amount: number, paid: number): InvoiceStatus {
  if (paid <= 0) return "Unpaid";
  if (paid >= amount) return "Paid";
  return "Partial";
}

/**
 * There is no invoice-number column, so the reference is derived from the tail
 * of the cuid, matching `leaseReference()`. Prefixed `INV-` so an invoice code
 * can't be mistaken for a lease's `L-` one.
 */
export function invoiceReference(id: string) {
  return `INV-${id.slice(-5).toUpperCase()}`;
}

export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "secondary" | "outline" | "destructive"
> = {
  Paid: "secondary",
  Partial: "outline",
  Unpaid: "destructive",
};

import { formatCurrencyFull, formatDate, formatDayMonth } from "@/lib/format";
import { leaseReference } from "@/lib/leases";

/**
 * Turns an `AuditLog` row into a sentence. Everything it needs is on the row:
 * `changes` holds a snapshot for a create or delete (so a deleted payment still
 * says how much it was) and `{ field: [before, after] }` for an update.
 */

type Changes = Record<string, unknown>;

export type ActivityChange = { label: string; before: string | null; after: string };

const LABELS: Record<string, string> = {
  name: "Name",
  label: "Label",
  address: "Address",
  category: "Category",
  status: "Status",
  rentAmount: "Rent",
  monthlyRent: "Monthly rent",
  leaseAmount: "Lease amount",
  amount: "Amount",
  dueDate: "Due date",
  paidAt: "Paid on",
  method: "Method",
  notes: "Notes",
  startDate: "Start date",
  endDate: "End date",
  durationMonths: "Duration (months)",
  autoRenew: "Auto-renew",
  minTenureMonths: "Minimum tenure (months)",
  unitType: "Type",
  floor: "Floor",
  block: "Block",
  sizeSqm: "Size (m²)",
  amenities: "Amenities",
  email: "Email",
  phone: "Phone",
  occupation: "Occupation",
  employer: "Employer",
  nationality: "Nationality",
  nidaNumber: "NIDA number",
  emergencyContactName: "Emergency contact",
  emergencyContactPhone: "Emergency phone",
  emergencyContactRelation: "Emergency relation",
  roleId: "Role",
  unitId: "Unit",
  membershipId: "Tenant",
  description: "Description",
  accountNumber: "Account number",
  accountName: "Account name",
  provider: "Provider",
};

const MONEY = new Set(["rentAmount", "monthlyRent", "leaseAmount", "amount"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function formatValue(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (MONEY.has(field) && typeof value === "number") return formatCurrencyFull(value);
  if (typeof value === "string" && ISO_DATE.test(value)) return formatDate(new Date(value));
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (Array.isArray(value)) return value.join(", ") || null;
  if (typeof value === "object") return null;
  return String(value);
}

const isDiff = (changes: Changes) =>
  Object.values(changes).length > 0 &&
  Object.values(changes).every((value) => Array.isArray(value) && value.length === 2);

/**
 * One line for an edit: the first two changes, then how many more —
 * "Rent TZS 450,000 → TZS 500,000 · Auto-renew Off · +1 more".
 */
export function summariseChanges(changes: unknown): string | undefined {
  const all = describeChanges(changes);
  if (all.length === 0) return undefined;
  const shown = all
    .slice(0, 2)
    .map((c) => (c.before !== null ? `${c.label} ${c.before} → ${c.after}` : `${c.label} ${c.after}`));
  if (all.length > 2) shown.push(`+${all.length - 2} more`);
  return shown.join(" · ");
}

/** The fields an update touched, readable. Ids and long text say only that they changed. */
export function describeChanges(changes: unknown): ActivityChange[] {
  if (!changes || typeof changes !== "object" || !isDiff(changes as Changes)) return [];
  return Object.entries(changes as Record<string, [unknown, unknown]>)
    .filter(([field]) => !field.endsWith("Key") && field !== "body" && field !== "renewedToId")
    .map(([field, [before, after]]) => {
      const opaque = field.endsWith("Id");
      return {
        label: LABELS[field] ?? humanise(field),
        before: opaque ? null : formatValue(field, before),
        after: opaque ? "changed" : (formatValue(field, after) ?? "cleared"),
      };
    });
}

function humanise(text: string) {
  const spaced = text.replace(/[._]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const money = (value: unknown) =>
  typeof value === "number" ? formatCurrencyFull(value) : null;
/** "1 Oct" — the summary line is meant to be glanced at. */
const date = (value: unknown) =>
  typeof value === "string" && ISO_DATE.test(value) ? formatDayMonth(new Date(value)) : null;
const join = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;
const after = (value: unknown) => (Array.isArray(value) ? value[1] : value);

/**
 * Title and one-line detail for an entry. Which lease, unit or tenant it
 * belongs to isn't repeated here — the timeline shows those as links.
 */
export function describeActivity(entry: {
  action: string;
  entityId: string;
  changes: unknown;
}): { title: string; detail?: string } {
  const c = (entry.changes && typeof entry.changes === "object" ? entry.changes : {}) as Changes;
  const ref = leaseReference(entry.entityId);

  switch (entry.action) {
    case "property.created":
      return { title: `Property ${c.name ?? ""} added`.trim(), detail: join(c.address as string) };
    case "property.updated":
      return { title: "Property details updated" };
    case "property.deleted":
      return { title: `Property ${c.name ?? ""} deleted`.trim() };

    case "unit.created":
      return {
        title: `Unit ${c.label ?? ""} added`.trim(),
        detail: join(money(c.rentAmount) && `${money(c.rentAmount)}/month`, c.unitType as string),
      };
    case "unit.updated":
      return { title: "Unit details updated" };
    case "unit.deleted":
      return { title: `Unit ${c.label ?? ""} deleted`.trim() };

    case "lease.created":
    case "lease.renewed":
      return {
        title: entry.action === "lease.renewed" ? `Lease ${ref} created as a renewal` : `Lease ${ref} created`,
        detail: join(
          typeof c.durationMonths === "number" &&
            `${c.durationMonths} month${c.durationMonths === 1 ? "" : "s"} from ${date(c.startDate)}`,
          money(c.monthlyRent) && `${money(c.monthlyRent)}/month`
        ),
      };
    case "lease.updated":
      return { title: `Lease ${ref} edited` };
    case "lease.deleted":
      return { title: `Lease ${ref} deleted` };
    case "lease.ended":
      return { title: `Lease ${ref} ended` };
    case "lease.status_changed":
      return { title: `Lease ${ref} marked ${String(after(c.status) ?? "changed").toLowerCase()}` };

    case "invoice.created":
      return {
        title: join("Invoice issued", money(c.amount))!,
        detail: join(date(c.dueDate) && `due ${date(c.dueDate)}`),
      };
    case "invoice.updated":
      return { title: "Invoice amended", detail: undefined };

    case "payment.recorded":
      return {
        title: join("Payment recorded", money(c.amount))!,
        detail: join(c.method as string, date(c.paidAt) && `paid on ${date(c.paidAt)}`),
      };
    case "payment.deleted":
      return {
        title: `Payment${money(c.amount) ? ` of ${money(c.amount)}` : ""} reversed`,
        detail: join(date(c.paidAt) && `paid on ${date(c.paidAt)}`),
      };
    case "payment_claim.submitted":
      return {
        title: `Tenant reported a payment${money(c.amount) ? ` of ${money(c.amount)}` : ""}`,
        detail: join(c.method as string),
      };
    case "payment_claim.confirmed":
      return { title: "Reported payment confirmed", detail: undefined };
    case "payment_claim.rejected":
      return { title: "Reported payment rejected", detail: undefined };

    case "document.uploaded":
      return { title: `${c.fileName ?? "File"} uploaded` };
    case "document.filed":
      return { title: `${c.fileName ?? "Contract"} filed` };
    case "document.deleted":
      return { title: `${c.fileName ?? "File"} deleted` };

    case "member.joined":
      return { title: "Joined the organization" };
    case "tenant.created":
      return { title: `Tenant ${c.name ?? ""} added`.trim() };
    case "member.updated":
      return { title: "Contact details updated" };
    case "member_profile.updated":
      return { title: "Profile details updated" };
    case "member.role_changed":
      return { title: "Role changed" };
    case "member.removed":
    case "tenant.removed":
      return { title: `${c.name ?? "Member"} removed from the organization` };
    case "signature.added":
      return { title: "Signature added" };
    case "signature.replaced":
      return { title: "Signature replaced" };
    case "signature.removed":
      return { title: "Signature removed" };
    case "payment_account.created":
      return { title: "Payment account added" };
    case "payment_account.updated":
      return { title: "Payment account updated" };
    case "payment_account.deleted":
      return { title: "Payment account removed" };
    case "invitation.created":
      return { title: "Invitation sent" };
    case "invitation.revoked":
      return { title: "Invitation revoked" };
    case "invitation.accepted":
      return { title: "Invitation accepted" };
  }
  return { title: humanise(entry.action) };
}

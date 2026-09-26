/**
 * The permission catalogue — every action a staff role can be allowed to take.
 *
 * Prisma-free on purpose (same split as `lib/role-constants.ts`): the Roles
 * page and `useCan()` import it on the client, and the server checks against
 * the same list.
 *
 * Permissions are stored as plain strings in `Role.permissions` (a Postgres
 * `text[]`), so this list — not the database — is the source of truth. A
 * string that is no longer here is ignored on read (`parsePermissions`), so
 * retiring a permission can never crash a request.
 *
 * Owners hold every permission implicitly (nothing is stored for them), so a
 * permission added here reaches every Owner without a migration. Tenants hold
 * none: they are a persona (`Role.kind = TENANT`) with their own portal, not a
 * set of staff permissions.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "property:read",
  "property:write",
  "tenant:read",
  "tenant:write",
  "lease:read",
  "lease:write",
  "lease:delete",
  "contract:generate",
  "payment:read",
  "payment:record",
  "payment:reverse",
  "document:read",
  "document:write",
  "member:read",
  "member:write",
  "member:invite",
  "sms:send",
  "role:manage",
  "template:manage",
  "export:run",
  "org:manage",
  "org:backup",
  "org:restore",
  "org:delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/**
 * Only an Owner may ever do these: they can destroy or replace the whole
 * organization. They are in the catalogue so routes can name them, but no
 * custom role can be given them.
 */
export const OWNER_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "org:restore",
  "org:delete",
]);

export function isGrantable(permission: Permission) {
  return !OWNER_ONLY_PERMISSIONS.has(permission);
}

/** Drops unknown and owner-only strings, de-duplicates, keeps catalogue order. */
export function parsePermissions(values: readonly string[]): Permission[] {
  const held = new Set(values);
  return PERMISSIONS.filter((p) => held.has(p) && isGrantable(p));
}

/** Mirrors the Prisma `RoleKind` enum without importing Prisma. */
export type RoleKind = "OWNER" | "STAFF" | "TENANT";

export type PermissionGroup = {
  label: string;
  permissions: { key: Permission; label: string; description: string }[];
};

/** How the Roles page lays the catalogue out. Owner-only entries are omitted. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Overview",
    permissions: [
      { key: "dashboard:read", label: "View dashboard", description: "Occupancy, billing totals and expiring leases" },
    ],
  },
  {
    label: "Properties",
    permissions: [
      { key: "property:read", label: "View properties", description: "Properties, units and their photos" },
      { key: "property:write", label: "Manage properties", description: "Add, edit, delete and import properties and units" },
    ],
  },
  {
    label: "Tenants",
    permissions: [
      { key: "tenant:read", label: "View tenants", description: "Tenant list, profiles and their leases" },
      { key: "tenant:write", label: "Manage tenants", description: "Add, edit, import and remove tenants" },
    ],
  },
  {
    label: "Leases",
    permissions: [
      { key: "lease:read", label: "View leases", description: "Leases, invoices and contracts" },
      { key: "lease:write", label: "Create and edit leases", description: "Including renewals and rent changes" },
      { key: "lease:delete", label: "Delete leases", description: "Removes the invoice and its payments too" },
      { key: "contract:generate", label: "Generate contracts", description: "Render a lease contract from a template" },
      { key: "template:manage", label: "Manage lease templates", description: "Edit contract wording and the default template" },
    ],
  },
  {
    label: "Payments",
    permissions: [
      { key: "payment:read", label: "View payments", description: "The payments ledger" },
      { key: "payment:record", label: "Record payments", description: "Add a payment against an invoice" },
      { key: "payment:reverse", label: "Reverse payments", description: "Delete a recorded payment" },
    ],
  },
  {
    label: "Documents",
    permissions: [
      { key: "document:read", label: "View documents", description: "Files attached to properties, units, leases and people" },
      { key: "document:write", label: "Upload and delete documents", description: "Including custom document types" },
    ],
  },
  {
    label: "People",
    permissions: [
      { key: "member:read", label: "View users", description: "Everyone in the organization and their roles" },
      { key: "member:write", label: "Manage users", description: "Edit details, change roles, remove members" },
      { key: "member:invite", label: "Invite users", description: "Send and revoke invitations" },
      { key: "sms:send", label: "Send SMS", description: "Text a member from their profile (billed per message)" },
      { key: "role:manage", label: "Manage roles", description: "Create, edit and delete roles" },
    ],
  },
  {
    label: "Organization",
    permissions: [
      { key: "export:run", label: "Export spreadsheets", description: "Download full-organization Excel exports" },
      { key: "org:backup", label: "Download backup", description: "A complete copy of the organization's data" },
      { key: "org:manage", label: "Organization settings", description: "Rename the organization, payment accounts" },
    ],
  },
];

/**
 * Starting points offered by the "New role" dialog. They are **not** seeded as
 * rows — picking one only pre-ticks the checkboxes of an ordinary custom role.
 */
export const ROLE_TEMPLATES: { id: string; name: string; permissions: Permission[] }[] = [
  {
    id: "manager",
    name: "Manager",
    permissions: PERMISSIONS.filter(
      (p) => isGrantable(p) && !["role:manage", "org:manage", "org:backup"].includes(p)
    ),
  },
  {
    id: "accountant",
    name: "Accountant",
    permissions: [
      "dashboard:read",
      "property:read",
      "tenant:read",
      "lease:read",
      "payment:read",
      "payment:record",
      "payment:reverse",
      "document:read",
      "member:read",
      "export:run",
    ],
  },
];

/** What a custom role predating permissions was given, so nobody lost access. */
export const LEGACY_STAFF_PERMISSIONS = ROLE_TEMPLATES[0].permissions;

/** Owners implicitly hold everything; tenants hold nothing staff-side. */
export function effectivePermissions(
  kind: RoleKind,
  stored: readonly string[]
): Permission[] {
  if (kind === "OWNER") return [...PERMISSIONS];
  if (kind === "TENANT") return [];
  return parsePermissions(stored);
}

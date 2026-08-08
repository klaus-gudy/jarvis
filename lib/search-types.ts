/**
 * Types and constants shared by the search API and the client component.
 *
 * Deliberately dependency-free: `lib/search.ts` imports Prisma, and a client
 * component importing a runtime value from there would drag the driver (and
 * its `dns` require) into the browser bundle. Same reasoning as
 * `lib/auth/constants.ts`.
 */

export type SearchResultType =
  | "property"
  | "unit"
  | "tenant"
  | "lease"
  /** A member who isn't a tenant — Owner, Manager, Caretaker and so on. */
  | "user";

export type SearchResult = {
  /** Unique across types — the raw row id can collide between tables. */
  key: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  /** Right-aligned detail: rent, status, reference. */
  meta: string | null;
  href: string;
};

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  property: "Property",
  unit: "Unit",
  tenant: "Tenant",
  lease: "Lease",
  user: "User",
};

/**
 * Badge classes per kind, built on the `--kind-*` tokens in globals.css.
 *
 * The tint is an alpha of the same colour as the text, so it composites over
 * whatever surface it lands on and needs no second set of dark-mode classes —
 * the token itself carries the per-theme lightness.
 */
export const SEARCH_TYPE_BADGE: Record<SearchResultType, string> = {
  property: "border-kind-property/25 bg-kind-property/10 text-kind-property",
  unit: "border-kind-unit/25 bg-kind-unit/10 text-kind-unit",
  tenant: "border-kind-tenant/25 bg-kind-tenant/10 text-kind-tenant",
  lease: "border-kind-lease/25 bg-kind-lease/10 text-kind-lease",
  user: "border-kind-user/25 bg-kind-user/10 text-kind-user",
};

/** Below this a query matches most of the database and the list is noise. */
export const MIN_QUERY_LENGTH = 2;

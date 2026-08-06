/**
 * Types and constants shared by the search API and the client component.
 *
 * Deliberately dependency-free: `lib/search.ts` imports Prisma, and a client
 * component importing a runtime value from there would drag the driver (and
 * its `dns` require) into the browser bundle. Same reasoning as
 * `lib/auth/constants.ts`.
 */

export type SearchResultType = "property" | "unit" | "tenant" | "lease";

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
};

/** Below this a query matches most of the database and the list is noise. */
export const MIN_QUERY_LENGTH = 2;

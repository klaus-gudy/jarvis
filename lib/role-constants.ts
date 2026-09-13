/**
 * The two role names the application itself depends on, with no dependencies
 * of their own.
 *
 * Split from `lib/roles.ts` because that file imports Prisma, and these are
 * needed by modules that must not: `lib/mail/config.ts` says in its own first
 * line that it is dependency-free so anything can import it, and reaching
 * `OWNER_ROLE_NAME` through `lib/roles.ts` would have quietly made that untrue.
 * Same split, same reason, as `lib/contract-constants.ts` and
 * `lib/auth/constants.ts`.
 *
 * `lib/roles.ts` re-exports both, so every existing importer is unaffected.
 */

/** Load-bearing: the sole-Owner guards in `lib/members.ts` and
 * `lib/invitations.ts` match on it, and owner-only mail resolves through it. */
export const OWNER_ROLE_NAME = "Owner";

/** Load-bearing: every tenant query matches on it. */
export const TENANT_ROLE_NAME = "Tenant";

/**
 * Role names are free text and editable per organization, so every comparison
 * against them is case-insensitive — the app already enforces one name per
 * organization that way, so "owner" and "Owner" are the same role and a check
 * that missed one would be a guard with a hole.
 */
export function isOwnerRole(name: string) {
  return name.trim().toLowerCase() === OWNER_ROLE_NAME.toLowerCase();
}

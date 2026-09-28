import { redirect } from "next/navigation";

import { needsEmailVerification } from "@/lib/auth/email-verification";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { firstAllowedPath } from "@/lib/nav";
import type { Permission, RoleKind } from "@/lib/permissions";

/**
 * Who is acting, in which organization, and what they may do there.
 *
 * Built from `getCurrentUser()`, which reads the membership and its role live
 * on every request — never from the session token — so a demoted or removed
 * member loses access on their next request, not when their cookie expires.
 */
export type AuthContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  kind: RoleKind;
  permissions: ReadonlySet<Permission>;
};

/** One permission, or several of which any one is enough. */
export type PermissionRequirement = Permission | readonly Permission[];

export function can(
  ctx: Pick<AuthContext, "kind" | "permissions">,
  requirement?: PermissionRequirement
) {
  // No bypass for any kind: a role can do exactly what is stored on it.
  if (!requirement) return true;
  const any = typeof requirement === "string" ? [requirement] : requirement;
  return any.some((p) => ctx.permissions.has(p));
}

type Result =
  | { ok: true; context: AuthContext }
  | { ok: false; response: Response };

const deny = (status: number, error: string, extra?: object): Result => ({
  ok: false,
  response: Response.json({ error, ...extra }, { status }),
});

async function resolve(): Promise<
  | { ok: true; context: AuthContext }
  | { ok: false; status: number; error: string; extra?: object }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  // Here rather than only in the app layout: a layout redirect is a UI
  // courtesy, not a boundary — the API is reachable directly.
  if (needsEmailVerification(user)) {
    return {
      ok: false,
      status: 403,
      error: "Verify your email address to continue",
      extra: { reason: "email-unverified" },
    };
  }

  const membership = user.activeMembership;
  if (!user.activeOrgId || !membership) {
    return { ok: false, status: 403, error: "No active organization" };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      organizationId: user.activeOrgId,
      membershipId: membership.id,
      kind: membership.kind,
      permissions: new Set(membership.permissions),
    },
  };
}

/**
 * The boundary for every staff API route: the caller's role must hold
 * `requirement` (any one, for a list), whatever its kind — a Tenant role that
 * has been given `lease:read` passes a `lease:read` route like anyone else.
 *
 * Called with no requirement it admits Owner and staff roles only; tenants
 * reach nothing that hasn't named a permission they hold.
 */
export async function authorize(requirement?: PermissionRequirement): Promise<Result> {
  const resolved = await resolve();
  if (!resolved.ok) return deny(resolved.status, resolved.error, resolved.extra);

  const { context } = resolved;
  if (!requirement && context.kind === "TENANT") {
    return deny(403, "This area is for organization staff", { reason: "tenant" });
  }
  if (!can(context, requirement)) {
    return deny(403, "You don't have permission to do that", {
      reason: "forbidden",
      required: requirement,
    });
  }
  return { ok: true, context };
}

/**
 * For the few routes every member may use about *themselves* (their own
 * signature, for instance), tenants included. The route must still check that
 * the record it touches is `context.membershipId`.
 */
export async function authorizeMember(): Promise<Result> {
  const resolved = await resolve();
  if (!resolved.ok) return deny(resolved.status, resolved.error, resolved.extra);
  return { ok: true, context: resolved.context };
}

/** For tenant-portal API routes. */
export async function authorizeTenant(): Promise<Result> {
  const resolved = await resolve();
  if (!resolved.ok) return deny(resolved.status, resolved.error, resolved.extra);
  if (resolved.context.kind !== "TENANT") {
    return deny(403, "This area is for tenants", { reason: "not-tenant" });
  }
  return { ok: true, context: resolved.context };
}

/**
 * Server-component gate for staff pages. Tenants are sent to their portal; a
 * staff member missing `requirement` is sent to the first page they *can*
 * open (or the no-access page). Returns the context so the page can pass it on.
 *
 * `null` means the user has no active organization at all — the page renders
 * its existing "No organization" empty state.
 */
export async function requireStaffPage(
  requirement?: PermissionRequirement
): Promise<AuthContext | null> {
  const resolved = await resolve();
  if (!resolved.ok) {
    if (resolved.status === 401) redirect(SESSION_EXPIRED_PATH);
    if ((resolved.extra as { reason?: string } | undefined)?.reason === "email-unverified") {
      redirect("/verify-email");
    }
    return null;
  }
  const { context } = resolved;
  const tenant = context.kind === "TENANT";
  if ((tenant && !requirement) || !can(context, requirement)) {
    // Somewhere they *can* go: another permitted page, else the portal for a
    // tenant, else the no-access page.
    redirect(firstAllowedPath(context) ?? (tenant ? "/portal" : "/no-access"));
  }
  return context;
}

/** Server-component gate for the tenant portal. */
export async function requireTenantPage(): Promise<AuthContext | null> {
  const resolved = await resolve();
  if (!resolved.ok) {
    if (resolved.status === 401) redirect(SESSION_EXPIRED_PATH);
    if ((resolved.extra as { reason?: string } | undefined)?.reason === "email-unverified") {
      redirect("/verify-email");
    }
    return null;
  }
  if (resolved.context.kind !== "TENANT") redirect("/dashboard");
  return resolved.context;
}

/** Serialisable form for handing to client components. */
export function clientPermissions(ctx: AuthContext) {
  return { kind: ctx.kind, permissions: [...ctx.permissions] };
}

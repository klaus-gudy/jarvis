# Jarvis — architecture & roadmap

Multi-tenant property management. An `Organization` owns `Property` → `Unit` → `Lease`. A `User` joins an org through a `Membership`, which carries an org-scoped `Role`. Tenants are not a separate model — a lease points at the tenant's `Membership`.

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-08-01 | Prisma 7 with `@prisma/adapter-pg` driver adapter | Prisma 7 requires explicit adapters; client generated to `lib/generated/prisma`, singleton in `lib/prisma.ts` |
| 2026-08-01 | Postgres 16 in Docker, host port 5439 → container 5432 | Avoids clashing with other local Postgres instances |
| 2026-08-01 | `Role` is an org-scoped model, not an enum | Orgs can define custom roles; `@@unique([organizationId, name])`; `Membership.role` is `onDelete: Restrict` so a role in use can't be deleted |
| 2026-08-01 | Ids are `cuid()` | Matches user-provided Lease spec; `HealthCheck` is legacy `uuid()` |
| 2026-08-01 | shadcn on `@base-ui/react`, not Radix | What `components.json` (style `base-nova`) scaffolds; triggers use the `render` prop |
| 2026-08-02 | Custom auth: JWT (`jose`, HS256) + `bcryptjs` | User choice — no auth library/service. `bcryptjs` because native `bcrypt`'s postinstall is blocked by allow-scripts here; `jose` runs in Node and Edge runtimes |
| 2026-08-02 | Phone number is a login identifier, not SMS OTP | No SMS provider in MVP; email stays the required primary identifier, phone optional |
| 2026-08-02 | No email verification / password reset in MVP | Avoids external email provider dependency this sprint |
| 2026-08-02 | Org creation folded into registration (no `/onboarding`) | User decision — registrant names their org at signup and becomes Owner via one `$transaction` |
| 2026-08-02 | Auth flows are route handlers (`/api/auth/*`), pages fetch them | User asked for endpoints; also keeps auth callable by future non-web clients |
| 2026-08-02 | Next 16: middleware is `proxy.ts` at repo root | Confirmed in bundled docs; `proxy.ts` imports only `lib/auth/constants` + `jwt` so Prisma stays out of that bundle |

## Auth design (current sprint)

- **Credentials**: email (required, unique) or phone (optional, unique) + password. Hash with `bcryptjs` (cost 10). Zod validation, password min length 8.
- **Session**: JWT signed with `jose` HS256, secret in `AUTH_SECRET` env. Stored in httpOnly cookie: `sameSite=lax`, `secure` in prod, 7-day expiry. Payload `{ sub: userId, orgId: activeOrgId | null }`.
- **Helpers** (`lib/auth/`): `hash.ts`, `jwt.ts`, `session.ts` (`getCurrentUser()` / `requireUser()` wrapped in React `cache()`), zod schemas.
- **Flows** (route handlers): `POST /api/auth/register`, `POST /api/auth/login` (identifier resolves as email if it contains `@`, else phone), `POST /api/auth/logout`, `GET /api/auth/me`.
- **Route protection**: `proxy.ts` at repo root (Next 16's renamed middleware) redirects unauthenticated page requests to `/login` and bounces authed users off `/login`/`/register`; API routes enforce auth themselves.
- **Org creation**: happens inside registration — one `$transaction` creates `User` + `Organization` + seeds an `Owner` `Role` + `Membership`, then the session cookie is issued with that `orgId`. Org switcher (re-issue cookie with new `orgId`) deferred until invitations exist.
- **Schema delta** (`auth_fields` migration): `User.passwordHash String`, `User.phone String? @unique`.

## Out of scope (future sprints)

SMS OTP (needs Twilio or similar) · email verification + password reset (needs Resend or similar) · member invitations · rate limiting / login lockout · RBAC permission enforcement beyond role seeding · refresh-token rotation.

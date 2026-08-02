# TASKS — Auth sprint

Design details in `plan.md` → "Auth design". Check items off as they land; don't start a phase before its predecessor is done unless noted.

> Scope change (2026-08-02): org creation folded into registration — no separate
> `/onboarding` page. Registrant becomes Owner of the org they name at signup.

## Phase 0 — Prep

- [x] Read Next 16 docs in `node_modules/next/dist/docs`: middleware/proxy, server actions, cookies, forms (middleware is now `proxy.ts`)
- [x] `npm install bcryptjs jose zod` (bcryptjs 3 ships its own types)
- [x] Add `AUTH_SECRET` to `.env`

## Phase 1 — Schema

- [x] Add `passwordHash String` and `phone String? @unique` to `User`
- [x] Migration `20260802165245_auth_fields` (via `migrate diff` + `migrate deploy` — `migrate dev` refuses non-TTY when a warning needs confirmation)
- [x] `npx prisma generate`

## Phase 2 — Auth core (`lib/auth/`)

- [x] `hash.ts` — bcryptjs hash/verify wrappers
- [x] `jwt.ts` — sign/verify via jose (HS256, `AUTH_SECRET`, 7d expiry)
- [x] `session.ts` — cookie get/set/clear, `getCurrentUser()`, `requireUser()` (React `cache()`)
- [x] `constants.ts` — `SESSION_COOKIE` (dependency-free so `proxy.ts` doesn't pull in Prisma)
- [x] `schemas.ts` — zod schemas for register/login (password ≥ 8, phone regex)

## Phase 3 — Endpoints (`app/api/auth/`)

- [x] `POST /api/auth/register` — validates, then `$transaction`(User + Organization + Owner Role + Membership), sets session with `orgId`; 409 on duplicate email/phone
- [x] `POST /api/auth/login` — resolve identifier (email or phone) → verify password → set cookie; dummy hash on unknown user to equalize timing
- [x] `POST /api/auth/logout` — clear cookie
- [x] `GET /api/auth/me` — current user + all org memberships with roles

## Phase 4 — Route protection

- [x] `proxy.ts` (root): unauthenticated → `/login`; authenticated hitting `/login`/`/register` → `/`; API routes excluded (self-enforcing)

## Phase 5 — UI (all shadcn: Card, Field, Input, Button)

- [x] `/register` page — name, org name, email, phone (optional), password; per-field zod errors
- [x] `/login` page — identifier + password
- [x] Sign-out button + org name header on `/` dashboard

## Phase 6 — Org handling

- [x] Org created at registration (see scope change above)
- [ ] Org switcher component for multi-org users (re-issues cookie) — deferred until org invites exist

## Phase 7 — Verify

- [x] E2E in browser: `/` redirects to login → register → dashboard shows Owner of org → sign out → login (phone + email, wrong password rejected) → authed `/login` bounces to `/`
- [x] Duplicate registration returns 409 and leaves no orphaned org (transaction rollback confirmed)
- [x] `npx tsc --noEmit` and `npm run lint` clean
- [x] DB rows verified via psql: User (with phone + hash), Organization, Owner Role, Membership

## Done

Auth sprint complete except deferred org switcher. Next sprint candidates: properties/units CRUD, org invitations, org switcher.

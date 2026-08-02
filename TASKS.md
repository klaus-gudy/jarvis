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

## Phase 8 — App shell / navigation

- [x] `npx shadcn add sidebar avatar` (pulls sheet, tooltip, skeleton, use-mobile)
- [x] `lib/nav.ts` — single source of truth for nav items + `findActiveNavItem()` (longest-prefix so nested routes stay highlighted)
- [x] `components/app-sidebar.tsx` — `collapsible="icon"`, tooltips when collapsed, closes mobile drawer on navigate
- [x] `components/nav-user.tsx` — footer dropdown with sign out (replaced standalone `sign-out-button.tsx`)
- [x] `components/app-header.tsx` — trigger + page title + theme toggle
- [x] `app/(app)/layout.tsx` — auth guard + `SidebarProvider`; reads `sidebar_state` cookie server-side so collapsed state doesn't flash
- [x] Routes: `/dashboard` (live org-scoped counts), `/properties`, `/tenants`, `/leases`, `/users`; `/` redirects to `/dashboard`
- [x] `TooltipProvider` added to root layout
- [x] Rewrote `hooks/use-mobile.ts` with `useSyncExternalStore` (vendored version tripped `react-hooks/set-state-in-effect`)
- [x] Verified: desktop expand/collapse + tooltips, cookie persistence, active highlighting, mobile drawer opens and auto-closes on navigate

## Done

Auth + app shell complete. Deferred: org switcher (build with invitations).
Next sprint candidates: Properties CRUD (the shell is ready — add pages under `app/(app)/properties/`), org invitations, org switcher.

Known benign warning: `next-themes` injects a pre-hydration `<script>`; React 19 logs "Encountered a script tag while rendering React component". Expected, theme switching works.

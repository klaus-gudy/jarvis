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

## Phase 9 — Properties

- [x] `npx shadcn add badge tabs progress dialog select table`
- [x] Migration `20260802182846_property_details`: `PropertyType` enum, `Property.type/category/ownerName`, `Unit.rentAmount`, FK indexes
- [x] `prisma/seed.ts` — 6 properties / 19 units / tenants+leases. Run: `npx tsx prisma/seed.ts "<Org Name>"` (defaults to newest org)
- [x] `lib/properties.ts` — org-scoped queries + derived occupancy, rent roll, vacancy; `lib/format.ts` — `TSh 1.4M` / `210k` compaction
- [x] `components/properties/property-card.tsx` + `property-icon.tsx`
- [x] `/properties` — card grid, server-side Residential/Commercial filter via `?type=`
- [x] `/properties/[id]` — Overview tab (stats, occupancy, vacancy loss) + Units tab (table with tenant, lease start, rent)
- [x] Verified: figures match the design mockup exactly; filter, tabs, mobile stacking, and cross-org 404 isolation all confirmed

## Phase 10 — Property detail redesign

- [x] Migration `property_overview_fields`: `PropertyStatus` enum, `Property.description`, `Property.amenities String[]`
- [x] Header card: icon, name, `address · category · Owner: x` — unit count removed (the tab badge carries it)
- [x] Underlined active tab via shadcn `<TabsList variant="line">` (`::after` bar, verified opacity 1 vs 0)
- [x] Overview: Property details rows (type, category, location, ownership, status pill) + Description + General facility amenities chips
- [x] Units: `components/ui/data-table.tsx` — reusable TanStack table with sorting, text filter, faceted status filter, row selection, pagination + page-size
- [x] `npx tsx prisma/seed.ts "<Org>" --refresh-only` added so seeding can backfill without recreating deleted properties
- [x] Verified: filter (3 rows for "A"), status facet (2 vacant), sort (rent ascending), select-all (5 of 5), pagination (Page 2 of 2 via a temporary 12-unit property, since deleted), mobile table scrolls in-container without body overflow

## Phase 11 — Properties CRUD + derived owner

- [x] Migration `property_derive_owner`: dropped `Property.ownerName`
- [x] `lib/organizations.ts` — `getOrganizationOwnerName()`, cached, falls back to org name when no Owner-role member exists
- [x] `lib/properties.ts` — owner attached to results (UI shape unchanged, so cards/detail needed no edits); `createProperty` / `updateProperty` / `deleteProperty`, all org-scoped
- [x] `lib/properties-schemas.ts` (zod, no owner input), `lib/property-options.ts`, `lib/api-auth.ts`
- [x] Endpoints: `GET|POST /api/properties`, `GET|PATCH|DELETE /api/properties/[id]`, `GET /api/properties/options`
- [x] `components/properties/property-form.tsx` shared by `/properties/new` and `/properties/[id]/edit`; `property-actions.tsx` for edit/delete with a confirm dialog
- [x] `prisma/seed.ts` deleted — properties are created in the app now
- [x] Verified: 401 unauthenticated; **cross-org GET/PATCH/DELETE all 404 and the other org's row survived the delete attempt**; create → edit (status + amenity) → delete round trip through the UI; owner fallback confirmed by temporarily renaming the Owner role

## Phase 12 — Property form UX

- [x] `npx shadcn add accordion`
- [x] Two-column grid (`sm:grid-cols-2`) — Name | Location, Property type | Category
- [x] Grouped with semantic `FieldSet` + `FieldLegend`: "Basics" and "Classification"
- [x] Optional fields (status, ownership, description, amenities) moved into a collapsed accordion, cutting the form from 8 stacked fields to 4 visible
- [x] Accordion triggers show live summaries ("Active · Chris patt", "Description added · 10 amenities") so hidden values stay discoverable
- [x] Accordion auto-expands when a hidden field has a validation error, so errors can't hide behind a closed panel
- [x] Form container widened `max-w-2xl` → `max-w-3xl`
- [x] Verified: collapses to one column on mobile with no horizontal overflow; **saving with the accordion collapsed preserves description/amenities/status** (the main risk of hiding fields)

## Phase 13 — Data table visual fix

- [x] `components/ui/data-table.tsx` wrapped in `Card` (`bg-card` + ring) — previously it was a bare `div` with only a low-contrast `border` token, which read as invisible/transparent against the page's similarly-toned `bg-background`
- [x] Search input, both `Select` filter triggers given `bg-background` so they read as filled fields against the white/dark card, not just borders
- [x] Verified in both light and dark mode; confirmed filtering, sorting, and row selection all still work post-restyle

## Phase 14 — Unit details + unit CRUD

- [x] Checkbox border `border-input` → `border-ring` (light-mode `--input` is ~white, so unchecked boxes were invisible)
- [x] Currency TSh → **TZS**, centralised as `CURRENCY` + `formatCurrency()` / `formatCurrencyFull()` in `lib/format.ts`
- [x] Migration `unit_details`: `minTenureMonths Int?`, `unitType String?`, `floor String?`, `block String?`, `sizeSqm Float?`, `amenities String[]`
- [x] `lib/unit-options.ts` (unit types, unit-specific amenities, tenure choices), `lib/units-schemas.ts`, `lib/units.ts`
- [x] Endpoints: `POST /api/properties/[id]/units`, `PATCH|DELETE /api/properties/[id]/units/[unitId]` — org-scoped through the parent property, 409 on duplicate label
- [x] `unit-form-dialog.tsx` — essentials visible (unit name, monthly rate, min tenure), everything else in an accordion with a live summary
- [x] **Add unit** button on the Units tab; per-row edit + delete with confirmation
- [x] Table shows the new data compactly via secondary lines: `C1 / Block C · Floor Ground`, `2 Bedroom / 62.5 m²`, `TZS 650,000 / min 6 mo`; added an "All types" facet filter
- [x] Verified end to end: created C1 with every field → confirmed in psql → edited → duplicate-name rejected with 409 message → deleted; 401 unauthenticated; 404 for unknown property/unit; checkbox contrast checked in both themes

## Phase 15 — Users & Tenants

- [x] Migration `invitations_and_optional_credentials`: `User.email` and `User.passwordHash` nullable, `Invitation` model + `InvitationStatus`
- [x] **Login rejects null `passwordHash`** with the same generic 401 (verified: assisted-onboarded tenant cannot sign in)
- [x] `lib/tenants.ts` (status derived: Active/Vacated/Prospect), `lib/members.ts`, `lib/roles.ts`, `lib/invitations.ts`, `lib/user-display.ts`
- [x] Endpoints: `GET|POST /api/tenants`, `DELETE /api/tenants/[id]`, `GET /api/members`, `DELETE /api/members/[id]`, `GET|POST /api/roles`, `GET|POST /api/invitations`, `DELETE /api/invitations/[id]`, public `POST /api/invitations/accept`
- [x] `/tenants` — Tenant-role members only, data table with name, contact info, date joined, unit, status
- [x] Add tenant dialog: name + phone (required) + email (optional), no password
- [x] `/users` — members table, invite dialog producing a copyable link, pending-invite list with revoke, custom role creation, member removal
- [x] Public `/invite/[token]` accept page; `proxy.ts` allows `/invite/*` signed out
- [x] Guards verified live: self-removal 400, **sole-Owner removal 409**, duplicate phone 409, invite replay 410, all endpoints 401 unauthenticated
- [x] Fixed dangerous default: invite role defaulted to Owner (roles sort alphabetically) — now prefers Tenant
- [x] Data correction: 11 legacy `"!seeded-no-login"` hashes set to NULL so `canSignIn` is truthful

## Phase 16 — Users/Tenants polish

- [x] Removed the "No sign-in yet" caption from both tables
- [x] `components/person-cell.tsx` — rounded avatar with initials, shared by the Users and Tenants name columns
- [x] **Phone is mandatory everywhere a member is created**: registration, tenant onboarding, and invitations all reject a missing phone (verified: 400 on each)
- [x] Users table shows an **Invite** button on any member who can't sign in, pre-filled with their name/phone/email and existing role
- [x] `acceptInvitation` now *activates* an existing passwordless member (sets their password) instead of returning "already a member" — this was required for the Invite button to work at all
- [x] Verified end to end via API: create passwordless tenant → invite → accept → **one** membership (no duplicate), password set, sign-in succeeds

## Phase 17 — Edit member

- [x] `PATCH /api/members/[membershipId]` — one endpoint serving both pages (a tenant is a member); org-scoped, 404 for unknown/foreign ids
- [x] `updateMember` in `lib/members.ts` — reports a phone/email clash as a field-level 409 instead of a raw unique-constraint error
- [x] `components/member-edit-dialog.tsx` — shared name/phone/email form; phone stays mandatory so an edit can't strip it
- [x] Pencil button added to both the Users and Tenants tables
- [x] Added `rawName` to both row types: the tables show a fallback (email/phone) when `name` is null, and prefilling the form with that would have silently saved the fallback as the real name
- [x] Verified: 401 unauthenticated, 400 missing phone, 409 duplicate phone, 404 unknown id, successful update, and clearing email stores NULL

## Phase 18 — Organization-less recovery

- [x] `POST /api/organizations` — creates Organization + Owner role + Membership in one transaction and **re-issues the session** with the new orgId
- [x] `createOrganizationForUser` in `lib/organizations.ts`, mirroring registration minus user creation
- [x] `components/create-organization-dialog.tsx` — non-dismissible prompt (no close button, no outside-click escape) with a Sign out escape hatch so nobody is trapped
- [x] Wired into `app/(app)/layout.tsx`, so it covers every page at once
- [x] Layout now reads **actual memberships** instead of trusting `activeOrgId`, which can point at a deleted organization
- [x] Verified: org-less login renders the prompt → create → Owner membership in DB → session updated → prompt gone, all APIs 200; 401 unauthenticated, 400 on blank name

### Not done

- [ ] If the session's org is deleted but the user still belongs to *other* orgs, the layout falls back to one of them for the sidebar, but page queries still use the stale `activeOrgId` and show empty states until re-login.
- [ ] Role is not editable — you excluded "change a member's role" when scoping the Users page. Say the word and it's a small addition.
- [ ] `User.phone` is still nullable in the DB — 11 legacy users have none, so NOT NULL would mean inventing numbers. Enforced in every form instead; backfill those rows to tighten the column.
- [ ] **No DB constraint stops a Lease joining a membership in one org to a unit in another.** Queries now filter it out, but the data can still be created. Worth a check constraint or an org column on Lease.
- [ ] Changing a member's role isn't implemented (not requested).
- [ ] Unit amenities are editable/visible in the unit dialog but **not** shown in the units table (chips don't fit) — row expansion would be the fix.
- [ ] Tenants/leases still have no UI; deleting the seed means new orgs have no tenant data.
- [ ] Global search and notifications in the mockup header are not implemented.

## Done

Auth + app shell complete. Deferred: org switcher (build with invitations).
Next sprint candidates: Properties CRUD (the shell is ready — add pages under `app/(app)/properties/`), org invitations, org switcher.

Known benign warning: `next-themes` injects a pre-hydration `<script>`; React 19 logs "Encountered a script tag while rendering React component". Expected, theme switching works.

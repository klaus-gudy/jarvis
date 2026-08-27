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
- [x] Org switcher component for multi-org users (re-issues cookie) — done in Phase 24

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

## Phase 19 — Dashboard summary cards

- [x] `lib/dashboard.ts` — `getDashboardStats()`, one org-scoped `Promise.all`; leases scoped through **both** the membership and the unit's property, matching `getLeases`
- [x] Rent collected = each lease's full value, limited to the months of its term falling in this calendar year (`leaseMonthsInYear`), so a 6-month lease at 100k books 600k the day it's signed rather than trickling in
- [x] Expected = `Σ Unit.rentAmount × 12` — the whole portfolio fully let, so the percentage has a fixed ceiling and the bar can't run past 100%
- [x] Card shows collected · `est. X/yr`, the percentage as pill + bar, and `TZS 1.4M/mo across 4 units` as the footer so the yearly figure has a visible basis
- [x] `components/dashboard/metric-card.tsx` — **one** `MetricCard` behind both looks via `variant="filled" | "default"`, so the row's proportions (size-9 icon tile, `text-2xl` figure, rule, `text-[11px]` sub-labels) are defined once. Optional `href` / `badge` / `progress` / `footer` / `stats` cover every slot
- [x] Whole card is one `Link` when `href` is set; the "View →" is decorative so no anchor nests inside another
- [x] Dropped the first pass's `stat-card.tsx` (separate `RentCard` + `StatCard`) — two components meant two sets of proportions to keep in sync
- [x] Cards link to `/leases`, `/properties`, `/tenants`, `/leases`
- [x] Greeting header: uppercase long date + time-of-day greeting + first name
- [x] **New tokens `--stat` / `--stat-foreground` / `--stat-accent`** — the lead card can't ride on `--primary` because that token is navy in light but *gold* in dark, which turned the card into a gold block. Sub-stat tones are plain vs gold for the same reason (`--secondary-foreground` and `--primary` swap roles between themes)
- [x] Tenants card leads with the total; Prospective (gold) and Active sit under it. Leases card says "Expiring soon" — the 60-day window is `EXPIRY_WINDOW_DAYS`, not label text
- [x] "View →" underlines on hover anywhere over the card (`group-hover/card:underline`), since the whole card is the link
- [x] Verified live: TZS 900,000 / est. 16.8M / 5% matches the DB by hand (2 leases: 2 mo × 300k + 3 mo × 100k; 4 units × 1.4M/mo × 12), hover underlines only the hovered card, Properties card click lands on `/properties`, no console errors, no horizontal overflow at 375px, filled card reads as a deep slab in both themes

## Phase 20 — Dashboard key indicators

Picked from a menu of candidates; the ones turned down are listed at the end.

- [x] **Vacancy loss** as a 5th `MetricCard`: asking rent of every empty unit, monthly + annualised + as a share of asking rent. Falls out of the units query — `unit.count` for occupancy was replaced by a `findMany` selecting `rentAmount` plus a single active lease, so income, occupancy and vacancy loss now come from one row each instead of two queries
- [x] `components/dashboard/panel.tsx` — `DashboardPanel` (title, icon, count, "view all" link, empty state) + `PanelRow` (leading slot, title/subtitle, trailing figure with `default | accent | muted` tone). The list counterpart to `MetricCard`, for the same reason: six panels, one set of proportions
- [x] `getDashboardPanels()` in `lib/dashboard.ts` — six lists in one `Promise.all`, separate from `getDashboardStats` so the page awaits both at once
- [x] Panels: Renewals due (≤90d, gold under 30), Occupancy by property (worst first, reusing `getProperties`), Longest vacant (never-let sorts first — no end date means no number to compare), Upcoming move-ins (≤30d), Awaiting invite (`passwordHash: null`), Recent activity (leases + tenants merged in JS after two `take: 5` queries, cheaper than a union)
- [x] `formatRelativeTime()` + `formatDayMonth()` in `lib/format.ts`
- [x] Metric figure size now keys off the **value's type** — money arrives as a formatted string and steps down to `text-xl`, counts are numbers at `text-2xl`. Was keyed off `variant`, which made the vacancy card's money larger than the rent card's
- [x] Sub-stats moved from `flex gap-5` to `grid grid-cols-2` — at five cards across, flex sizing had truncated "Occupied units" to an ellipsis
- [x] Verified live: all 5 cards + 6 panels render with real data, the move-ins empty state shows, no horizontal overflow at 375px, both themes checked

## Phase 21 — Panel caps, ordering, occupancy density

- [x] `PANEL_ROWS` 5 → **6**, and every panel's data is now `PanelList<T> = { items, total }` — the badge reads `total` (a real `prisma.count`), the list renders `items`. Kept as one shape so a caller can't badge `items.length` and silently under-report
- [x] Each list's `where` clause is hoisted into a named filter shared by the `findMany` and its `count`, so badge and rows can never describe different sets
- [x] Ordering (all at the DB, so the cap can't reshuffle it): renewals `endDate asc` (soonest expiry on top), move-ins `startDate asc` (soonest first), awaiting invite `createdAt desc` (most recent first). Vacant units still rank in JS — `daysVacant` is derived, not a column — with `total` taken before the slice
- [x] Occupancy rows put the caption beside the name (`Java · 2/3 units · TZS 700k/mo` … `67%`), dropping each property from three lines to two
- [x] **A property with no units no longer reports 0%**: it computed as 0% and, under worst-first sorting, took the top slot ahead of genuinely empty buildings. Now reads "No units yet", renders no bar, and sorts last
- [x] Verified by temporarily setting `PANEL_ROWS = 1`: the Renewals badge still read **2** while rendering **1** row, and the row kept was the 29-day one — proving both the cap and the soonest-first order. Restored to 6

### Turned down (offered, not wanted)

- 12-month rent trend chart — the only candidate needing a new dependency (`npx shadcn add chart` → recharts)
- Average remaining lease term, average rent per unit
- Rent roll by property, residential/commercial split
- Unit type & size mix — **blocked anyway**: only 1 of 4 units has `unitType` or `sizeSqm`, so it would read mostly "Unknown"
- "Signed this month" counters (the activity feed was preferred)

## Phase 22 — Tenant status bug fix: "Upcoming" was missing

- [x] `TenantStatus` gained a fourth value, **Upcoming** — a tenant with a signed lease that hasn't started yet, and nothing active. Previously fell through to Vacated, which reads as "used to live here" for someone who hasn't moved in yet
- [x] `deriveTenantStatus()` in `lib/tenants.ts` is the single source both `getTenants` and `getTenantDetail` call — they'd each hand-rolled the same three-way branch and were one edit away from silently diverging again
- [x] Precedence: a lease covering *now* wins outright; short of that, any lease still to come outranks any that's already ended, since nothing has been vacated
- [x] Tenants table: badge variant, unit column now dims + annotates both non-current states — `(past)` for Vacated, `(upcoming)` for Prospect's opposite number — and the status facet filter gained the option
- [x] Member detail page: status pill gained a `sky` tone for Upcoming, distinct from Prospect's `amber` — the two mean different things (no lease ever vs. a signed one not yet started) and shouldn't share a color
- [x] Left `lib/dashboard.ts`'s tenant card alone — it only shows total/active/prospect by prior request, and "active" correctly excluding an upcoming tenant is the right behavior there, not the bug
- [x] Verified against Jackson Mayunga (real case that surfaced this): lease starts 2 Sept, today 5 Aug → now reads **Upcoming** everywhere (tenants table, unit shows "C2 (upcoming)", member detail pill), confirmed in both themes

## Phase 23 — Roles & permissions page, Users tabs

- [x] New nav item **Roles & permissions** → `/roles` (`ShieldCheckIcon`), `app/(app)/roles/page.tsx` + `components/roles/roles-view.tsx`
- [x] `RoleRow` type from `getRoles()`: name, member count, **pending invite count** (filtered `_count` on `status: PENDING` — accepted/revoked invites say nothing about current use), and `isSystem`
- [x] **Owner and Tenant are marked "Built-in"** — both are load-bearing (the sole-Owner guard in `lib/members.ts`, every tenant query matching on name), so the table shows them as not-ordinary rather than presenting them as freely editable
- [x] Roles table: search, Built-in/Custom facet filter, and an inert **Permissions** column reading "Not configured" — says where permissions will live without implying any are in force. Page copy states plainly that permissions aren't enforced yet
- [x] `NewRoleDialog` extracted from `users-view.tsx` into `components/roles/role-form-dialog.tsx`; the "New role" button moved off the Users page onto `/roles`
- [x] `POST /api/roles` now revalidates **both** `/roles` and `/users` — the invite dialog and the members role-filter both read roles
- [x] Users page split into **All users / Pending invites** tabs (`TabsList variant="line"`, matching the property detail page), each with a count badge
- [x] Pending invites is now a `DataTable` matching the members table column-for-column (avatar+name, phone, email, role badge, expires, action) — it was a bespoke card list of bordered `div`s
- [x] Invite row search uses an `accessorFn` on the displayed label, not the raw `Invitation.name`: that column is nullable, so an invite identified only by email or phone would have been unsearchable
- [x] Revoke moved behind a confirmation dialog, consistent with member removal — it was a bare one-click button
- [x] Verified live: created "Caretaker" → appeared as Custom / 0 members without a reload; duplicate "caretaker" rejected 409 case-insensitively with the error inline and the dialog held open; both tabs render with counts; dark mode + 375px checked (table scrolls in-container, no page overflow). **Test role deleted afterwards** — there is no delete-role UI, so it could not be removed through the app

## Phase 24 — Multi-organization support (org switcher)

- [x] **Security fix that motivated the design**: `getCurrentUser()` used to return the JWT's `orgId` untouched — a member removed from an org kept full access to its data for the token's remaining lifetime (up to 7 days). It now validates the claim against live memberships on every request (same DB roundtrip, via `include`) and falls back to the oldest membership — the default login uses
- [x] JWT gained a `persist` claim so re-issuing the cookie (switch) keeps the original "Remember me" choice instead of upgrading a session-only cookie to 7 days; old tokens read as persistent
- [x] `POST /api/organizations/switch` — verifies membership at mint time, re-issues the cookie, `revalidatePath("/", "layout")`; 404 for non-membership (same shape whether the org never existed or was just revoked, so it can't probe)
- [x] `components/org-switcher.tsx` — the sidebar identity block: plain link home with one org, dropdown with several (org name + your role, check on active). Switching lands on `/dashboard` because a detail page from the old org 404s in the new one; `pending` held until navigation so a second click can't race
- [x] `app/(app)/layout.tsx` — dropped its display-only `?? memberships[0]` fallback; everything now agrees with the validated `user.activeOrgId`
- [x] Queries needed **no** changes — every page and API was already org-scoped through `activeOrgId`; this phase fixed which org that is
- [x] Verified live: switcher lists both orgs with roles; switching flips every dashboard figure and the properties list to Sunrise Estates data; **membership revoked mid-session → very next request silently falls back to the remaining org, no data from the revoked one**; switch API to a revoked org → 404; mobile dropdown opens below and works; desktop + mobile checked
- [x] Test data left in place: Chris patt belongs to "Melinda Gates" and "Sunrise Estates" (1 property, 1 vacant unit) so the switcher stays demonstrable

## Phase 25 — Switcher one-way bug + one org per owner

- [x] **Bug: you could switch once, then never again.** `handleSwitch` set `pending` and deliberately never cleared it on success, reasoning the tree would unmount. It doesn't — the sidebar lives in the persistent `app/(app)/layout.tsx` and survives `router.push` + `refresh`, so `pending` stayed `true` forever and left every menu item `disabled`. The org *did* change; the switcher was simply dead afterwards
- [x] Fix: split into `switching` (covers the fetch, cleared explicitly) + `useTransition`'s `isPending` (covers the navigation, **cleared by React** when the refresh lands). The rule this encodes: a flag we set must also be one we clear — never rely on unmount inside a persistent layout
- [x] Verified: 4 consecutive hops Melinda → Sunrise → Melinda → Sunrise, no reload between, each flipping the sidebar name and the dashboard figures; menu items re-enabled on reopen (`anyDisabled: false`)
- [x] **One organization per owner**: `createOrganizationForUser` now refuses a user already holding an Owner membership anywhere, returning `{ error: "already-owner", organizationName }`; `POST /api/organizations` maps it to **409** with "You already own X — one organization per owner."
- [x] The check runs **inside** the `$transaction`, so two concurrent creates can't both pass it
- [x] `create-organization-dialog.tsx` needed no change — it already renders `data.error`
- [x] Registration needs no separate guard, and this was **tested rather than assumed**: re-registering with an existing owner's email returns 409 on the unique constraint and the transaction rolls back, leaving no orphaned organization. Confirmed in the DB — still exactly 2 orgs
- [x] Non-owners are unaffected: a Tenant-only member can still create an organization (verified against Jackson Mayunga's membership)

## Phase 26 — Global search in the header

- [x] `lib/search.ts` — `searchOrganization()`, four parallel queries (property, unit, tenant, lease), `take: 5` **per type** so one crowded type can't crowd out the others; every branch org-scoped, leases through both the membership *and* the unit's property
- [x] Searchable fields: property name/address/category · unit label/type · tenant name/email/phone · lease by tenant, unit, property — **and by the reference a user can actually see**: `L-FB46Y` strips the prefix and matches the cuid suffix, only when the query could plausibly be one, so a short word doesn't scan every lease id
- [x] `GET /api/search?q=` behind `requireActiveOrg`; `MIN_QUERY_LENGTH = 2`
- [x] `components/global-search.tsx` — header trigger (⌘K hint, hidden on touch) → dialog with grouped results, a **type tag on every row** (Property / Unit / Tenant / Lease), arrow-key navigation, Enter to open, ⌘K/Ctrl+K from anywhere
- [x] **Did not use shadcn's `command`**: its registry file imports `@/app/(create)/components/icon-placeholder`, a path that only exists inside shadcn's own repo, and it pulls `cmdk` whose client-side filtering fights server-side search. Built from `Dialog` + `Input` instead — no new dependency
- [x] **`lib/search-types.ts` exists to keep Prisma out of the browser.** The client component needs `MIN_QUERY_LENGTH` and `SEARCH_TYPE_LABEL` at runtime; importing them from `lib/search.ts` dragged Prisma → `pg` → `require('dns')` into the client bundle and the build failed with "Module not found: Can't resolve 'dns'". Same split, same reason, as `lib/auth/constants.ts`
- [x] Loading and result-freshness are **derived** from `answered.query === query`, not stored — satisfies `react-hooks/set-state-in-effect` and makes it impossible to render one query's results under another's text. `AbortController` cancels superseded requests
- [x] Verified live: `jav` → Property + 3 Leases · `C2` → Unit + Lease · `julius` → Tenant + 3 Leases · `0623470540` → Tenant by phone · `L-265FD` → that exact lease · `zzzznope` → empty state
- [x] **Org isolation confirmed**: signed into Melinda Gates, searching the other org's property name, unit label, and address each returned **0** results (control query returned 4)
- [x] ⌘K opens and autofocuses; ArrowDown moves the highlight; Enter opened `/leases/…` matching the shown reference and closed the dialog; dark mode + 375px checked, no overflow

## Phase 27 — Railway deploy readiness

- [x] `package.json`: added `"postinstall": "prisma generate"` — `lib/generated/prisma` is gitignored, so a clean `npm install` on Railway had nothing to build `lib/prisma.ts`'s import against
- [x] `package.json`: `"start"` changed to `"prisma migrate deploy && next start"` — nothing previously applied the 12 committed migrations to a fresh deploy target. `next start` already reads `process.env.PORT`, so Railway's injected port needs no extra flag
- [x] **Verified against a genuinely fresh database**, not the already-migrated dev one: spun up a throwaway `postgres:16` container, ran `prisma migrate deploy` against it — all 12 migrations applied cleanly, `\dt` confirmed every table materialized. This is what actually proves Railway's blank Postgres plugin will work, since testing against the dev DB (already migrated) would have told me nothing
- [x] **Verified the production server end-to-end**, on a separate port from dev: `npm run build` (same command Railway runs) succeeded across every route; `npm run start` under `PORT=3348` showed `migrate deploy` running before `next start` bound to that port; unauthenticated `/dashboard` → 307 to `/login` per `proxy.ts`; registered a real account through `POST /api/auth/register` → 201, session cookie carried `Secure; HttpOnly; SameSite=lax` (proving `NODE_ENV=production` correctly gates the flag in `lib/auth/session.ts`); logged in and loaded `/dashboard` → rendered as Owner of the new org. Test org/user deleted afterward
- [x] Confirmed local dev is unaffected — `dev` still runs `next dev -p 3347` directly, untouched by the `start`/`postinstall` changes
- [x] Deploy plan (Postgres plugin, GitHub auto-deploy, env vars, custom domain) written to `/Users/gmadadi/.claude/plans/snappy-zooming-rivest.md`; the Railway dashboard side is manual and outside this repo

## Phase 28 — Toasts, and bulk unit import from Excel

- [x] `sonner` added via `npx shadcn add sonner`; `<Toaster />` mounted once in `app/layout.tsx`. Every create/update/delete across properties, units, tenants, leases, members, invites, roles and organizations now toasts. Login deliberately has **no** success toast (the redirect is the feedback); auth *errors* do toast, and their duplicate inline copies were removed
- [x] Toast styling: `--stat-accent` gold background with `shadow-lg`, matching the active sidebar item
- [x] `Badge` variant `secondary` uses `bg-primary` in light mode (`dark:` override keeps the old look) — in light mode `--secondary` was a pale grey that read as disabled next to a button
- [x] **Bulk unit import**: "Import units" beside "Add unit" on a property's Units tab opens one dialog carrying the whole flow — download template → upload filled file → review parsed rows → import row by row with live per-row status → summary toast
- [x] `GET /api/properties/[id]/units/template` streams a generated `.xlsx`: styled header row, a note on each header giving the rule and an example, a **dropdown data validation** on Unit type (a picked value can't fail validation later), and a Reference sheet listing every valid unit type and amenity plus a worked example. Filename carries the property name
- [x] `POST /api/properties/[id]/units/import` parses and validates but **writes nothing** — it returns rows for review. Guards: 2 MB cap (checked on `content-length` before buffering, then on `file.size`), `.xlsx` type + extension, 500-row cap, property-in-org check
- [x] Parser tolerates what people actually type: `"1,250,000"` → `1250000`, `"studio"` → `Studio`, `"furnished,SEA VIEW"` → `["Furnished","Sea view"]`, reordered columns (headers matched loosely), blank padding rows skipped, rich-text/formula cells flattened. Catches duplicate labels **within the file** and points at the first row that used the name
- [x] Errors are deduped — the coercion pass records which columns it reported on so Zod doesn't restate them ("abc" in a money column said both "must be a number" and "is required")
- [x] **Bug found and fixed while testing**: `optionalText` in `lib/units-schemas.ts` was `.optional()` but transformed blanks to `null`, so the schema couldn't re-parse its own output — every imported row with a blank Floor/Block failed with "expected string, received null". Now `.nullish()`
- [x] **Swept the same bug across the codebase.** Re-derived the candidates by asking *which schemas emit null* rather than grepping `.optional()` — which corrected the shortlist in both directions. Fixed: `properties-schemas.ts` (`description`), `member-profile-schemas.ts` (`optionalText`), and `lib/phone.ts` (`optionalTzPhoneSchema`) — the last missed by the first pass. **Left alone: `members-schemas.ts` and `tenants-schemas.ts`** — their `email` transforms to `undefined`, not null, so they were already idempotent; `.nullish()` there would newly admit `null` and persist it
- [x] Proved it with a round-trip harness that re-feeds each schema its own output, plus a **control** carrying the pre-fix shape — the control fails with the exact production error and the fixed shape passes, so the harness can actually detect the bug. All six schemas report idempotent
- [x] Verified the four forms still post correctly: property edit saved with a blank description; the tenant profile dialog saved with all six fields blank, then with `+255712345678` (still normalized to `0712345678`, proving the transform survived `.nullish()`), then cleared back to blank. Test data restored to its original state
- [x] Verified end-to-end: generated template → filled in Excel → parsed back (round-trip harness), then the real UI on property "Milan" — 3 valid + 5 invalid rows reviewed, imported, per-row spinners → ticks/crosses, mixed toast, table refreshed, every optional field and both amenities confirmed on the created unit. Re-run proved the duplicate path (existing label → "A unit with this name already exists"). Test units deleted afterward
- [x] Template trimmed to 6 columns — **Size and Amenities dropped** (still on the unit form, just not worth a spreadsheet column yet). An imported unit gets `sizeSqm: null, amenities: []`; adding either back is one row in `COLUMNS` plus its handling in the parse loop
- [x] "Import units" is `variant="outline"` **plus `bg-card`**: that variant's fill is `bg-background`, the exact same colour as the page, and this button sits on the page rather than on a card — so only its border showed in light mode. Dark mode was already fine via `dark:bg-input/30`, and tailwind-merge keeps that variant while replacing the base class
- [x] The row list already capped at `max-h-[45vh]` with `overflow-y-auto` (verified at 40 rows: 1719px of content in a 445px box, dialog still 640px inside a 994px viewport). Added what was actually missing — **the list now scrolls the active row into view during import** (`block: "nearest"`, so it only moves once the row has left view). Without it a long file ticks through invisibly below the fold, which is most of the point of the list
- [x] Re-verified with a 40-row file: 35 created, 5 invalid skipped, list followed progress to the last row, "35 units imported" toast. Test units deleted, leaving only the pre-existing ones

## Phase 29 — Form legibility, custom amenities, tenant import

- [x] **Placeholders are italic and 60% muted** on `Input`, `Textarea` and `Select` (`data-placeholder`), so placeholder text can't be misread as entered content. `Combobox` and every `InputGroup` control inherit it — both route through `Input`
- [x] **`FieldLabel` takes `required`**, rendering a destructive-coloured `*` (`aria-hidden` — the control's own `required` is what assistive tech announces; `-ml-1.5` pulls it past the label's `gap-2`). Applied to all 24 required controls across 13 files, mapped by matching each `required` input's `id` to its label's `htmlFor` rather than by hand
- [x] Dropped the now-redundant `(optional)` suffixes from labels — with a universal required marker, absence of `*` is the signal
- [x] **Unit Type promoted** out of "Other unit details" to sit with name and rate
- [x] **Unit amenities are no longer a closed list.** `amenities` was `z.array(z.enum(UNIT_AMENITY_OPTIONS))`; Prisma has always stored `String[]`, so the schema now takes trimmed free text, de-duplicated case-insensitively and capped (40 items, 40 chars each). The form keeps the standard checkboxes and adds an "Add another amenity" field; custom values render as removable chips. Typing an existing option's name ticks its box instead of creating a near-duplicate, and Enter commits the chip rather than submitting the form
- [x] **Tenant bulk import**, mirroring units: columns First name, Last name, Phone, Email — the two name parts are joined into the single stored `name`, and the split is never persisted
- [x] Rather than a second copy, extracted **`lib/xlsx-import.ts`**: template generation, cell flattening, loose header matching, blank-row skipping, in-file duplicate detection, row caps and error de-duplication now have one implementation. `unit-import.ts` was rewritten onto it (verified byte-for-byte equivalent behaviour on the same 9-row fixture) and `components/import-dialog.tsx` is now generic over the payload type
- [x] Phone column is written as Excel **text format** (`@`) — a number typed as `0712345678` into a General cell is stored as `712345678` and silently loses its leading zero. The parser also restores it: a bare 9-digit value gets the `0` back, since every TZ mobile number is that zero plus nine digits
- [x] `required: true` on a column only ever meant "this header must exist". First name needed it to mean "this cell must have a value" too — a surname alone would otherwise satisfy the joined name. Enforced in the tenant mapper, which also names `name` so the schema doesn't restate the fault
- [x] Verified end-to-end in the browser: 9-row tenant file → 4 created, 5 correctly rejected (missing first name ×2, bad phone, duplicate phone, bad email), "4 tenants imported" toast, names joined correctly including a surname-less "Asha" and a leading-zero-recovered "Bakari Salum". Units dialog re-checked through the shared component. All test data removed

## Phase 30 — Global search: users, and colour-coded kind badges

- [x] **Global search now returns non-tenant members** as a fifth type, `user`. The branch is the exact complement of the tenant one (`NOT: { role: { name: Tenant } }`), so every member surfaces exactly once under the heading that describes what they are — no double-listing. Subtitle leads with the role (`Owner · 0712…`), since that's the point of looking someone up
- [x] `TYPE_ORDER` in `global-search.tsx` is both the section order **and the filter** — a type missing from it never renders however many rows the API returns. Adding `user` there was required, not cosmetic
- [x] **One colour per record kind**, as `--kind-{property,unit,tenant,lease,user}` tokens registered in the `@theme` block. Anchored to the existing palette rather than a new one: property is the brand gold, unit/lease the chart blues and greens, tenant the chart terracotta; only user (violet) is new, and it is desaturated to match. Hues sit at 36/81/155/254/300 — minimum 45° apart
- [x] Each token is the **ink**; the badge tints its own background from it at 10% alpha, which composites correctly over either theme's surface. So one token per kind covers both modes and only the lightness is retuned in `.dark` — no second set of `dark:` classes to keep in sync
- [x] **Measured the contrast rather than eyeballing it.** First pass came out 3.91–4.90 in light: passing AA-large but failing AA normal text, which is the right bar for a 12px badge. Darkened the light-mode tokens to land at **4.88–5.32 light / 6.39–6.75 dark**, all five passing AA text in both themes. (The first measurement attempt was itself wrong — `getComputedStyle` returns `lab()`/`oklab()` here, so the numbers had to be resolved through a canvas to get true sRGB.)

## Phase 31 — Units table: bare label column, View dialog

- [x] **Unit column shows only the label** — dropped the block/floor secondary line that used to run under it
- [x] **New "View" row action** (`EyeIcon`, matching the convention already used on the leases table) opens a read-only `UnitViewDialog` built on `DetailRow`/`Card`, the same pattern the property/lease/member detail pages use. Shows every field the table doesn't: size, minimum tenure, block, floor, amenities as badges — plus name/rate/type/status/tenant for context, in the same order the add/edit form presents them
- [x] Verified against a unit with every optional field set (size, tenure, block, floor, a custom amenity) — all render correctly in the dialog. Test data reverted afterward

## Phase 32 — Virtual billing: invoices, payments, lease auto-renewal

- [x] Migration `billing_and_auto_renew`: `Unit.autoRenew Boolean @default(false)`, `Invoice` (1:1 with `Lease`, `amount`/`dueDate`), `Payment` (belongs to `Invoice`), `Lease.renewedFromId`/`renewedFrom`/`renewedTo` self-relation
- [x] `lib/leases.ts`: overlap check + create extracted into `insertLease()`, now also creates the `Invoice` (amount = `leaseAmount`, due = `startDate`) in the same `$transaction`; `createLease` and the renewal job both call it, so overlap-safety has one source. `getLease`/`getLeases` include an `InvoiceSummary` (amount/paid/status)
- [x] `lib/invoices.ts`: `deriveInvoiceStatus` (Unpaid/Partial/Paid, derived not stored — same rule as `LeaseStatus`/`TenantStatus`), `getInvoiceForLease`, `recordPayment` (rejects `amount <= 0` and overpayment past the balance), `deletePayment` — all org-scoped through the lease's membership + unit.property, matching every other lease query
- [x] `lib/lease-renewal.ts`: `runAutoRenewals(organizationId)` — ended leases on `autoRenew` units with no successor get a new lease at `unit.minTenureMonths`/`unit.rentAmount`, starting the day after the old `endDate`; skips (doesn't crash) a unit with `autoRenew` on but no `minTenureMonths`. Called lazily from `app/(app)/leases/page.tsx` and `app/(app)/dashboard/page.tsx` — no cron endpoint yet, see plan.md decision log
- [x] `POST /api/invoices/[id]/payments`, `DELETE /api/invoices/[id]/payments/[paymentId]`
- [x] Unit form/view: `autoRenew` checkbox next to Minimum tenure (`unit-form-dialog.tsx`), shown in `unit-view-dialog.tsx`, threaded through `lib/properties.ts` → `UnitRow`
- [x] Lease detail page gained a **Billing** tab: invoice summary card (amount/due/paid/balance + status badge), payments table, Record payment dialog. Leases table gained an **Invoice** status column
- [x] `lib/dashboard.ts`: "Rent collected" now sums real `Payment` rows in the year instead of deriving from lease value — closes the 2026-08-05 decision-log item that flagged this exact swap
- [x] Verified live: creating a lease produces an invoice for the full amount; two payments (100k then 200k) flip status Unpaid → Partial → Paid; a 250k payment against a 200k balance is rejected inline with the exact remaining balance; auto-renewal creates a correctly-linked successor lease + invoice on page load and does not duplicate on reload; a unit with `autoRenew` on but no `minTenureMonths` is skipped without error; dashboard "Rent collected" reflects the real payment. All test data reverted afterward

## Phase 33 — Payments page, auto-renew switch

- [x] **New `/payments` page** (nav item, `WalletIcon`) listing every payment in the org — date, tenant, invoice reference + its total, the invoice's *current* status, unit/property, method, amount. Two summary cards: total received and still outstanding. Row actions view the parent lease or remove the payment
- [x] `lib/payments.ts` — `getPayments` and `getPayableInvoices`, both scoped through `invoice.lease` with the same double org filter (membership *and* unit.property) every other lease query uses. `getPayableInvoices` filters in JS, not SQL, because balance is derived from the payment rows rather than stored
- [x] **`lib/invoice-types.ts`** — `InvoiceStatus`, `deriveInvoiceStatus`, `invoiceReference`, `INVOICE_STATUS_VARIANT` moved out of `lib/invoices.ts` so client components can import them as *runtime* values without dragging Prisma → `pg` → `require('dns')` into the browser bundle. Same split, same reason, as `lib/search-types.ts`; `lib/invoices.ts` re-exports for server callers
- [x] `invoiceReference()` derives `INV-XXXXX` from the cuid tail, matching `leaseReference()`'s approach — prefixed differently so the two codes can't be confused
- [x] **Make payment dialog**: searchable picker over invoices that still owe something (`INV-9VNQV · Jason Momoa · Milan/A2 · TZS 600,000 due`), a live invoice breakdown card (total / paid / balance) once one is picked, amount, date, method and notes. Overpayment is caught client-side *and* still re-checked server-side, since the list can go stale
- [x] **`lib/payment-options.ts`** — a closed method list (Cash, M-Pesa, Tigo Pesa, Airtel Money, Halopesa, Bank transfer, Cheque, Other). **The Billing tab's dialog was switched from free text to this same picker**: free text there would produce method values the payments page's facet filter could never match
- [x] Payment POST/DELETE now revalidate `/payments` and `/dashboard` too — "Rent collected" is a sum of payment rows, so it moves with every one
- [x] **Auto-renew is a `Switch`, not a checkbox** (`npx shadcn add switch`), with the explanatory caption dropped. It is **disabled unless a minimum tenure is set**, and clearing the tenure forces it back off — the renewal job takes its term from `minTenureMonths`, so a unit saved auto-renewing without one would silently never renew
- [x] "In months." moved from below the Minimum tenure input to sit beside its label
- [x] Verified live: created a lease → paid 250k from the payments page (M-Pesa, with a note) → Billing tab agreed exactly → paid the remaining 350k there (Bank transfer) → status Paid, invoice dropped out of the picker → removed a payment → status back to Partial and both surfaces plus the dashboard recalculated. Overpayment blocked in both dialogs. Switch confirmed disabled with no tenure, enabled at 6 mo, and forced off when tenure was cleared. Light + dark, 375px with no overflow, no console or server errors. All test data removed

## Phase 34 — Billing surfaces: one home for the metrics, tables everywhere

- [x] **Dashboard gains a Payments card** — leads with the **outstanding balance** (the figure that needs acting on, not what already came in), with `x% of TZS y settled` as its label, a progress bar, payment count as the footer, and unsettled/total invoice counts as sub-stats. `getDashboardStats` gained a `billing` block computed from **one** `invoice.findMany` carrying each invoice's payments — a balance is derived, not a column, so it can't be summed in SQL and four aggregate queries would have been wrong anyway
- [x] Card row went `xl:grid-cols-5` → `lg:grid-cols-3`: six cards are two clean rows of three, where six across wrapped "TZS 4,200,000" onto a second line
- [x] **Payments page dropped its two summary cards** — totals belong on the dashboard, this page is the ledger
- [x] Payments table settled on **tenant → invoiced → method → status → paid → date**, every cell a single line (the invoice-reference and date sub-captions are gone) and the row actions down to delete alone
- [x] **Balance column dropped** — it showed the parent invoice's balance *now*, repeated identically on every payment of that invoice, so it read as a per-payment figure while being nothing of the sort. Not a real snapshot; removed rather than explained
- [x] **View (eye) button dropped** — `getRowHref` already makes the row double-click to its lease, and that behaviour is independent of the button, so the column was a second affordance for the same thing. Double-click confirmed still working after removal
- [x] `PaymentRow` lost `invoiceBalance`, `leaseReference`, `unitLabel` and `propertyName` once nothing rendered them, and `getPayments` dropped its now-pointless `unit`/`property` include — org scoping was never done through that include, it's a `where` filter
- [x] ~~Billing tab's invoice card is one compact strip~~ — superseded below: the invoice detail moved to Overview entirely
- [x] **Billing tab payments are a `DataTable`** matching the payments page — invoice, amount, method, date, notes + remove action, with search and a method facet. **Record payment moved outside the card**, above the table, matching the payments and leases pages
- [x] `InvoiceDetail` gained `reference` so the Billing tab's Invoice column has something to show
- [x] **Mobile bug caught and fixed in review** (on the strip, before it moved): the figures used `w-full` to wrap onto their own line, but inside a flex row `flex-basis` beats `width`, so `flex-1` kept them sharing the line and "TZS 750,000" truncated to "TZS 7…". `basis-full` is what actually wraps it
- [x] Hit the **Turbopack stale-module** trap again (already in the decision log for Prisma regeneration): `tsc` passed while the dev server threw `invoiceReference is not defined` from a cached `lib/invoices.ts`. Fixed by `rm -rf .next/dev` + restart — worth remembering it applies to ordinary edits, not just `prisma generate`
- [x] Verified live against a 4-invoice / 5-payment fixture spanning Paid, Partial and Unpaid: dashboard arithmetic checked by hand (2.23M invoiced, 1.63M paid, 73%, 600k outstanding across 2 unsettled invoices), payments table order and balances correct, Billing tab recording a payment flipped it to Paid and disabled the button. Light + dark, 375px with no page overflow, no console or server errors. Test data removed

## Phase 35 — Invoice detail moves to the Overview tab

- [x] **The invoice's figures now live on Overview**, as a fourth card under Lease terms: Reference · Status · Total amount · Due date · Paid so far · Balance remaining. Built from `Card` + a two-column `<dl>` of `DetailRow`s — the exact shape of the Lease terms card above it, so it reads as a sibling rather than a transplant. The compact strip that briefly held these figures is gone
- [x] **The Billing tab is now purely the ledger**: Record payment, then the payments table. Nothing else. The invoice is part of what a lease *is*, so it belongs with the terms; what has been paid against it is a log, which is what a tab earns
- [x] `Figure`, and the `Badge`/`INVOICE_STATUS_VARIANT` imports it needed, deleted from `billing-tab.tsx` once the strip went
- [x] Verified live: Overview card matches Lease terms row-for-row (Partial, 600k total / 400k paid / 200k balance, checked against the DB), Billing tab shows only button + table, the Record payment dialog still receives the right balance, and the **no-invoice empty state renders inside the new card** — checked on a throwaway lease whose invoice was deleted, then removed. Light + dark, 375px stacks to one column with no page overflow. Incidentally re-confirmed cross-org isolation: another org's lease id 404s

## Phase 36 — Create a lease from the tenant's own page

- [x] The member page's **Lease tab is now a `DataTable`** (`components/members/member-leases-tab.tsx` + `member-lease-columns.tsx`), replacing the hand-rolled `<ul>` of links: Lease · Property · Unit · Start · End · Duration · Status · Amount, with search, a status facet, sorting, pagination and double-click-to-open. Columns are the org-wide leases table's minus Tenant — every row here already belongs to this member
- [x] **Create lease button on the tab**, opening the same `LeaseFormDialog` the leases page uses. `lockedTenantId` is a new optional prop: the tenant is pre-filled and the field disabled, since a lease created from someone's page that belonged to someone else would be a trap
- [x] **The button only renders for tenants.** `createLease` requires the membership to hold the Tenant role and 404s otherwise, so showing it to an Owner would be an affordance that can only fail; `getLeaseOptions` is likewise only fetched when the member is a tenant. The role-aware empty message ("Owner members do not normally hold leases.") is preserved as the table's `emptyMessage`
- [x] Verified live: created a 4-month lease on Z3 from Amani Mwakalinga's page with the tenant locked → toast, table refreshed to 2 rows, tab badge 1 → 2, and **the invoice was created with it** (TZS 1,000,000, confirmed in psql). Owner's page shows no button and the right empty message. 375px scrolls the table in-container with no page overflow. Test lease removed
- [x] Hit the **Turbopack stale-module** trap a third time (`getLeaseOptions is not defined` from the moment between adding the call and adding the import, while `tsc` was clean). Every request since is 200 — but this is now a reliable pattern worth expecting after any edit that adds an import to a server component

## Phase 37 — Lease editing, and billing queries that don't read everything

- [x] **`updateLease`** (`lib/leases.ts`) + `updateLeaseSchema` + `PATCH /api/leases/[id]`. Re-validates exactly as creation does — unit in property+org, membership is a Tenant in org, duration clears the unit's minimum tenure — then recomputes `endDate` and `leaseAmount` and brings the invoice back in step in one `$transaction`
- [x] **The overlap check excludes the lease being edited** (`id: { not: … }`). A lease always overlaps itself, so without that no edit could ever save; real overlaps still 409 (verified by trying to move one lease onto an occupied unit)
- [x] An edit **re-derives** the lease from the unit's current rent rather than preserving the signed value — a correction of the record, not the passage of time. The form shows the recomputed total beside the end date so the change can't happen out of sight
- [x] **An edit can't invalidate money already taken**: if the corrected value falls below what has been paid, the edit is refused with both figures named ("would make the lease worth TZS 300,000, but TZS 400,000 has already been paid"). Leases with no invoice (pre-migration) simply have nothing to sync
- [x] Row action added to the leases table (Eye → Pencil → Trash, matching the units table). `LeaseFormDialog` gained an edit mode keyed on the lease id, so opening a different row re-seeds the form by remount rather than an effect
- [x] **`LeaseRow` now carries `propertyId`/`unitId`/`unitRentAmount`/`unitMinTenureMonths`** because `getLeaseOptions` lists only *free* units — a let unit is by definition absent from it, so the edit form merges the lease's own unit (and property, if that unit was the only free one there) back into the choices. Without this the Unit field opened empty
- [x] Lease `DELETE` now revalidates `/payments` and `/dashboard` too — its invoice and payments cascade with it, so the money views move
- [x] **`getPayments` was quadratic**: it included `invoice.payments` on every row, so an invoice with n payments hydrated n² payment rows. Replaced with one `payment.groupBy` shared across the mapping
- [x] `getPayableInvoices` now decides what's payable from two narrow reads (two columns per invoice, one grouped total each) and pays for the tenant/unit joins **only on the rows that survive the filter**
- [x] The dashboard's `billing` block no longer loads every invoice with every payment nested — two narrow reads, everything derived from those
- [x] Verified the rewrite is behaviour-preserving by capturing the figures in SQL first and matching them exactly afterwards (2 invoices, TZS 1.1M invoiced, 900k paid → 200k outstanding, 82%, 3 payments, 1 unsettled); payments page identical. Then edit end to end: below-paid refused, valid edit saved and the invoice followed it to 900k with `dueDate` moved, real overlap 409, cross-org PATCH 404, no-invoice lease edits without error. All test data removed

## Phase 38 — Agreed rent per lease

- [x] **Answered first, with evidence: `Lease.leaseAmount` is the whole term's value, not a monthly rate.** It was written in exactly one place (`insertLease`) as `rentAmount * durationMonths`, and every row confirmed it (Z1: 300,000 × 2 = 600,000 stored). `Invoice.amount` mirrors that total. Only the 1-month leases looked ambiguous, because there total and monthly coincide
- [x] Migration `lease_monthly_rent`: **`Lease.monthlyRent Int`** — the rate actually agreed, stored rather than inferred from `leaseAmount / durationMonths`. Hand-written because a NOT NULL add needs a backfill; the backfill is exact (every existing `leaseAmount` was `rate × months`, so dividing recovers the rate) and was checked to satisfy `monthlyRent * durationMonths = leaseAmount` on all 6 rows
- [x] `createLeaseSchema`/`updateLeaseSchema` gained a **nullish `monthlyRent`**: omitted means "whatever the unit asks", so callers that don't negotiate need no change. Bounds mirror `createUnitSchema.rentAmount`. Server resolves `input.monthlyRent ?? unit.rentAmount`
- [x] `insertLease`'s param renamed `rentAmount` → `monthlyRent`: it is no longer necessarily the unit's rent, and the old name invited confusion with `unit.rentAmount`
- [x] **Renewals carry the agreed rate forward** rather than repricing to the unit's asking rent — a renewal continues the arrangement, and silently re-rating a negotiated lease isn't a job's decision
- [x] **The lease detail page's "Monthly rent" now shows `lease.monthlyRent`, not `unit.rentAmount`** — that row was the asking price wearing the lease's label, and would have been outright wrong the moment a rate was negotiated. The unit's asking price still shows on the Unit info card, where it belongs
- [x] Form gained a Monthly rent field that stays **blank for the common case**, placeholdered with the unit's asking rent, and the total line now spells out the arithmetic (`TZS 180,000 × 3 = TZS 540,000`) so a negotiated rate is visible before saving
- [x] Verified by driving `createLease`/`updateLease` directly (browser session was lost to a server restart and signing in isn't something I can do): default falls back to the unit's rent, a negotiated rate wins, editing the rate re-derives total *and* invoice, and clearing the override falls back again — 4/4 pass, test leases removed. `tsc` + lint clean
- [ ] **Not yet eyeballed**: the new field and the corrected "Monthly rent" row have not been seen in a browser. Worth a look next time you're signed in

## Phase 39 — Expiry tags on the End date column

- [x] **`components/leases/expiry-tag.tsx`** — a running lease inside 60 days of its end date gets a clock tag beside its end date, escalating as the date nears: **outline clock inside 60 days, destructive alert-clock inside 30**, each carrying the day count ("30d") because "soon" isn't actionable on its own. A `title` spells it out in full for hover and screen readers
- [x] **Escalation runs toward expiry** — nearer means louder. The request's wording was ambiguous about which tier should be sharper; this matches the renewals panel, which already golds anything under 30 days (`daysLeft <= 30 ? "accent" : "default"`), so the two surfaces now agree. One line to flip if the other reading was meant
- [x] **The tier is computed server-side** in `leaseExpiry()` alongside `leaseStatus`. A client component calling `Date.now()` during render answers differently on the server than on hydration, so a lease sitting on a threshold would flicker between tiers — and the tables are `"use client"`, so they render in both places
- [x] Only a lease that has **actually started** can be "ending soon": an upcoming short lease is near its end date without that meaning anything yet, and an ended one is past caring. Both return null
- [x] Shown on **both** lease tables — the org-wide one and the tenant's Lease tab — from one component and one server-side helper, so the two can't drift
- [x] Verified live against real data: Baraka Mushi (11 Sept, **30d**) renders the destructive tag, Amani and Neema (10 Oct, **59d**) the outline one, and Hassan Said's ended lease no tag at all. Boundary confirmed inclusive at exactly 30. Titles read "This lease ends in 30 days". Light + dark, 375px with no page overflow, tenant tab matches. `tsc` + lint clean

## Phase 40 — Navigation cost, sticky filters, auth rate limiting

- [x] **`experimental.staleTimes.dynamic = 30`** in `next.config.ts`. Every page here is dynamic (they all read the session cookie) and Next 15 changed that default to **0**, so returning to a page you were just on re-ran its queries. Measured: a Leases → Payments → Leases → Payments cycle cost **4 server fetches before, 0 after** once both pages are warm
- [x] **Confirmed it can't serve stale data after a change**: warmed `/payments` (showing TZS 600,000), edited the lease from `/leases`, hopped back — it read **900,000**. `revalidatePath` evicts the client cache, so the only thing being cached is data nobody has touched
- [x] A hard reload still fetches fresh, and the 30s window means another user's change appears on the next navigation after it, not minutes later
- [x] **`runAutoRenewals` is throttled to one sweep per org per 5 minutes.** It ran a candidate query on *every* `/leases` and `/dashboard` render to find something it almost never finds; renewal is a date-boundary event, so being minutes late to notice one is invisible. Stamped before the work so a failure can't be retried by every concurrent request
- [x] **Table filters survive navigation** — `DataTable` gained an optional `stateKey`, and search + facet filters + sort are kept in a module-level map for the life of the tab. Applied to the four list pages (`leases`, `payments`, `tenants`, `roles`)
- [x] Deliberately **not** storage-backed: a module map is empty on the server *and* on a fresh load, so first render agrees on both sides and there is no hydration mismatch to paper over — and it only holds a value after a client-side navigation, which is exactly the case being fixed. A hard reload starts clean, which is right for a filter: it should never be a hidden reason a list looks empty. Written from the change handlers, since the codebase lints against set-state-in-effect
- [x] Verified live: searched "Amani" (4 rows → 1) and set Status = Active, navigated to Payments and back — **both restored**, facet reading "Active". Hard reload → clean, all 4 rows
- [x] **`lib/rate-limit.ts`** — fixed-window in-memory limiter. `POST /api/auth/login` gets **10/min per IP and 5/min per identifier** (the second budget matters: without it a spread-out attacker keeps every IP under the limit while hammering one account). `POST /api/auth/register` 5 per 10 min, public `POST /api/invitations/accept` 10 per 10 min. All return 429 with `Retry-After`
- [x] Verified: 12 wrong-password attempts gave `401 ×5` then `429 ×7` — the per-account budget biting first, as intended — with `Retry-After: 60` and a counting-down message. Register gave `400 ×5` then `429`. Window recovers (a later attempt returned 401 again)
- [x] **Known limit, documented in the module**: in-memory means per process, so multiple instances give an attacker one budget each and a deploy resets counters. It makes online guessing slow rather than being a security boundary; swap the store for Redis if this ever runs on more than one instance

## Phase 41 — Real fonts were never loading in light mode; animated theme toggle

- [x] **Found and fixed a load-bearing typo-class bug**: `--font-sans`/`--font-mono`/`--font-heading` in `@theme inline` (the top of `globals.css`) still held the shadcn scaffold's placeholder values (`Inter, sans-serif`, `JetBrains Mono, monospace`) — never updated when Sora/Hanken Grotesk/IBM Plex Mono were wired up via `next/font` in `app/layout.tsx`. Tailwind v4's `inline` theme keyword **bakes a token's declared value into every utility/`@apply` that uses it directly at build time** — so `html { @apply font-sans }` compiled to the literal placeholder text, and the *actual* per-theme overrides sitting in `:root`/`.dark` further down the file were dead code that never reached it. Confirmed by grepping the compiled `.next` CSS output rather than guessing from source
- [x] Consequence was worse than "wrong font family": **`.font-heading` (card/dialog/sheet titles) compiled to `font-family: var(--font-sans)`**, not `var(--font-heading)` — because `--font-heading`'s own `@theme inline` value was `var(--font-sans)`, and Tailwind's inlining only flattens a token's own value one level, leaving a nested reference to *another* theme token as literal `var()` text. So Sora, loaded and configured since the beginning, had **never actually rendered anywhere** — every heading silently fell back to the body font
- [x] Fixed at the root: `@theme inline` now points `--font-sans`/`--font-mono`/`--font-heading` straight at the `next/font` CSS variables (`--font-hanken`, `--font-plex-mono`, `--font-sora`), which are already theme-independent (set once on `<html>` regardless of `.dark`). Removed the now-fully-dead duplicate declarations from `:root` and `.dark` rather than leaving them to confuse the next person who goes looking for "where does the font actually get set"
- [x] Verified via computed styles, not eyeballing: `body`/`html` `font-family` in both themes, plus a probe element for `.font-mono` and `.font-heading` specifically — all three now resolve to their real loaded faces (Hanken Grotesk, IBM Plex Mono, Sora) in **both** themes, where before light mode got the browser's bare system-ui fallback and headings never got Sora in either
- [x] **Animated theme toggle**, via the View Transitions API: clicking the toggle plays as a ring expanding from the button's own position — the browser snapshots the old/new paint states and a `clip-path: circle()` Web Animation reveals the new one, rather than every element recoloring in one frame. Falls back to the previous instant switch under `prefers-reduced-motion` or on a browser without `document.startViewTransition` (Firefox, at time of writing) — verified both paths explicitly, including catching the circle mid-flight by pausing `document.getAnimations()` a moment after the click
- [x] The API's own default ~250ms crossfade of old/new snapshots is turned off in `globals.css` (`::view-transition-old(root), ::view-transition-new(root) { animation: none }`) so it doesn't run underneath and muddy the circle — the circle is the only motion
- [x] `disableTransitionOnChange` on `ThemeProvider` was left as-is: it suppresses ordinary per-element `transition-colors` firing during the class swap, which would otherwise create a second, out-of-sync fade underneath the snapshot-based circle. Complementary, not conflicting

## Phase 42 — Motion: skeletons, page transitions, counting figures, entering rows

Four animations, **no new dependency** — `tw-animate-css` was already installed and
already animating the base-ui components, so a second system (`motion`) would have
meant maintaining both.

- [x] ~~**`components/skeletons.tsx`** + a `loading.tsx` for all 12 routes~~ — the `loading.tsx` files stayed, but the skeletons themselves were **replaced in Phase 43**; `components/skeletons.tsx` is deleted
- [x] **Page transitions** via React's `<ViewTransition>` (`experimental.viewTransition: true`). Wraps only the content area in `app/(app)/layout.tsx`, so the sidebar and header stay in the untouched `root` snapshot and hold still. `default="page"` because a navigation inside a persistent layout is an *update*, not an enter/exit — the boundary survives and only its children swap
- [x] **`::view-transition-group(.page)` is `animation: none`** — page heights here range from the dashboard to a four-field form, and letting the group morph between them squashes both snapshots the whole way. `height: auto` on old/new then stops the shorter one being stretched to fill the other's box
- [x] **`components/dashboard/animated-figure.tsx`** — counts the headline figure up from zero. Finds the number *inside* the already-formatted string ("TZS 900,000", "TZS 1.4M") and puts it back with the same grouping, decimals, prefix and suffix, so `lib/format.ts`'s rules aren't reimplemented. Lands on the server's exact string rather than the eased approximation
- [x] **The count is written to `textContent` from a layout effect, not held in state** — state seeded at zero would render zero on the server, and an ordinary effect runs *after* paint, so the card would show the real figure, blink to zero, and count back up to where it already was. Also sidesteps the codebase's set-state-in-effect rule
- [x] Progress bars grow from zero via a `from { width: 0 }` keyframe — pure CSS, so `MetricCard` stays a server component and the real width stays on the server-rendered element. Sub-stats deliberately **don't** count: at 11px across six cards that reads as a flickering wall, not a figure arriving
- [x] **`DataTable` now sets `getRowId` from the record's own id.** TanStack defaults to the array index, so "row 0" became a different record on every filter change. This was load-bearing for the animation — without it React tears down and rebuilds rows that merely moved, and every surviving row re-animates — and it incidentally makes row selection follow the record rather than the slot
- [x] Rows enter with `motion-safe:animate-in fade-in-0 slide-in-from-top-1`, staggered `min(index, 10) × 25ms`. **`animation-fill-mode` is set inline to `both`**: tw-animate-css leaves it at `none`, which paints the row in place for the length of its delay and only then snaps back to animate
- [x] Verified in the browser, by measurement rather than eyeballing: the count-up was caught mid-flight starting at `TZS 0`, stepping through `TZS 1,013,677 → 1,495,279`, landing exactly on `TZS 1,590,000`; a navigation fired `startViewTransition` once with `page-fade` on `::view-transition-old`, and freezing it mid-flight showed no squash; **a row surviving a filter kept the same DOM node** (tagged before, still tagged after) and its animation read `finished` at 250ms while the three returning rows read `running` at 83ms with opacities 0.70/0.49/0.02 — the stagger visible in the descending values; the `/users` skeleton rendered 43 placeholders for ~450ms before the real 7-row table
- [x] **Theme toggle re-checked, since the new rules touch the same pseudo-elements**: `::view-transition-new(root)` still animates `clipPath`, unchanged. The content area has no view-transition-name outside a React transition, so the circle still covers the whole page
- [x] Light + dark, 375px with no horizontal overflow (`scrollWidth` 375 = `innerWidth`). `tsc` clean, lint clean apart from pre-existing warnings
- [ ] **Reduced motion was not exercised in a browser** — the emulation isn't available here. Confirmed instead that all three paths compiled into the served CSS (`prefers-reduced-motion: reduce` blocks for the view transitions and `.animate-bar-grow`, `no-preference` for the rows' `motion-safe:`), and the count-up checks `matchMedia` before starting

## Phase 43 — One loader instead of skeletons, sidebar motion, payments in search, auth ripples

- [x] **`components/skeletons.tsx` deleted; `components/app-loader.tsx` replaces it** across all 12 `loading.tsx` files. User call, and the right one: skeletons pay for themselves on a slow, uncertain wait, where holding the page's shape stops the reader losing their place. These waits are a second or two, and a dozen bespoke grey outlines flashing past read as the interface breaking rather than working
- [x] The loader is the Rentops mark with rings running out of it like a drop hitting water, one gold arc turning, and a label carrying a gold sheen. Built on `--stat-accent` — the same gold as the active sidebar item, the occupancy bars and the toast — so it belongs to the app instead of being a generic spinner parked inside it. Each route passes its own label ("Loading your dashboard", "Preparing the form")
- [x] **Sidebar motion, added to `sidebarMenuButtonVariants` so every menu item inherits it**: a half-step nudge toward the content on hover, icons to 110%, and `nav-pop` firing once on the icon of whichever item has just become active — which is the navigation itself being acknowledged
- [x] **The nudge is suppressed in the collapsed icon rail** (`group-data-[collapsible=icon]:hover:translate-x-0`): sliding a 32px square sideways inside a 48px rail reads as the icon coming loose, not as a response to the pointer
- [x] The transition names its properties explicitly rather than using `transition-all`, so a future `filter` or `opacity` utility on a menu button doesn't silently start easing too
- [x] **Payments are now a sixth global-search type.** Scoped through `invoice.lease` with the same double filter every other lease query uses — the membership's org *and* the unit's property's org. Matches on tenant name/email/phone, payment method, and the invoice reference a user can actually see
- [x] `leaseIdSuffix` generalised into `referenceSuffix(query, prefix)`, with `invoiceIdSuffix` beside it for `INV-9VNQV`. **The two can't collide**: a query still carrying the other prefix keeps its hyphen after the strip and fails the alphanumeric test, so "INV-ABC" is never matched against lease ids
- [x] `"payment"` added to **`TYPE_ORDER` in `global-search.tsx`** — required, not cosmetic: that array is both the section order and the filter, so a type missing from it never renders however many rows the API returns
- [x] **New `--kind-payment` token.** The existing hues sit at 36/81/155/254/300 and the rule has been 45° minimum separation, which leaves exactly two openings — ~204 and ~348. Teal over rose: a rose badge on a money row reads as a warning. **Contrast measured, not eyeballed** (resolved through a canvas, since `getComputedStyle` returns `lab()` here): **5.50 light / 5.66 dark**, both passing AA for normal text and sitting in the same band as the existing five
- [x] **`components/auth/auth-ripple.tsx`** — three water rings sent out across the auth panel on every move between sign in, register and the three reset steps. The whole mechanism is `key={pathname}`: React throws the old rings away and mounts new ones, and a CSS animation runs on mount. No effect, no state, no timer to clear, and a second navigation mid-ripple simply replaces the elements the first was animating
- [x] Soft-edged via a radial gradient rather than a hard border, easing out on `cubic-bezier(.22,1,.36,1)` — most of the travel happens immediately, then it spreads and flattens, which is what a disturbance in water actually does
- [x] **`relative` added to the auth form wrapper, and it is load-bearing**: the ripple is positioned and the form was static, and a positioned element paints over a static sibling regardless of DOM order — without it the rings run across the form rather than behind it
- [x] Verified: ripple caught mid-flight on a real login → register navigation (3 rings, `auth-ripple` running from scale 0), then frozen at 457ms with opacities 0.12/0.26/0.51 showing the stagger, and screenshotted behind the form; payments search driven directly against the DB — tenant name → 2 payments, method "Bank transfer" → 1, "INV-UB3QG" → 2, bare "UB3QG" → 2, lowercase "inv-ub3qg" → 2, nonsense → 0, and **all three queries return 0 payments when run as the other organization**; loader CSS confirmed live (rings animating in the gold, arc at 1.1s with only its top border coloured, label `background-clip: text` with the sheen running); `nav-pop` confirmed running for 320ms when `data-active` is set, and every sidebar rule confirmed in the served CSS
- [ ] **Not seen in situ: the loader inside a real route, the sidebar, and payments in the actual search dialog.** The browser session expired mid-session and signing in is not something I can do — same limitation as Phase 38. The loader was verified by rendering its exact markup as a probe on the login page, and the sidebar rules by reading the compiled CSS. Worth a look next time you're signed in
- [ ] **This browser pane never delivers CSS `:hover`** — `matches(":hover")` stayed false with the pointer confirmed over the element by `elementFromPoint`. So the hover nudge and icon scale were verified as generated CSS rules rather than as observed motion

## Phase 46 — Mobile: card lists, infinite scroll, filter and action sheets

- [x] **`DataTable` gained a mobile mode**, switched on by supplying `renderCard`. Under 768px a table either scrolls sideways or crushes its columns; the card list replaces it entirely. Without `renderCard` a table keeps its current mobile behaviour, so nothing else in the app changed
- [x] **Sticky toolbar with the search always visible**, and the facets behind a `Filters` button carrying a count badge. Searching is the common case and should cost no taps; three facet selects wrapped across a 375px screen is what actually needed hiding. `-mx-4 px-4` bleeds the bar through the page's own gutter
- [x] **Filter bottom sheet with Apply and Reset**, working on a *draft*: on a sheet that covers the list, applying each choice live means changing facets against results nobody can see. The draft seeds from the live filters via a `key` remount — the pattern this codebase uses for every dialog form, never an effect
- [x] **Reset clears the facets and deliberately leaves the search alone** — the box is visible and clearable on its own, and wiping it from a panel it isn't shown in would look like the list broke
- [x] **`FacetFilter` gained `label`.** Without it the sheet's field caption repeated the placeholder — "All statuses" written above a control already reading "All statuses". Falls back to the placeholder
- [x] **Row actions open a bottom sheet**, since a strip of 28px icon buttons is not a mobile target. The sheet closes *before* running the action: these mostly open a dialog, and two layered overlays trap focus in the wrong one — confirmed live when Edit opened cleanly over the closed sheet
- [x] **Infinite scroll replaces pagination on mobile**: eight rows, then eight more each time a sentinel comes into view. Client-side over rows already loaded — these pages hand the whole list to the component, so this is progressive *reveal*, not fetching
- [x] **The sentinel is remounted on every growth (`key={visibleCount}`)**, which is the whole trick: an IntersectionObserver fires on a *change* of intersection, so a sentinel still on screen after a short batch would never fire a second time and the list would stall after one load. Its observer is created in a **ref callback** with a returned cleanup rather than an effect — same lifecycle, and it sidesteps the set-state-in-effect rule
- [x] The window resets to one batch whenever filters or sort change, written from the existing change handlers. Applying a facet also scrolls back to the top — **but typing in the search does not**, because that fires per keystroke and yanking the page on every letter is unusable
- [x] **One `rowActions` source per table.** `buildTenantColumns` now renders the desktop icon strip from the same function `DataTable` hands its mobile sheet, so the two can't drift. The member Leases tab passes `rowActions` for mobile only — it has never had a desktop actions column, so there is nothing to drift from
- [x] Verified live at 375px: tenants render as cards (avatar, name, status, phone, placement carrying the same "(past)"/"(upcoming)" rule as the table, joined date); the actions sheet opened with all three actions correctly named for the tapped row; **Apply narrowed 6 cards → the 3 Active tenants and badged the button "1", Reset restored all 6 and cleared the badge**, and reopening in between showed "1 filter selected" with Active pre-seeded — the draft seeding proved
- [x] **Infinite scroll proved against real volume**: 22 test tenants created through the API, giving 28 rows in an 812px viewport. Scrolling stepped **8 → 16 → 24 → 28** with the sentinel counting **20 → 12 → 4 → gone**, then held at 28 with a "28 results" footer. That the second and third batches fired at all is the `key` remount working. **All 22 test tenants deleted afterwards; back to the original 6, no leftovers**
- [x] The window reset was checked separately from the sentinel: measured from the top of the list, searching drops it to exactly 8 with "14 more" and holds. An earlier reading that looked like a failure was the sentinel legitimately refilling because the page was still scrolled past it
- [x] Member Leases tab renders as cards too — reference, property/unit, status, the term as a single range with `ExpiryTag` beside it, duration and amount. No horizontal overflow on either page (`scrollWidth` 375 = `innerWidth`)
- [x] **Desktop confirmed unchanged** after the actions-column refactor: table present, all 9 columns, 6 rows, pagination, facet select, and the same three row actions with the same accessible names. Zero cards rendered
- [x] Hit the **Turbopack stale-module trap a fourth time** mid-edit (`STATUS_VARIANT`, `EyeIcon`, `rowActions` all briefly undefined while the rename was half-applied). Fast Refresh performed a full reload and recovered; server log clean since. Worth expecting on any rename that spans two files
- [ ] **Only tenants and the member Leases tab have card views** — leases, payments, users, roles and a property's units still show the scrolling table on mobile. Each is one `renderCard` away
- [ ] **Row selection has no card equivalent.** The tenants table's select-all/select-row checkboxes exist only in the desktop table; nothing currently acts on a selection, so this costs nothing today, but a future bulk action would need a mobile answer
- [ ] Infinite scroll reveals rows already in memory. Fine at this size; a table that ever ships thousands of rows needs the server to paginate before this means anything

## Phase 47 — Card views for every remaining table

Extends Phase 46's mobile mode to the rest of the app. **Every `DataTable` in the
codebase now has a card view** — nine tables across eight surfaces.

- [x] Cards added for **property units, org-wide leases, the lease Billing tab, the payments page, Users (members *and* pending invites), and Roles & permissions**. Each drops to what identifies the row and what you'd act on, rather than stacking the table's columns
- [x] **`RowActionButtons` extracted into `data-table.tsx`.** The desktop icon strip was about to be written a fifth time, so it is now one component fed the same `RowAction[]` the mobile sheet gets. Spacing, sizing and accessible naming are defined once, and adding an action to a table adds it to both surfaces or neither
- [x] `buildUnitColumns`, `buildLeaseColumns`, `buildPaymentColumns`, `buildBillingPaymentColumns` and `buildTenantColumns` all converted from `onView`/`onEdit`/`onDelete` callbacks to a single `rowActions` function
- [x] **Users is the deliberate exception.** Its members column mixes a *labelled* "Invite" button with icon buttons, and routing it through `RowActionButtons` would flatten Invite into an unlabelled icon. Desktop keeps its hand-written column; `rowActions` is supplied for mobile only, carrying the same `canSignIn` condition. The trade-off is written at the call site so the next edit knows both lists exist
- [x] **Roles gets a card but no actions button** — roles still can't be renamed or deleted, so `rowActions` is omitted entirely rather than rendering a control that opens an empty sheet
- [x] Card content decisions worth keeping: the units card leaves floor/block/tenure/amenities in the View dialog where they already lived; the Billing card drops the invoice reference and status because every row there belongs to one invoice whose figures are on the Overview tab; the payments card puts the invoice-status badge beside the *reference* rather than the tenant, since it describes the invoice and not the person; the invitation card falls back through name → email → phone, because `Invitation.name` is nullable
- [x] `label` added to every facet filter (Status, Unit type, Method, Invoice status, Role, Type) so the sheet's caption stops repeating the placeholder
- [x] Verified live at 375px on all eight surfaces — cards render, no table, no horizontal overflow anywhere: leases (tenant · unit · term + expiry tag · invoice status · amount), payments (`INV-UB3QG Partial Bank transfer`), units (`Z4 Studio Vacant Nobody in it TZS 190,000/mo`), billing (`TZS 300,000 10 Aug 2026 Bank transfer`), members (7 cards with role badges), roles (`Owner Built-in 1 member`, correctly pluralised, **no actions button**), and the invites empty state
- [x] **Invitation card and its action driven end to end**: created a test invite through the API → card rendered `ZZInviteTest Tenant 0799111222 Expires 27 Aug 2026` with the tab badge at 1 → actions sheet offered "Revoke invite" → **the sheet closed and left exactly one dialog open**, confirming again that closing before the action avoids stacked overlays → confirmed the revoke → 0 pending invites, badge cleared. **Test invite gone**
- [x] **Desktop re-verified after the actions refactor**: leases keeps all 11 columns, 4 rows, pagination and `View/Edit/Delete lease for Amani Mwakalinga`; payments keeps its 7 columns and `Remove payment of 300000`; users keeps its 7 rows **and its labelled "Invite" button**. Zero cards rendered on any of them
- [x] Turbopack stale-module trap again mid-edit (`RoleCard is not defined`, between adding the usage and adding the import). Recovered on the next compile; server log clean since. `tsc` and lint clean

## Phase 50 — Payment amounts can be typed as arithmetic

- [x] **`lib/amount-expression.ts`** — a tiny recursive-descent parser (`+ - * / ( )`, precedence, unary minus) so "250000*5" can be typed straight into an amount field instead of the user reaching for a calculator. Hand-written rather than `eval`/`new Function`: those execute arbitrary text from an input box, and the app's CSP would block them anyway
- [x] Tolerates what people actually type: `x` and `×` multiply, `÷` divides, and commas are group separators, so `250,000 x 4` parses. Rejects everything else — a stray letter is a typo, not an operator
- [x] **The inputs had to stop being `type="number"`.** A number input silently refuses every character that isn't part of a number, so `*` could never have been typed into one. Now `type="text"`; the cost is a full mobile keyboard instead of a numeric pad, which is the trade the operators are for
- [x] **A live total under the field** (`AmountExpressionHint`), shown only when the input is actually a sum — echoing "= TZS 250,000" at someone who typed `250000` is noise. Division can land between shillings, so it also says "rounded from …" rather than quietly changing the figure; `Payment.amount` is an `Int` and TZS has no subunit
- [x] **Applied to both payment dialogs**, not just Billing — the two were unified once already (Phase 33, the method picker) and letting them diverge on how an amount is typed would be the same mistake
- [x] **The overpayment guard now compares the evaluated total.** It previously did `Number(amount)`, which on "250000\*5" is `NaN` — so an expression would have sailed past the client check entirely. Confirmed live: `250000*5` against a 200,000 balance shows both "= TZS 1,250,000" and "That's more than the remaining balance of TZS 200,000"
- [x] Proved the parser with a 26-case harness before wiring anything: precedence (`100000+50000*2` → 200000), brackets, unary minus, commas, `x`/`×`/`÷`, rounding (`1/3` → 0, exact 0.333), and rejection of `250000*`, `*5`, unbalanced brackets, `2 3`, `5/0`, `alert(1)` and `250000; drop table`. All 26 passed
- [x] Verified in the browser end to end: live totals for `250000*5`, `250,000 x 4`, `100000+50000`, `1/3` and the error for `250000*`; then **recorded a real payment of `50000*4` and it stored as TZS 200,000**, not 50000 and not NaN. **Test payment deleted afterwards** — the lease is back to its original two payments
- [ ] The amount field on **other** money inputs (unit rent, lease monthly rent) still takes plain numbers. Same helper would drop in if that turns out to be wanted

## Phase 51 — Payment dialogs: parity, and the sum lands in the field

- [x] **`components/payments/invoice-summary-card.tsx`** — the total / paid so far / balance breakdown, extracted from the payments dialog and now used by both. Record payment had only a "Balance remaining" line in its header, which is why it read as the thinner of the two
- [x] **In Record payment the invoice is fixed, not chosen.** A lease has exactly one invoice, so the card is a read-out with no picker — deliberately different from the payments page, where the same card sits above a combobox. `reference` is an optional prop for that reason: it identifies which invoice was picked from a list, and there is nothing to distinguish on a lease
- [x] `RecordPaymentDialog` now takes the `invoice` rather than `invoiceId` + `balance`, typed structurally so it doesn't import back from `billing-tab`, which imports it
- [x] The dialog's "Balance remaining: X" header line was **dropped** once the card landed — the same figure in two places is one to keep in step and one to misread. It now says what the dialog does instead
- [x] **The evaluated sum folds into the input itself on blur**: `250000*4` becomes `1,000,000` in the box. The answer belongs where the question was asked; a caption underneath meant reading two places to know what would be saved. On blur, not per keystroke, which would fight the typing
- [x] **Grouped with commas** — `600000` types as `600,000`, `500000/3` lands on `166,667`. The parser already treats commas as separators, so a folded value re-parses cleanly on submit (confirmed: submitted `200,000` and it stored as 200000)
- [x] **All captions under the amount field removed** — the `= TZS …` hint (`amount-expression-hint.tsx` deleted) and "Up to TZS X. You can type a sum". The card above states the balance; the input states the total. Only genuine errors render there now
- [x] Rounding is no longer announced in a caption but is **visible in the field itself** — `500000/3` shows `166,667`, which is both the disclosure and the thing that will be saved, and can be corrected in place
- [x] Verified live in both dialogs: Record payment shows `Invoice total TZS 600,000 / Paid so far TZS 400,000 / Balance TZS 200,000` **with no picker**; Make payment shows the same card **with** the `INV-UB3QG` reference row above it. Folding checked on `250000*4` → `1,000,000`, `250,000 x 5` → `1,250,000`, `600000` → `600,000`, `500000/3` → `166,667`, and an invalid `250000*` correctly left alone with its error
- [x] **Over-balance guard still fires without its caption**: `250000*5` against a 200,000 balance shows "That's more than the remaining balance of TZS 200,000"
- [x] Round trip through Record payment with a folded, comma-formatted value recorded TZS 200,000 correctly. **Test payment deleted** — the lease is back to its original two. `tsc` and lint clean

## Phase 52 — Amount grouping while typing, lease Overview rework, property filters

- [x] **Digits group as you type**, not only after evaluation: `500000*3` now reads `500,000*3` on the way in. `groupAmountDigits` formats each number in the text and leaves operators alone; safe on every keystroke because the parser already treats commas as separators, so grouping can never change the value
- [x] **The caret had to be carried across the reformat.** First attempt restored it in `requestAnimationFrame` and **lost the race with React's commit** — inserting a digit mid-number regrouped correctly but threw the caret to the end anyway. Moved to a layout effect keyed off a ref, which runs after the DOM updates and before paint. Verified: typing `1` after the leading `5` of `500,000` gives `5,100,000` with the caret at index 3, immediately after the digit typed
- [x] Both dialogs' amount fields collapsed into one **`AmountInput`** — grouping, caret restoration and fold-on-blur are one implementation rather than two copies
- [x] **The server's overpayment message is formatted**: `That's more than the remaining balance of TZS 200,000`, not `200000`. It is rendered verbatim under the field, so an ungrouped number there read as a different kind of figure
- [x] **Make payment's card no longer repeats the invoice reference** — the picker directly above already names it. `reference` was removed from `InvoiceSummaryCard` entirely rather than left unused
- [x] **Billing tab carries a payments count badge** (`Billing 2`), matching the Units and Users tabs. Hidden at zero: a "0" beside a tab reads as a problem rather than a total
- [x] ~~**Lease Overview restructured into a 2×2 grid**~~ — corrected in Phase 53 below: a grid aligns rows, and these cards are nowhere near equal height, so it left a hole. Now two independent columns
- [x] **`InvoiceProgress`** replaces the invoice card's Total / Paid so far / Balance rows with a bar — the same three numbers, but the reader no longer has to subtract to see where the invoice stands. Reference, Status and Due date stay as rows beneath. Verified live: 67% for 400,000 of 600,000, `aria-valuenow` matching the fill width
- [x] **Leases page gained Property and Invoice status filters**, alongside the existing lease status (relabelled "Lease status" now that two status facets sit side by side). Property options come from the rows themselves, not `getLeaseOptions` — that list includes properties with no lease yet, which would filter to an empty table
- [x] `propertyName` on the lease column needed an explicit equality `filterFn`: TanStack's default is substring, so a facet offering "Likely" would also have matched "Likely Annex"
- [x] **Payments page gained a Property filter and column**, and the Invoiced cell now reads `INV-UB3QG · TZS 600,000` on **one line** instead of stacked. `PaymentRow` regained `propertyName`/`unitLabel`, dropped back in Phase 34 — a facet needs the value on the row. Org scoping is still the `where` clause, never the include
- [x] **Mobile carried through**: the filter sheet renders all three lease facets as chip groups (Property / Invoice status / Lease status) and fits without scrolling; payment cards show property and the inline invoice reference + amount; the Record payment dialog shows the invoice card and fits the viewport. No horizontal overflow on any page checked
- [x] `tsc` and lint clean. No test data created — the overpayment probe returned 400, and payment counts are unchanged

## Phase 53 — Lease Overview: two columns of equal height

Took three attempts, each fixing the previous one's fault.

- [x] **A 2×2 grid was wrong**: a grid aligns its *rows*, and Tenant (217px, three rows) sat beside Unit info (409px, seven), leaving a measured **192px hole** under Tenant. `items-start` only chose which fault to have — without it the short card stretches into blank space, with it the gap is simply empty
- [x] **Independent columns fixed the hole but staggered the two sides** — a bento look, with the cards on one side offset against the other. Not wanted
- [x] **Settled shape: two columns, equal height, whatever they hold.** The grid keeps its default `items-stretch` so both wrappers take the taller one's height, each wrapper is a flex column, and every card carries **`grow`** so the surplus is shared between the cards in the shorter column instead of pooling as a gap at the bottom. `grow`, not `flex-1`: the cards keep their content-based proportions and only the *extra* is divided, so Tenant doesn't get inflated to match Unit info
- [x] Measured after: **both columns exactly 693px, both bottom edges at 989** — dead level. The 47px surplus split evenly between the two left-hand cards (+23px each), which is invisible at a glance
- [x] Pairing is by meaning as well as balance — identity and location left (Tenant, Unit info), terms and money right (Lease terms, Invoice)
- [x] **Mobile unaffected**: below `lg` the grid is one column, each wrapper is its own row, so there is no surplus and `grow` does nothing — heights measured back at their natural 217/409/361/312, order still Tenant → Unit info → Lease terms → Invoice, no overflow
- [x] Not reverted to the pre-Phase-52 shape (two side by side, two full-width): that gave Lease terms and Invoice the whole width for six short rows each and pushed the invoice below the fold

## Phase 54 — "Make payment" as a lease row action

- [x] **Added to the leases table's row actions**, second after View — paying against a lease is a routine job that previously meant opening the lease, switching to Billing, and only then recording it
- [x] **Order is fixed on every row: Make payment → View → Edit → Delete.** Payment leads because it is the routine job on this page
- [x] **A lease with nothing to pay shows the control greyed, not missing.** `RowAction` gained `disabled` + `disabledReason`, honoured by both the desktop icon strip and the mobile sheet. Omitting it would shift View, Edit and Delete one place left on some rows and turn a familiar position into a misclick — which is why this differs from the "hide an affordance that can only fail" rule used for Create lease (see the decision log for when each applies)
- [x] Reuses **`RecordPaymentDialog`**, not the payments page's picker version: the row already determines the invoice, so asking which one would be asking a question whose answer is known. Keyed on the lease id so opening a different row re-seeds the form rather than syncing in an effect
- [x] Verified on desktop: all four rows list the same four actions in the same order; the Paid row's payment button measures **`disabled`, opacity 0.5, `title="Fully paid"`**, and clicking it opens nothing, while the enabled one opens on the right invoice (Hassan: total 1,140,000 / paid 0 / balance 1,140,000)
- [x] A disabled action renders as a `<button>` even where it would normally be a link — an anchor has no disabled state, and `pointer-events-none` would leave it focusable and followable by keyboard
- [x] Recorded end to end through it using an expression — `50000*2` folded to `100,000` on blur and saved as 100,000; the lease row stayed Partial with a balance still outstanding and continued to offer the action. **Test payment deleted**, back to the original three
- [x] **Mobile carried through**: the sheet lists all four in the same order, with the unavailable one greyed at opacity 0.5 and its reason ("Fully paid") set to the right of the label — a greyed row with no explanation only raises the question. No horizontal overflow. `tsc` and lint clean

## Phase 55 — Primary row action on tenants and payments

Both follow Phase 54's shape: the page's main job leads, and an unavailable
action is greyed with a reason rather than dropped.

- [x] **Tenants: "Assign lease"**, first of four (Assign lease → View → Edit → Remove). Enabled for **Prospect and Vacated**, greyed for Active and Upcoming, since a tenant already in a unit isn't the one you're placing
- [x] Reuses `LeaseFormDialog` with **`lockedTenantId`** — the same guard the member page uses, so a lease started from someone's row can't quietly end up belonging to another tenant. Confirmed live: the Tenant field reads "Rehema Joseph" and is disabled
- [x] `app/(app)/tenants/page.tsx` now also fetches `getLeaseOptions` — the same free-unit list the leases page builds its form from — in the existing `Promise.all`
- [x] **Payments: "Add payment to INV-…"**, ahead of Remove. The row already names the invoice, so this opens the fixed `RecordPaymentDialog` rather than the picker the page's own button uses. Greyed once that invoice is settled
- [x] `PaymentRow` gained **`invoicePaid`**, which `getPayments` already computed and threw away. Worth noting against Phase 34, which removed the balance *column*: that decision was about **showing** a per-invoice figure on every payment row, where it read as per-payment. Carrying it as data for a dialog is a different thing, and the type says so
- [x] Verified on desktop — tenants: Prospect and Vacated enabled at opacity 1, all three Active rows `disabled` at **opacity 0.5** with `title="Already in a unit"`, order identical on every row. Payments: Amani's two Partial rows enabled, Neema's Paid row greyed with "Fully paid", and the dialog opens on the right invoice (600,000 / 400,000 paid / 200,000 balance) with no picker
- [x] Verified on mobile — both sheets list the same actions in the same order with the unavailable one greyed and its reason beside the label. No horizontal overflow
- [x] **Found and removed leftover test data**: a 200,000 Cash payment dated 14 Aug, created during an earlier verification round trip and not successfully deleted then — it had quietly settled Amani's invoice, which is why every payment row first appeared as "Fully paid". Amani is back to Partial (400,000 of 600,000) and the three seeded payments (all 10 Aug) are all that remain

## Phase 56 — Table search goes global; tenants filter by property

- [x] **The search box now searches every column**, via TanStack's global filter instead of one nominated column. On tenants that turns a name-only box into one that also finds by phone, unit, property and status — verified: `0754567890` → Baraka, `Z1` → Amani, `Likely` → 5 tenants, `Vacated` → Hassan, and `Rehema` still → Rehema
- [x] **Placeholders are unchanged** ("Search tenants…", "Search leases…", "Filter units…") — they name the thing being searched, not the field, so they were already right
- [x] `globalFilterFn` set explicitly to `includesString` rather than the `auto` default, which picks a matcher from the value's type and would rank-sort some columns while substring-matching others
- [x] **`searchColumnId` deleted from the API and all nine call sites**, replaced by `searchable` (default true). Leaving it would have been a prop that no longer does what its name says. Columns with no accessor — the select checkbox, the actions cell — are excluded by TanStack automatically
- [x] The search is remembered per table alongside sorting and filters (`StickyTableState` gained `globalFilter`), preserving the behaviour it had as a column filter, and it resets the mobile reveal window through its own handler now that it no longer arrives via `handleColumnFiltersChange`
- [x] **Tenants gained a Property facet**, options drawn from the tenants on screen so it can't offer a property with nobody in it. A tenant with no unit carries `null` and is excluded once a property is chosen, which is correct — they aren't in any of them. Verified: "Likely" → 5 of 6, Reset → 6
- [x] Mobile carried through: global search works in the card list (`Z3` → Baraka), and the filter sheet shows Property and Status as chip groups. No horizontal overflow
- [x] **Known limitation**: the global filter matches *accessor* values, not rendered cells, so a date column stores an ISO string and won't match "10 Aug". Amounts match unformatted (`600000`, not `600,000`). Worth a `accessorFn` returning the display string on those columns if it ever matters
- [x] `tsc` and lint clean

## Phase 57 — Public landing page at `/`

- [x] **`/` is now a public marketing page**; `proxy.ts` gained a `pathname === "/"` branch that lets a signed-out visitor through and sends a signed-in one to `/dashboard`. The auth-page bounce target changed from `/` to `/dashboard` too — login and register both `router.push("/")`, so leaving it would have landed a freshly signed-in user on the sales page and relied on a second redirect to rescue them
- [x] Verified by minting a session token with the app's own `AUTH_SECRET` (signature only — `proxy.ts` never reads the DB, so **no test account was created**): signed in `/` `/login` `/register` all 307 → `/dashboard`; signed out `/` 200, `/dashboard` 307 → `/login`
- [x] **`motion` (Framer Motion 13) added** — reverses the 2026-08-13 "no JS animation library" decision, on the user's explicit request. Scoped to `components/landing/*`; the app itself still animates entirely in CSS. See the plan.md entry for why the landing page is the case that decision anticipated
- [x] `LazyMotion` + `strict` + a lazily imported `domMax` in its own module (`motion-features.ts`), so the feature bundle is a separate chunk — confirmed as `components_landing_motion-features_ts_*.js` in the build. `strict` makes a stray `motion.div` throw rather than quietly pulling the full bundle back in
- [x] `MotionConfig reducedMotion="user"` drops transforms and keeps opacity under `prefers-reduced-motion`
- [x] **Top nav**: frosts once scrolled past 16px, a gold scroll-progress hairline along its bottom edge, and an active-section pill that *slides* between links via a shared `layoutId` — the one feature that required `domMax` over the lighter `domAnimation`. Scroll spy is an IntersectionObserver over a band 15–45% down the viewport, resolved through `NAV_SECTIONS` order so the indicator only ever moves down the page. Mobile is a Sheet carrying the same links plus both CTAs
- [x] Sections: hero, the three-problem section, features, four data-trust cards, a free-while-in-beta band, an 8-question FAQ and a closing CTA
- [x] **Nothing on the page claims a capability the app lacks**, and there is deliberately no testimonial, customer count or "trusted by" figure — there is nobody to quote yet. Permission *enforcement* is specifically not claimed, since `/roles` still reads "Not configured"
- [x] SEO: `metadataBase` + title template on the root layout, per-page canonical/OG/Twitter, a generated `opengraph-image` via `next/og` (verified 200, 1200×630 PNG), `robots.ts`, `sitemap.ts`, and `Organization` + `SoftwareApplication` + `FAQPage` JSON-LD — the FAQ nodes built from the same `FAQS` array the accordion renders, so the markup can't describe answers the page doesn't show
- [x] **`/opengraph-image` had to be added to `PUBLIC_PAGES`**: its URL carries no extension (`/opengraph-image?<hash>`), so unlike `robots.txt` and `sitemap.xml` it falls *inside* the proxy matcher and would have been redirected to `/login` — every shared link unfurling blank. Verified 200 signed out
- [x] `/` **prerenders as static** (`○ /` in the build output) — the page reads no request-time API, so a crawler never waits on a render
- [x] **`<noscript>` rule forcing `[data-reveal]` back to `opacity: 1`.** Motion applies `initial` during SSR, so 41 elements ship hidden; without this the page is blank with JavaScript off. Checked by parsing the served HTML for every element hidden at SSR — all but one carry the hook, and that one is the `aria-hidden` progress bar, which *should* stay hidden when there is no scroll to report
- [x] **Bug caught in review: `Reveal`'s delay was being dropped.** It passed `transition={{ delay }}` alongside a variant that declares its own transition, and the variant's wins. Delays now arrive through `custom`, and `StaggerItem` got its own variant set that names *no* delay — a container's `staggerChildren` schedules children by setting that same field, so declaring it (even as `0`) would land every card at once
- [x] Verified live: scroll spy tracks all five sections in both themes; deep-linking to `#pricing` animates that heading in, and a heading skipped over reveals when scrolled back to rather than staying blank; FAQ accordion opens one at a time; mobile sheet lists all five sections and both CTAs; no horizontal overflow at 375px; `robots.txt`, `sitemap.xml` and the JSON-LD all parse
- [x] `tsc` and lint clean; production build compiles
- [x] **`NEXT_PUBLIC_SITE_URL`** — added to the env files in Phase 58; still needs a real value on the deploy target

## Phase 58 — Landing page edit: contrast hero, no getting-started section

- [x] **"How it works" removed entirely** (`HowItWorks` + its `Step` helper, 141 lines), along with `how-it-works` in `NAV_SECTIONS` — which is also what drops it from the footer nav and the scroll spy, since both map the same array. The hero's secondary CTA pointed at `#how-it-works` and now reads "See what you get" → `#features`
- [x] **The Excel import survived the cut as a seventh feature card**, full-width (`lg:col-span-3`) with the accent border and its three proof points. It answers the objection that actually stops a signup, so losing it with the section would have cost more than the section did. The span also squares the grid — seven cards across three columns would otherwise strand the last one beside two gaps
- [x] **Hero eyebrow pill removed** ("Built in Tanzania · Free while in beta")
- [x] **`hero-preview.tsx` → `hero-contrast.tsx`**: the dashboard illustration is replaced by a before/after. "Today" is a dashed panel of overlapping scraps — a WhatsApp exchange (*Umelipa kodi ya mwezi huu?* / *Nitalipa kesho*), a notebook, a spreadsheet — over "Rent lives in five places, and none of them agree"; below it an arrow, then a clean card reading A3 Paid / B1 Due / C2 Vacant. It argues the need rather than demonstrating the UI, which is the question a visitor has *before* they care what the screens look like
- [x] Scrap rotations are a **fixed hand-picked set, never `Math.random()`** — a random rotation differs between server and client and trips a hydration mismatch
- [x] **The notebook scrap is bottom-anchored, not top-offset.** Measuring the overlap downward put it squarely over the chat reply at 375px, hiding the line the exchange exists for; anchoring to the bottom clips a corner at every width instead. Moved to `left-[38%]` so both messages stay readable — verified at 375px and 1280px
- [x] Section shading rebalanced: `Security` picked up the `border-y bg-card/40` band the removed section carried, and `Pricing` gave its up (its navy slab is already a surface), so the page still alternates plain/shaded rather than running Features into Security as one stretch
- [x] **The contrast graphic is `hidden lg:block`** — user call, and `lg` is the right breakpoint because that is where the hero becomes two columns. Below it the graphic stacked under the copy and pushed the CTAs off the first screen; hidden, the whole hero (headline, subhead, both buttons, the three ticks) fits one 375×812 screen. A CSS `hidden` rather than `useIsMobile`, which reports desktop on the server and would render the graphic then vanish it on hydration
- [x] **`NEXT_PUBLIC_SITE_URL` added to `.env` (`http://localhost:3347`) and `.env.production` (placeholder to fill in)**, closing the open item from Phase 57. Proved it is actually read rather than falling back — the local value is identical to the fallback, so it was set to a probe value and the canonical, `og:url`, `robots.txt` `Sitemap:` line and `sitemap.xml` `<loc>` all followed it, then restored
- [x] **It is inlined at build time, not read at runtime** (`NEXT_PUBLIC_*`), so on Railway it must be a service variable present when `next build` runs — `.env.production` is gitignored and will not be on the deploy target
- [x] Verified: four sections and four nav links remain (`features`, `security`, `pricing`, `faq`), deep link to `#features` lands with the spy pill correct, no horizontal overflow at 375px, `/` still prerenders static, `tsc` and lint clean

## Phase 59 — Revert the big-bang changeset; profile menu + `/profile`

Restarting the payment-accounts / account-settings work incrementally, at the user's request. This phase is steps 1–2 of that: the menu entry, and the page that groups what it will hold.

- [x] **Reverted to `git stash@{0}`, not `checkout`** — 22 modified files plus 9 new paths (`app/(app)/settings/`, the payment-account APIs, `lib/payment-accounts*.ts`, `components/settings/`) are preserved, since the incremental rebuild covers the same ground and the stash is the reference for it
- [x] **Rolled the stashed migration back in Postgres by hand.** `20260817203612_payment_accounts_and_org_profile` was applied to the dev DB, and stashing its folder left the row in `_prisma_migrations` with no file — the drift that makes the next `migrate dev` offer a full `migrate reset`, wiping the dev data. Dropped the two FKs, the index, `PaymentAccount`, the `PaymentAccountType` enum, `Payment.receivedIntoId`/`reference` and the six `Organization` profile columns, then deleted the row. Checked first that the columns held only the reverted work's own test data (2 payment accounts, 1 payment reference, 0 org profiles). `migrate status` → 14 migrations, "Database schema is up to date"
- [x] **The dev server had to be restarted, not just `prisma generate`d** — Turbopack held the pre-revert client and every page 500'd with `Organization.tin does not exist`. Same trap as the 2026-08-02 note; it now has a second occurrence
- [x] **Profile entry in the user menu**, above Sign out and separated from it, in `components/nav-user.tsx`
- [x] `DropdownMenuLinkItem` added to `components/ui/dropdown-menu.tsx` wrapping base-ui's `Menu.LinkItem` — `Menu.Item` renders a `div`, so a link through `render` loses the anchor typing. **`closeOnClick` is overridden to `true`**: it defaults to `false` upstream on the assumption a link unloads the page, which client-side navigation doesn't, so the menu would stay open over `/profile`. Both parts now share `dropdownMenuItemClassName`
- [x] **`findPageTitle` in `lib/nav.ts`** — `/profile` is deliberately not a `navItem` (it would light up a sidebar row that doesn't exist), but `AppHeader` read titles only off `findActiveNavItem`, so it would have shown the bare app name. A `secondaryPageTitles` map resolves first, nav items second
- [x] `lib/profile.ts` — `getProfile(userId, activeOrgId)`, one `Promise.all`. The user and the membership are **separate queries on purpose**: the membership half is conditional on there being an active org, and a conditional `select` collapses Prisma's inferred type back to the bare scalar row (caught by `tsc`, not at runtime)
- [x] `app/(app)/profile/page.tsx` + `components/profile/profile-section.tsx` — four groups, one section wrapper so the icon tile and title/description rhythm are defined once
- [x] **Personal info** (name, phone, email) and **Organization info** (org, your role, owner, joined, created, member and property counts) render live data
- [x] **Account settings** and **Payment accounts** are structured but inert — a `PendingAction` marker rather than disabled buttons, since a button that can never be pressed reads as broken. Both are the next increments; payment accounts needs the model back, delete-account needs its cascade decided
- [x] Verified live: menu item navigates and the menu closes; header reads "Profile"; all four groups render against the real org (7 members, 1 property); dark mode and 375px checked with no horizontal overflow; server log clean (`GET /profile 200`); `tsc` and lint clean

## Phase 60 — Profile page rebuilt to the supplied design; payment accounts

Replicating a reference layout the user supplied, in this app's palette. Increment 3.

- [x] **`migrate dev` had to be abandoned — it offered to reset the whole dev database.** Two migrations from the **`documents` branch** (`attachment_slots`, `attachments`) are in this DB's ledger but have no folder or model on main, which `migrate dev` reads as drift. `migrate status` reports "up to date" and gives no warning. Authored the migration with `migrate diff --from-migrations` + `migrate deploy` instead (the Phase 1 technique) and added `datasource.shadowDatabaseUrl` to `prisma.config.ts`. Confirmed afterwards that all 10 properties / 9 leases / 79 users **and the `documents` branch's 1 attachment row** survived
- [x] Migration `20260818090000_payment_accounts`: `PaymentAccountType` enum (`MOBILE_MONEY | BANK | LIPA`) and `PaymentAccount`, hung off `Membership` — see the decision log for why not `User` or `Organization`
- [x] `lib/payment-accounts.ts` (scoped by `{userId, organizationId}`, never by account id alone), `-schemas.ts`, and `payment-account-options.ts` — the last dependency-free so the client bundle doesn't pull in Prisma, same split as `search-types.ts`
- [x] `GET|POST /api/payment-accounts`, `PATCH|DELETE /api/payment-accounts/[id]` — **404, not 403, for another member's id**, so the response can't be used to probe for account ids
- [x] **Concurrency bug found and fixed mid-test.** Seeding two accounts from one `Promise.all` produced two rows both showing `Default` — the `count === 0` check inside `$transaction` does not serialize at READ COMMITTED, contrary to the comment that was on it. Writes now open with `SELECT … FOR UPDATE` on the parent Membership; update and delete re-read the account inside the lock. Re-tested with **three** concurrent POSTs → exactly one default
- [x] Default handling: the first account is default whether or not it was ticked; deleting the default promotes the next-oldest; the default's own tick is disabled, so it can only be moved by promoting another — a member with accounts always has exactly one
- [x] `POST /api/account/password` + `ChangePasswordDialog` — verifies the current password, rejects a match with the old one, **409s for a passwordless (staff-onboarded) account** rather than letting a session set a first password without proving anything. Session deliberately not rotated; other devices stay signed in, which needs a token version on the JWT
- [x] "Edit profile" and "Change phone number" both reuse `PATCH /api/members/[membershipId]` — it already writes exactly these three fields with the same validation, so a second endpoint would only be a copy that drifts
- [x] Layout matched to the reference: card header with a right-aligned action, two-column field grid, account settings as two outline buttons, payment accounts as a table with type badges and row actions. Colour is ours — `--primary` and the existing `--kind-*` tokens, not the reference's red
- [x] **Fields the schema cannot hold were dropped, not faked**: name stays one field (Phase 29 settled that a first/last split is never persisted), and Address / Gender / Date of Birth are absent pending a schema decision
- [x] Read-only rows are a `<dl>` via `components/profile/profile-field.tsx`, **not disabled inputs** — a disabled control is skipped by keyboard nav and announced as unavailable, which misdescribes a display value
- [x] Removed a redundant `overflow-x-auto` wrapper around `Table` — it ships its own `data-slot="table-container"`, and the outer one was a scroller that could never scroll
- [x] Verified live: created Lipa + mobile-money + bank accounts, default moved correctly on add and on delete, blank account name stored as **NULL not `""`**, delete confirm names the account, empty state renders. Change-password rejected a wrong current password and a mismatch, each on the right field. Dark mode and 375px checked — table scrolls in-container, page does not (592px table in a 343px container). `tsc` and lint clean
- [x] **All test payment accounts deleted afterwards** — a leftover row here is a payment destination a tenant could be told to send rent to
- [ ] **The successful password change is untested** — completing it would have altered the real account's credentials. Both failure paths are verified; the success path is not

## Phase 61 — Profile page edits

- [x] **Organization info: the members / properties / created badges removed.** The two counts belong to the dashboard, not to a page about you
- [x] **"Change phone number" removed.** It opened the same form on the same field, writing the same column through the same endpoint as Edit profile — one control per thing that changes. `EditProfileDialog`'s `focusPhone` prop went with it, since that was its only caller
- [x] **Payment accounts: the Type cell is plain text**, not a badge. `PAYMENT_ACCOUNT_TYPE_BADGE` deleted from `payment-account-options.ts` rather than left as an unused export
- [x] **`components/profile/profile-card-header.tsx` — every card header is now 39px, with or without an action button.** Measured before touching anything: 45px with, 39px without. Two separate causes, and fixing only one leaves 43px
- [x] `-my-1` on the action: `CardHeader` is a grid whose row takes its tallest item, and a `size="sm"` button is 28px against a 22px title line. The negative margin pulls the button's *layout* height under the title's; it still renders and hit-tests at 28px
- [x] `row-span-1` on the action: `CardAction` ships `row-span-2` for the title-plus-description case. With no description that invents an implicit second row and the grid's `gap-1` adds 4px of nothing — the residual 43px
- [x] Deleted `profile-section.tsx`, left unused by the Phase 60 rewrite
- [x] Verified live: all four headers measure 39px in both themes, buttons still 28px, no page overflow at 375px, table still scrolls in-container. `tsc` and lint clean

## Phase 62 — Delete organization

Owner-only, cascading, from Account settings.

- [x] **Checked the FK graph before writing anything.** `pg_constraint` shows every org-rooted FK as `c` (cascade) except `Membership_roleId_fkey` and `Invitation_roleId_fkey`, which are `r` (**restrict**)
- [x] **A plain `DELETE FROM "Organization"` did succeed** in a rolled-back transaction — Postgres happened to clear memberships before roles. That ordering is emergent, not guaranteed, so it is not relied on: `deleteOrganization` deletes memberships, then invitations, then the organization. Verified the ordered version in a rolled-back transaction too (6 memberships, 8 invitations, 1 org; 0 properties and 0 roles left), then confirmed the real data was untouched
- [x] `DELETE /api/organizations/[id]` — 403 for a non-owner, and **404 unless the id is the caller's active organization**, so owning a second org can't turn this into a cross-org destructive write driven by a URL
- [x] The ownership check runs **inside the transaction**, so it can't race a concurrent role change
- [x] `DeleteOrganizationDialog` — type the exact organization name to enable the button. Match is case-sensitive and trims only stray whitespace; a loose match defeats the point of asking. The control is **hidden from non-owners rather than disabled**
- [x] On success: `router.push("/dashboard")`, not `refresh()` alone — every page under the layout is scoped to an organization that no longer exists, and `/dashboard` is the route that handles having none by showing the create prompt
- [x] **Tested against a throwaway org, not the real data**: built one with 2 members, a role pair, member profile, payment account, pending invitation, property, unit, lease, invoice and payment. Non-owner → `not-owner`; unknown org → `not-found`; owner → `ok`, with **all 11 leftover counts 0**. Global counts fell by exactly that org's data, and **`User` rows were unchanged (84 → 84)**, proving members are not collateral. Throwaway users removed; baseline confirmed back at 11 orgs / 10 properties / 9 leases
- [x] Verified in the browser: danger zone renders under a separator with the org name inline, `jack` leaves the button disabled while `Jack` enables it. **Cancelled rather than confirmed** — the real organization was not deleted
- [x] **Follow-up (2026-08-23), user feedback**: removed the count-summary card and the "Other members lose access…" caption from the dialog — both read as unnecessary once the org name itself is the thing you have to type. The button in Account settings now matches Change password's plain `variant="outline" className="bg-card"` styling instead of a red destructive treatment, for consistency with its sibling control
- [x] **Deleted the code the summary card was the only caller of**, rather than leaving it unused: `getOrganizationDeletionSummary` + `OrganizationDeletionSummary` from `lib/organizations.ts`, and the whole `GET /api/organizations/[id]/deletion-summary` route. Confirmed nothing else referenced either (`grep` across the repo) before removing
- [x] Re-verified: dialog now shows only the title, description and confirm input; typing the exact name still enables Delete; `tsc` and lint clean; real data untouched (11 orgs / 10 properties / 9 leases, unchanged)
- [x] **Follow-up (2026-08-23), user feedback**: deleting the organization now **ends the session**, not just the data. `DELETE /api/organizations/[id]` calls `clearSession()` after the delete transaction commits — same cookie-clearing helper `POST /api/auth/logout` uses — so the delete and the sign-out are atomic in one request rather than the client making a second call that could be skipped. The dialog redirects to `/`, not `/dashboard`, mirroring `handleSignOut`'s exact `router.push` + `router.refresh()` pairing from `nav-user.tsx`
- [x] **Noticed and deliberately left alone**: without this, `getCurrentUser()`'s existing Phase-24 fallback (to another membership when the token's org is gone) would have silently dropped someone who just deleted their org into a *different* org's dashboard — technically correct, but doesn't read as "deleted" at all
- [x] **Verified against the real HTTP/cookie mechanics, not just the function**: registered a throwaway owner+org through `POST /api/auth/register` with a curl cookie jar, then `DELETE`d the org through the real route with that same jar. Confirmed: the response's `Set-Cookie` expires the session (`Expires=Thu, 01 Jan 1970…`); the jar drops the cookie; a follow-up `GET /dashboard` with the (now cookie-less) jar **307s to `/login`**; `GET /` with the same jar returns **200 with the actual public landing page** (`<title>Rentoo — Property management…`); the org, its membership and its role rows are all **0** in the DB; the `User` row survives, matching "users are deliberately untouched"
- [x] **Hit the new email-verification gate mid-test** — `requireActiveOrg()` now 403s an unverified account (`needs­EmailVerification`, added by concurrent work elsewhere in this shared dev environment, not by this phase). Verified the throwaway test account directly in the DB to get past it; did not touch the gate itself, since it is somebody else's in-flight feature
- [x] Cleanup scoped to only what this test created: the throwaway `User` row (deleting an org never removes the user), the cookie jar, temp response files. Confirmed via `LIKE 'ZZDelSess%'` that no artifact from either this test or the earlier Phase 62 throwaway-org test remains — did **not** chase the org/user count drift against an earlier turn's baseline, since other concurrent work in this shared environment (the account-settings/password-route files changed on disk mid-session, and the verification feature itself) accounts for it and isn't mine to referee
- [x] `tsc` and lint clean
- [x] `tsc` and lint clean

### Not done
- [ ] **Sticky filters cover the four global list pages only** — per-entity tables (a property's units, a lease's payments, a member's leases) would need an id in the `stateKey` so one entity's filters can't surface on another's.
- [ ] **Leases created before the billing migration have no invoice**, so they can't be paid at all — the Billing tab reads "No invoice exists for this lease yet" and there is no UI to create one. Needs either a backfill script or an "Issue invoice" action on that empty state.
- [ ] Auto-renewal has no scheduler — it only fires when `/leases` or `/dashboard` is loaded after a lease's end date passes. A cron-hit endpoint would close this; `runAutoRenewals` is already written to support it without changes.
- [ ] No dedicated Invoices list page across the org — invoices are only reachable per-lease (Billing tab) or via the Leases table's status column.
- [ ] Search is `contains`-based, so it's substring matching, not ranked full-text. Fine at this size; revisit with Postgres `tsvector` + a GIN index when rows grow.
- [ ] **Roles can be created but not renamed or deleted** — no UI and no `PATCH`/`DELETE /api/roles/[id]`. Deleting needs care: `Role.memberships`/`invitations` have no `onDelete`, so Postgres restricts, and deleting Owner or Tenant would break the guards that match on those names.
- [ ] Permissions are named but not modelled — no `Permission` table, no enforcement. Every signed-in member can still reach every page.
- [x] ~~Stale `activeOrgId` after org deletion showed empty states~~ — fixed in Phase 24: `getCurrentUser()` validates the org claim per request and falls back for layout, pages, and APIs alike
- [ ] Role is not editable — you excluded "change a member's role" when scoping the Users page. Say the word and it's a small addition.
- [ ] `User.phone` is still nullable in the DB — 11 legacy users have none, so NOT NULL would mean inventing numbers. Enforced in every form instead; backfill those rows to tighten the column.
- [ ] **No DB constraint stops a Lease joining a membership in one org to a unit in another.** Queries now filter it out, but the data can still be created. Worth a check constraint or an org column on Lease.
- [ ] Changing a member's role isn't implemented (not requested).
- [ ] Unit amenities are editable/visible in the unit dialog but **not** shown in the units table (chips don't fit) — row expansion would be the fix.
- [ ] Tenants/leases still have no UI; deleting the seed means new orgs have no tenant data.
- [ ] Global search and notifications in the mockup header are not implemented.

## Phase 62 — RabbitMQ, and the section-A (auth) emails

Catalogue of all 38 email scenarios lives in the plan file; this phase builds the
transport and wires **section A only** — the emails addressed to the account holder.

- [x] `docker compose up -d rabbitmq` — `rabbitmq:4-management`, host ports **5682** (AMQP) and **15682** (management UI, guest/guest), shifted off the defaults the same way Postgres sits on 5439
- [x] `npm install amqplib` (v2, ships its own types — `@types/amqplib` is for 0.10 and was removed after npm pulled it in)
- [x] `serverExternalPackages: ["amqplib"]` in `next.config.ts` — it opens raw sockets and isn't on Next's auto-external list
- [x] `lib/mail/config.ts` — the `MailMessage` wire format (`email` / `subject` / `content` / `service_name`, snake_case per the consumer's contract), routing keys, env
- [x] `lib/mail/queue.ts` — one recovering connection per process, confirm channel, `publishMail()` that **never throws**
- [x] `lib/mail/layout.ts` — inline-styled HTML *fragment* shell + `escapeHtml` (names and org names are free text and go straight into markup)
- [x] `lib/mail/auth.ts` — all seven section-A templates
- [x] Wired with `after()` from `next/server`: `auth.user.registered` (register), `auth.password.changed` (account/password), `auth.login.locked_out` (login), `org.created` (organizations)
- [x] **Lockout notices are separately rate-limited** (`LOCKOUT_NOTICE`, 1 per 15 min per identifier). Every request during a lockout is rejected, not just the one that crossed the line — notifying on each would turn the defence into a mail bomb aimed at the victim
- [x] Verified end-to-end against a live broker: all four routing keys arrive on `emails.outbound`, payload keys exactly `["email","subject","content","service_name"]`, `deliveryMode: 2`. Three consecutive 429s produced exactly one lockout email
- [x] Verified with the broker **stopped**: registration still returns 201, and the buffered message was delivered once RabbitMQ came back
- [x] `npx tsc --noEmit`, `npm run lint` and `npm run build` all clean

### Not done
- [x] ~~Three section-A emails unwired~~ — reset landed in Phase 63, verification in Phase 64. **All seven section-A emails now publish**, except `auth.login.new_device`, which was dropped for want of device tracking
- [ ] **`auth.login.new_device` was dropped** — no device or session tracking exists to compare against, so there is nothing to call "new"
- [ ] **No transactional outbox.** `publishMail` runs after the database transaction commits, so a process death in between loses the event. Acceptable for auth mail (nothing downstream depends on it); **not** acceptable for `lease.created`/`invoice.issued`, which are written in one `$transaction` — decide before wiring section C/D
- [ ] **A publish during a broker outage waits on its confirm** inside `after()`, capped only by the route's max duration. Observed to recover cleanly; worth a timeout if outages get long
- [ ] The in-memory limiter backing `LOCKOUT_NOTICE` is per process, so N instances means up to N notices per window — same caveat `lib/rate-limit.ts` already documents
- [ ] Sections B–E of the catalogue (invitations, leases, billing, digests) are unwired. Everything time-based in them still needs the scheduler that auto-renewal is also waiting on
- [ ] `service_name` is `"Jarvis"` (the consumer's contract) while the emails themselves say **Rentops** (`SITE_NAME` in `lib/site.ts`). Deliberate — one is a routing label, one is the product's name — but worth a look if the two should converge

## Phase 63 — Password reset: forgot → code → new password

- [x] Migration `20260820193000_password_reset_tokens` — `PasswordResetToken` (`codeHash`, `expiresAt`, `attempts`, `userId`). Authored with `migrate diff --from-migrations` + `migrate deploy` against a throwaway `jarvis_shadow` database, per the 2026-08-18 decision-log procedure; the generated SQL touched nothing but the new table
- [x] `lib/auth/reset.ts` — `requestPasswordReset` / `verifyResetCode` / `completePasswordReset`. Six-digit CSPRNG code, **bcrypt**-hashed (not SHA-256 — see the decision log), 10-minute TTL, 5 attempts, one live code per user
- [x] `POST /api/auth/forgot-password` — issues and emails the code. **Always answers `{ ok: true }`**, including for unknown accounts, accounts with no password, and accounts with no email
- [x] `POST /api/auth/verify-otp` — checks the code *without spending it* and sets the reset ticket cookie
- [x] `POST /api/auth/reset-password` — authorised by the ticket alone; sets the password, deletes every token for that user, emails the confirmation
- [x] `RESET_TICKET_COOKIE` in `lib/auth/constants.ts`, `signResetTicket`/`verifyResetTicket` in `lib/auth/jwt.ts` (with a `kind: "reset"` claim so a session cookie can't be replayed as a ticket), cookie helpers in `lib/auth/reset-ticket.ts`
- [x] `/forgot-password`, `verify-otp-form.tsx` and `reset-password-form.tsx` now call the endpoints. `ResetPasswordForm` **takes no props** — the identifier and code no longer travel in the URL
- [x] `auth.password.reset_requested` and `auth.password.reset_completed` are live on the queue
- [x] Verified end-to-end with curl and in the browser: full happy path; wrong code rejected; 5 wrong guesses burn the code and the correct one then fails; reset without a ticket 401s; a spent ticket 401s; a used code can't be reverified; old password rejected after reset; unknown identifier returns the same 200 and queues nothing; `/reset-password` URL carries no query string and `document.cookie` is empty (ticket is httpOnly)
- [x] `tsc`, lint and `npm run build` clean; test users and orgs deleted afterwards

### Not done
- [ ] **Existing sessions survive a reset.** Someone who reset their password because it was stolen does not boot the thief — revoking needs a token version on the JWT, the same gap `POST /api/account/password` already documents
- [ ] **A phone-only account can't reset.** Delivery is email-only, so `requestPasswordReset` returns null when `User.email` is null and nothing is sent — the user sees the same "check your messages" screen and no code ever arrives. Honest fix is SMS; interim fix is a distinct message, which would leak whether the account has an email
- [ ] **Expired tokens are only deleted when touched.** A code nobody returns for sits in the table until the next request from that user. Harmless (every read checks `expiresAt`) but it accumulates — a sweep belongs with the scheduler everything else is waiting on
- [ ] The `attempts` counter is per code, so requesting a new one resets it. Bounded by the per-identifier limit on `forgot-password` (3 per 15 min), i.e. at most 15 guesses per quarter hour
- [ ] Reset does not verify the email address — it proves control of the inbox, which is the same evidence, but the account is still formally unverified afterwards

## Phase 64 — Email verification, and the gate behind it

Registration now sends **two** emails — the welcome and a 6-digit code — and a
self-registered account can't use the app until that code is entered.

- [x] Migration `20260821090000_email_verification` — `User.emailVerifiedAt`, `User.emailVerificationRequired` (default **false**), and an `EmailVerificationToken` table
- [x] **Grandfathering needs no backfill**: all 81 existing users keep the `false` default, so nobody was locked out. `emailVerifiedAt` is left null for them rather than stamped with `now()` — they were never verified, they are simply not required to be
- [x] `lib/auth/one-time-code.ts` — the code policy (6 digits, CSPRNG, bcrypt, 5 attempts, shared error messages) extracted from `lib/auth/reset.ts`, which was **refactored onto it** rather than copied. Separate tables per purpose on purpose: one table with a `purpose` column puts an account takeover one forgotten `where` clause away
- [x] `lib/auth/email-verification.ts` — `needsEmailVerification` / `issueEmailVerification` / `confirmEmailVerification`. 30-minute TTL (longer than a reset's 10 — nobody is standing at the keyboard waiting)
- [x] `POST /api/auth/verify-email` and `POST /api/auth/verify-email/resend` (3 per 10 min, keyed on the **account**, since it's a mailbox being flooded, not a network)
- [x] `/verify-email` page in the `(auth)` group — signed-in, outside the app shell, with a **Sign out** escape hatch so a typo'd address isn't a dead end
- [x] The gate bites in two places: `app/(app)/layout.tsx` redirects, and **`requireActiveOrg` returns 403 `email-unverified`** — a gate that only covers pages is theatre, since the API is reachable directly
- [x] `emailVerifiedAt`/`emailVerificationRequired` are read live in `getCurrentUser`, never from the session token — same reasoning already applied to `orgId`
- [x] Verified: registration queues both emails and sets the flag; org API 403s then 200s; wrong code rejected; resend kills the previous code; the gate redirects `/dashboard` → `/verify-email` with no loop; a grandfathered account reaches `/dashboard` untouched
- [x] `tsc`, lint and `npm run build` clean; test users deleted

### Not done
- [ ] **Invited members are never asked to verify** — your call, and it means an invited member's address is unproven. If invites start being *emailed* (section B of the catalogue), accepting one proves the address anyway and the distinction stops mattering
- [ ] **Nothing re-verifies after an email change.** `PATCH /api/members/[membershipId]` and the profile editor can change `User.email` without clearing `emailVerifiedAt` — so a verified account can end up with an unverified address. The fix is one `emailVerifiedAt: null` on any write that changes the column, plus a fresh code
- [ ] **Expired verification tokens are only deleted when touched**, same as reset tokens — a sweep belongs with the scheduler
- [ ] `POST /api/account/password` and the auth routes stay open to unverified users, deliberately: locking them out of their own account controls would leave a typo'd signup with nowhere to go
- [ ] The dev server **must be restarted after `prisma generate`** — the client is cached on `globalThis` across hot reloads, so a regenerated schema doesn't reach a running server. It fails as `Unknown field ... for select statement`, which reads like a code bug and isn't

## Phase 65 — Cherry-picked notifications: lease expiry, paid in full, overdue

Three from sections C and D, and the scheduler two of them needed.

- [x] Migration `20260821110000_notification_log` — `NotificationLog(dedupeKey @unique, type, sentAt, organizationId)`
- [x] `lib/mail/leases.ts` — `lease.expiring`, **two templates**: the landlord is told to decide, the tenant is told what happens if nobody does
- [x] `lib/mail/billing.ts` — `invoice.paid_in_full` and `invoice.overdue`, likewise two audiences each
- [x] `lib/notifications/recipients.ts` — `getOwnerRecipients()` returns **every** Owner, unlike `getOrganizationOwnerName` which picks the oldest to label a property
- [x] `lib/notifications/sweep.ts` — `runNotificationSweep()`, the first thing here that runs across all organizations at once
- [x] `POST /api/cron/notifications`, `Authorization: Bearer $CRON_SECRET`. Refuses to run (503) when the secret is unset rather than running open
- [x] `invoice.paid_in_full` fires from `recordPayment` on the **crossing**, not the state — `balance` is what was owed *before* the payment, so only the one that clears it announces
- [x] Lease expiry uses the same 60/30 boundaries as `leaseExpiry()` in `lib/leases.ts`, so email and UI can't disagree. **Auto-renewing units are excluded**: telling someone to act on what the app is about to do for them is worse than silence
- [x] Overdue chases weekly (`floor(daysLate / 7)` in the key) and **stops after 8 notices**
- [x] Verified against real seed data: 16 emails on the first sweep, correctly split across two organizations; **0 on the second and third runs**; three *concurrent* sweeps produced exactly 16, not 48 — the unique key held the race; a partial payment announced nothing and the settling one announced to tenant and owner; cron 401s without the secret
- [x] `tsc`, lint and `npm run build` clean; test org and log rows deleted

### Not done
- [ ] **Nothing is scheduled yet.** The endpoint exists; something still has to call it hourly (Railway cron, GitHub Actions, `cron` + `curl`). Until then these three send nothing
- [ ] **Auto-renewal still isn't on this hook.** `runAutoRenewals` is already written to be called from a job and this is now the obvious place — it stayed out because it wasn't asked for
- [ ] **`NotificationLog` grows forever.** One row per notice, never pruned. Harmless for a long time, but it is the same "needs a sweep" note the token tables carry
- [ ] Sends are sequential — one `await` per recipient per notice. Fine at this size; a few thousand overdue invoices would want batching
- [ ] Only 3 of the catalogue's 38 are wired. The rest of C and D (`lease.created`, `lease.renewal_failed`, `payment.recorded`, `payment.reversed`, `payment_account.changed`) fire from code paths that already exist and need no scheduler
- [ ] `invoice.overdue` does not re-check whether the tenant paid between the sweep finding it and the email going out. The window is milliseconds and the copy says "if you have already paid, ignore this"

## Phase 66 — `lease.created` and `lease.renewed`

**No schema change** — both events come from code paths that already existed.

- [x] `lib/mail/leases.ts` — four more templates. Owner and tenant differ in what they're *for*: the owner is reading a record of their portfolio, the tenant is reading about the roof over their head. The terms block (`termsLines`) is shared so the two can't state different rent
- [x] **Neither event is emitted from `insertLease`.** It is the shared write for both a manual lease and an auto-renewal and cannot tell them apart, so announcing from inside it would send "new lease" for every renewal too. Each caller announces its own event
- [x] `insertLease` now returns the invoice it raises, so both emails can name it without a second query
- [x] `announceLeaseCreated` / `announceLeaseRenewals` in `lib/leases.ts`, next to `announceInvoiceSettled` in `lib/invoices.ts` — same arrangement
- [x] `runAutoRenewals` returns `renewals[]` instead of emailing directly: it runs at the top of a **page render**, and `publishMail` waits on a broker round trip. The two page call sites put it in `after()`, so an unreachable RabbitMQ delays nothing anyone is looking at
- [x] Verified: creating a lease sends `lease.created` to tenant + owner; **an auto-renewal sends `lease.renewed` and no `lease.created`**, through the same `insertLease`; reloading `/leases` and `/dashboard` re-announces nothing; a lease negotiated at 700k on a unit asking 900k renewed at 700k, and the email says so
- [x] `tsc`, lint and `npm run build` clean; test org deleted

### Not done
- [ ] **`lease.renewed` is only as timely as the renewal it announces** — both wait for someone to load `/leases` or `/dashboard`. Moving `runAutoRenewals` onto `POST /api/cron/notifications` fixes both at once; still not done, still not asked for
- [ ] **A third caller of `runAutoRenewals` would have to remember the `after(...)` line.** The alternative — announcing inside it — was rejected because it would block a page render on the broker
- [ ] **`publishMail` has no timeout.** With RabbitMQ unreachable the publish waits on amqplib's recovery, bounded only by the route's max duration. Harmless everywhere it is currently called (all inside `after()`), and the reason renewals announce from the call site rather than mid-render — but a deadline on the publish would remove the hazard rather than route around it
- [ ] `lease.amended` and `lease.cancelled` (`updateLease`, `deleteLease`) are still unwired, as is `lease.renewal_failed` — the one that tells an owner a unit silently stopped earning

## Phase 67 — `FileAsset`: one table for every stored file, and a bucket to put them in

Schema and infrastructure only. Nothing uploads or reads a file yet — that is the next phase.

- [x] Migration `20260824100000_file_assets` — `FileAsset(objectKey @unique, fileName, fileType, sizeBytes, assetType, organizationId, uploadedById?, + six nullable subject FKs)` and the `FileAssetType` enum
- [x] Authored with **`migrate diff --from-migrations` + `migrate deploy`**, not `migrate dev` — the procedure the 2026-08-18 decision-log entry describes, because the dev database still carries the `documents` branch's two attachment migrations as ledger rows with no folder. Generated to the scratchpad first (an empty folder under `prisma/migrations` makes `--from-migrations` fail), created `jarvis_shadow` for the diff to build in, dropped it afterwards. The generated SQL mentions nothing but `FileAsset`
- [x] `assetType` covers all six subjects. `INVOICE_DOCUMENT`, `PAYMENT_RECEIPT` and `PAYMENT_PROOF` were added to the original list — invoices and payments were named as document owners but had no type, which would have parked two whole entities under `OTHER`
- [x] **`organizationId` is `NOT NULL` on every row**, including org-level ones where all six subject columns are null. It is the tenancy boundary and the first path segment of the object key
- [x] Hand-written `FileAsset_at_most_one_owner` CHECK appended under the generated SQL — `<= 1`, not the `documents` branch's `= 1`, since zero subjects is the organization-level case
- [x] Object keys are `organizations/<orgId>/<scope>/<scopeId>/<id><ext>`, with `<scope>/<scopeId>` replaced by `organization` for org-level rows. The row's cuid is the stored file name so two `scan.pdf` uploads can't collide; the uploaded name lives in `fileName`
- [x] `uploadedBy → Membership` is **`SET NULL`**, the six subjects are **cascade** — removing a member must not take the title deed they uploaded, but deleting a lease should take its agreement
- [x] `deleteOrganization`'s doc comment updated: file assets now cascade with the org, and it says plainly that **the bucket is not touched**
- [x] `docker-compose.yml` gains a healthcheck on `minio` and a **`minio-init`** service that runs `mc mb --ignore-existing local/jarvis-files` and exits, so `docker compose up -d` yields a bucket rather than a `NoSuchBucket` on the first upload
- [x] `.env` STORAGE_* corrected to what compose actually runs (9000, `minioadmin`) — the two had never agreed, and nothing read them yet so nothing had noticed
- [x] **`.env.example` added and un-gitignored** (`!.env.example` under the blanket `.env*`), documenting every variable the code reads, with the two secrets left blank and the command to generate each
- [x] Verified against the dev database: 10 properties / 9 leases / 82 users **and the `documents` branch's 1 attachment row** all survived. In a rolled-back transaction — zero subjects accepted, one accepted, two rejected by the CHECK, a duplicate `objectKey` rejected by the unique index, deleting a `Membership` nulled `uploadedById` while the row survived, deleting a `Lease` took its file assets with it
- [x] `prisma validate`, `prisma generate`, `tsc`, lint and `npm run build` clean

### Not done
- [ ] **Nothing uploads yet.** No `lib/storage.ts`, no S3 client in `package.json`, no route. The four `STORAGE_*` values are read by nothing on `main` — they are staged for the next phase, which is why a wrong endpoint sat in `.env` unnoticed
- [ ] **Deletes orphan objects.** Every subject FK cascades, so the rows go and the bytes stay. An organization delete leaves its whole `organizations/<id>/` prefix behind. Needs either a delete path that calls storage after the transaction commits, or a reaper that lists the bucket and drops keys with no row — the second is the honest one, because the first still loses a race with a crash
- [ ] **Cross-organization is enforced by nobody yet**, since there is no write path to enforce it in. When one exists it must resolve the subject and compare its organization; the database-level alternative is written up in the decision log and needs `organizationId` denormalized onto `Unit`, `Lease`, `Invoice` and `Payment`
- [ ] **`assetType` and the subject column are independent.** Nothing stops a `TITLE_DEED` hanging off an invoice, or a `NIDA` off a property. A CHECK could pair them, but it would need rewriting for every enum value added; a zod schema at the write path is the cheaper place
- [ ] **`sizeBytes` is `Int`** — 2 GB per file. Fine for scans and photos, wrong the day someone uploads video
- [ ] `.env.production` has no `STORAGE_*` block yet. Production is Cloudflare R2 and needs its own four values, none of which exist
- [ ] The `documents` branch's `Attachment` table and `AttachmentKind` enum are **still in the dev database**, still modelled nowhere, still the reason `migrate dev` is unusable here. `FileAsset` replaces what they were for — dropping them (and merging or deleting the branch) is now a real cleanup rather than a hypothetical one

## Phase 68 — Tenant documents: `/api/documents`, and a Documents tab on the member page

The first thing to actually put a file in the bucket. Membership is the only subject wired to a UI; the route already serves all seven.

- [x] `lib/storage.ts` — `putObject` / `getObjectStream` / `deleteObject` over `@aws-sdk/client-s3`, one client on `globalThis` for the same reason `lib/prisma.ts` keeps one. `forcePathStyle` because MinIO serves buckets as a path, `region: "auto"` because R2 ignores it and the SDK insists
- [x] `StorageNotConfiguredError` names the *individual* missing `STORAGE_*` variables and becomes a **503**, not a 500 — the request would succeed unchanged once the deploy is fixed
- [x] `lib/document-options.ts` — the MIME allowlist, the 10 MB cap, `ASSET_TYPE_LABELS`, and `SUBJECT_FOR_ASSET_TYPE`. A plain constants module like `lib/property-options.ts`, so the upload dialog can import it without dragging the server in
- [x] `lib/documents-schemas.ts` — `z.enum(FileAssetType)` reads the generated Prisma enum rather than re-listing seventeen strings, and a `superRefine` rejects a type filed under the wrong subject
- [x] `lib/documents.ts` — the single door. `buildObjectKey`, `createDocument`, `listDocuments`, `getDocument`, `deleteDocument`
- [x] `POST /api/documents` does the five steps in order: **authenticate** (`requireActiveOrg`), **validate the file** (size from the header, then from the bytes that actually arrived; MIME against the allowlist), **build the key**, **upload**, **write the row** — with the cross-organization check before any of it
- [x] `GET /api/documents?subjectType=&subjectId=` lists; `GET /api/documents/[id]` streams the bytes back with `Content-Disposition: inline`, `?download` for `attachment`; `DELETE /api/documents/[id]` removes both
- [x] Reads are **streamed through the route**, so the bucket stays private and every read passes the same organization check as every other route. `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff` on the way out
- [x] `getDocument` filters on `id` **and** `organizationId` in one query — never `findUnique` then an `if`, which is the check someone eventually forgets
- [x] **Documents tab** on `/members/[membershipId]`, beside Overview and Lease, with a count in the trigger. Every member gets one, tenant or not — a caretaker's contract is as much a record as a tenant's NIDA
- [x] `DocumentUploadDialog` is generic over the subject, so a lease or a property tab is props rather than a second dialog. Its type dropdown is **derived** from `SUBJECT_FOR_ASSET_TYPE`, so a new membership-scoped type appears by existing
- [x] Client-side size and type checks are a courtesy — they save a round trip; the route re-runs both on what arrives, which is where they count
- [x] Verified end-to-end over real HTTP against a real MinIO: PDF and PNG uploaded (201), keys landed as `organizations/<org>/members/<membership>/<uuid>.pdf` with `membershipId` set and every other subject column null, the object present in the bucket, download **byte-identical** to what went up, `?download` flipping the disposition, list newest-first, delete removing row *and* object, second delete 404
- [x] Every rejection verified, and **none of them wrote anything**: `image/svg+xml` 415, `TITLE_DEED` on a membership 400, a membership from another organization 404, a missing `subjectId` 400, 11 MB 413, no session 401 — and another organization's session reading the document by id gets **404**, not 403
- [x] Verified in the browser: upload through the dialog, toast, list and tab count refreshing, delete behind a confirm. No console errors
- [x] `tsc`, lint and `npm run build` clean

### The list, second pass

- [x] **The card header is gone.** The tab it sits in is already called Documents; a heading repeating the word only pushed the first row further down. The upload button takes the toolbar row instead, where `MemberLeasesTab` puts "Create lease" on the tab beside this one
- [x] A real table with headers — **File name · Type · Date added · Uploaded by · Actions** — using the `Table` primitives directly rather than `DataTable`. Search, pagination and column visibility are not worth their weight on a list that is usually three rows, and the four columns are fixed
- [x] `DocumentViewerDialog` — **View opens the file in the app**, not a new tab. `<iframe>` for PDFs, `<img>` for images, from the same `GET /api/documents/[id]` the download link uses: it already answers `Content-Disposition: inline`, so there is no blob URL and nothing held in memory, and closing the dialog unmounts the frame rather than leaving a PDF viewer running behind it
- [x] The **file name opens the viewer too** — a row actionable only from a 28px icon at the far right reads as inert
- [x] The dialog's height is **definite** (`h-[85svh]`), not a max: `max-h-full` on the image resolves against nothing in an auto-height flex column, and a 600×600 test image spilled past the frame until it did. Verified before and after
- [x] `loadedId`, not a `loaded` boolean — reopening the viewer on a *different* file would otherwise inherit the last one's state and skip the spinner
- [x] Verified: PDF frames and returns 200 for the right key, image renders fully contained, name and eye icon both open it, Escape and Close dismiss it. On mobile the table scrolls inside its own `overflow-x: auto` container and **the page body does not** — the rule the codebase already holds itself to

### Feedback pass — caption, action colour, duplicates

- [x] **The upload dialog's caption is gone.** "Kept against X and visible to this organization only" repeated what the tab and the org boundary already say; `DocumentUploadDialog`'s `description` is now optional and the `DialogDescription` simply doesn't render without one
- [x] **Delete is red at rest**, not just on hover — `text-destructive hover:bg-destructive/10 hover:text-destructive` on `size="icon-sm"`, matching `PaymentAccountsCard`'s row actions exactly rather than inventing a second convention
- [x] **One document per (subject, type) for anything that isn't a declared collection.** `lib/document-options.ts` gains `allowsMultiple()` — true for `PROPERTY_PHOTO`, `LEASE_AMENDMENT`, `LEASE_RENEWAL`, permits, business and unit documents, and the two catch-alls (`OTHER`, `TENANT_DOCUMENT`); false for everything with a definite article, `NIDA`, *the* signed agreement, *the* invoice. `createDocument` checks before the upload and returns `duplicate-asset-type`; the route turns that into **409**, naming the file already on record
- [x] The upload dialog's type dropdown **disables** an already-taken type rather than hiding it — "NIDA · On file", same as a disabled `RowAction` elsewhere in the app — and the initial selection skips straight past it
- [x] Verified over HTTP: a second NIDA upload for the same member 409s and writes nothing; `TENANT_DOCUMENT` (a declared collection) accepts a second upload without complaint. Verified in the browser: the dropdown opens on Passport, not NIDA, with NIDA shown and greyed
- [x] `tsc`, lint and `npm run build` clean

### Not done
- [ ] **The duplicate check is a read then a write, not one atomic operation.** Two uploads of the same type landing in the same instant could both pass the check before either inserts — no unique index backs it, because one would need to be a partial index over a `COALESCE` of six nullable subject columns, keyed on which types are restricted, which is more migration than this pass earned. Uploads are not concurrent enough per subject for this to matter in practice, but it is not actually impossible
- [ ] **Mobile pushes the actions off-screen.** The table scrolls sideways to reach View/Download/Delete — same as `payment-accounts-card.tsx`, so it is at least a familiar behaviour, and tapping the file name still opens the viewer without any scrolling. A sticky right-hand actions column, or the card treatment Phases 46–47 gave every other table, would both fix it properly
- [ ] **The viewer is whatever the browser does with the file.** No zoom, no page controls, no rotation — a PDF gets Chrome's built-in viewer and an image gets `object-contain`. Fine for checking a NIDA card; not a document reader
- [ ] **Only membership has a UI.** The route serves organization, property, unit, lease, invoice and payment already — nothing renders them. A lease's signed agreement is the obvious next tab and needs no new API
- [ ] **Orphaned objects are still orphaned.** The Phase 67 note stands: cascade deletes take rows and leave bytes, and an organization delete leaves its whole prefix. `deleteDocument` is the only path that removes both, and only when called directly
- [ ] **No virus scanning, and the MIME type is the client's word.** The allowlist checks what the browser *claims*; nothing reads the magic bytes, so a PDF-labelled executable is stored as a PDF. `nosniff` and the fixed extension mean a browser will not run it — but a person downloading it is on their own
- [ ] **10 MB, buffered in the route handler.** A phone photo is fine, a video is not. The fix is a presigned upload, which also removes this process from the byte path entirely
- [ ] **No permission model.** Any member of the organization can upload, read and delete any document in it — a tenant could read another tenant's passport if they had the membership id. This is the same shape as the rest of the app today (roles exist; nothing enforces them), but documents are where it starts to matter
- [ ] `uploadedById` is null when the uploader has no `Membership` in the organization, which cannot happen through the UI but is not impossible through the API — it is `SET NULL` anyway, so the row is fine
- [ ] Nothing is paginated. A member with two hundred documents renders two hundred rows

## Phase 69 — Property documents: photos in a carousel, papers in the table, unit photos from the row

Everything the tenant documents tab already did, applied to properties and units — deliberately as *the same* components rather than a second set.

- [x] Migration `20260825090000_unit_photo` — one `ALTER TYPE ... ADD VALUE 'UNIT_PHOTO'`, authored with the usual `migrate diff --from-migrations` + `migrate deploy`. A unit's photos are the same kind of thing as a property's, and the pairing map allows one subject per type, so squeezing them into `UNIT_DOCUMENT` beside floor plans would have made "show me the photos" a guess
- [x] **Photo types accept images only.** `acceptedTypesFor()` narrows the allowlist for `PROPERTY_PHOTO` and `UNIT_PHOTO` — a PDF filed as a photo would sit in a carousel that cannot draw it. Same table feeds the route's 415 and the dialog's `accept`, so they cannot drift
- [x] `PhotoUploadDialog` — **multi-file**, thumbnails to review before sending, per-file status, one summary toast. A separate dialog rather than a flag on `DocumentUploadDialog`, because nothing about the interaction survives the change: no type to choose, `multiple` input, a grid instead of one file name, and a per-file result where some can fail
- [x] Uploads run **one at a time**: ten phone photos at 10 MB each would otherwise open ten concurrent requests that each buffer a body in a route handler. The visible cost is a tile settling at a time, which is the progress `ImportDialog` already trained people to read
- [x] `PhotoGallery` — shadcn `carousel` (embla), arrows, a counter, a thumbnail strip, delete and full-size view per slide. A carousel not a grid: these are looked *at* one at a time, and a wall of thumbnails is a file manager, which the documents table already is
- [x] **`DocumentsPanel` extracted** from the old `MemberDocumentsTab` and moved to `components/documents/` with the two dialogs. Tenants, properties and later leases now render one table, not three that drift. `member-documents-tab.tsx` is gone; the member page calls the panel directly
- [x] Property **Documents tab** — photos above papers (a title deed is filed and forgotten; the pictures are what people open the tab for). `PROPERTY_DOCUMENT_TYPES` excludes the photo type, so the table's dropdown never offers a route that drops a file into the carousel instead
- [x] Units get an **`ImagePlusIcon` row action**, since a unit has no page of its own — it slots into the existing `RowAction[]` beside view/edit/delete, so desktop icons and the mobile sheet both pick it up for free
- [x] Unit photos are **visible**, not just uploadable: a strip at the top of `UnitViewDialog` with its own "Add photos" button, loaded with the units in `getProperty` rather than fetched per row. Opening the picker closes the viewer so the two never stack
- [x] `revalidatePath` generalised past `/members` — property and unit uploads, and every delete, now evict the segment they came from
- [x] **`shadcn add carousel` silently reverted `components/ui/button.tsx`**, wiping the deliberate hover-shadow variants this codebase documents in comments. Caught in review and restored; only `carousel.tsx` and the `embla-carousel-react` dependency were kept
- [x] Two `react-hooks/set-state-in-effect` **errors** (not warnings) came in with the carousel. `PhotoGallery`'s was removed outright — `current` and the carousel both start at 0, so the subscription alone is enough. `carousel.tsx`'s is suppressed with a comment: Embla emits `init`, not `reInit`, so dropping it ships arrows that look broken until first interaction
- [x] Verified over HTTP: a PDF as `PROPERTY_PHOTO` 415s while the same PDF as `TITLE_DEED` 201s; four property photos accepted (multiple allowed); `UNIT_PHOTO` on a property 400s on the pairing rule; a second title deed 409s. Verified in the browser: carousel arrows, thumbnail jumps keeping counter/filename/highlight in sync, the documents table below holding only the deed, the unit row action, the unit strip going 2 → 4 after an upload, a PDF rejected by name inside the multi-picker
- [x] `tsc`, lint (0 errors) and `npm run build` clean; all nine test uploads deleted afterwards

### Not done
- [ ] **The dev server must be restarted after this migration**, and that cost a debugging cycle here: `UNIT_PHOTO` 500'd against the running server while both the database and the generated client already had it. The Prisma client is cached on `globalThis` across hot reloads — the same note Phase 64 records, now with a second scar
- [ ] **No reordering, and no cover photo.** The carousel shows photos oldest-first, and nothing marks one as the image to represent the property in a list. Both want a column
- [ ] **Photos are served full-size into a 64px thumbnail.** The strip and the carousel request the same object, so a page with twenty 5 MB photos downloads 100 MB. Wants either stored derivatives at upload time or an image-resizing route
- [ ] `PhotoUploadDialog` has no per-file retry — a failed tile keeps its message but "Upload" re-sends every non-done file rather than just that one
- [ ] The unit strip opens photos in a new tab rather than the in-app viewer, because `UnitViewDialog` is already a dialog and stacking a second one on it reads badly. A gallery inside that dialog would be better than either
- [ ] Unit photos still cannot be **deleted** from the UI — only property photos can. The route supports it; the strip has no affordance

## Phase 70 — `FileAssetType` becomes a table; property Images gets its own tab

The enum had grown three times in two days. It stops being an enum.

- [x] Migration `20260825120000_file_asset_types`, **hand-written**: `migrate diff` produces the right shape in the wrong order — drop `assetType`, add a `NOT NULL assetTypeId`, nothing in between — which fails on the first existing row and would lose every file's type if it didn't. The order here is seed → backfill → enforce → drop, so no row is ever without a type
- [x] The old enum and the new table want the same name and Postgres will not hold both, so the enum is **renamed out of the way** and dropped at the end once nothing refers to it
- [x] The seventeen enum values are **seeded as system rows** with a null `organizationId`, ids `sys_<KEY>` so the same type has the same id in every environment. `allowsMultiple` and `isPhoto` carry over exactly what `lib/document-options.ts` used to assert in code
- [x] A `DO $$` block **fails the migration loudly** if the backfill misses a row, rather than letting it surface as a NOT NULL violation naming nothing
- [x] `FileAsset.assetTypeId` is **`ON DELETE RESTRICT`** — deleting a type files still point at must fail, not take the files with it. Verified against the live database
- [x] **The grouping is `subject`, and it is never asked for.** A type is created from a surface that already knows what it is attached to, so the client posts the group it is standing in. Verified three ways: added from a lease → `LEASE`, from the property Documents tab → `PROPERTY`, from the property Images tab → `PROPERTY` **and `isPhoto: true`**
- [x] `FileAssetSubject` stays an enum where the type list did not: the set of things a file can hang off is the set of foreign keys on `FileAsset`, so it cannot grow without a migration anyway
- [x] **Custom types are per organization.** Null `organizationId` means system and shared; anything else belongs to one tenancy. Verified: another organization neither sees a custom type in its list nor can upload with its id (404)
- [x] A **partial unique index** on `key WHERE "organizationId" IS NULL` — Postgres treats NULLs as distinct, so the composite unique alone would let two system rows share a key. Prisma cannot express it, so it is hand-written
- [x] `toAssetTypeKey` collapses punctuation and case, so "Inspection report" and "inspection-report" are the same type rather than two dropdown entries reading alike. A collision with a *system* key 409s naming the group it already lives under, since it is usually a different one
- [x] **`AssetTypeSelect`** — the dropdown with "Add a type…" inside it, because a list you can extend only helps if extending it is available at the moment you find it lacking. Not a `SelectItem`: choosing one would set the field to a sentinel value, and a type called `__add__` is one forgotten guard from reaching the API
- [x] The photo picker **always renders its type dropdown**, even with a single option. It looks inert until opened — but hiding it on the common case would put the only way to add a photo type behind already having two
- [x] Property **Images and Documents are separate tabs**. Photos are browsed and papers are filed; stacked, the table started below the fold on any property with pictures
- [x] `isPhoto` is a column, so a *custom* photo type lands in the Images tab, gets the narrow image-only allowlist, and shows in a unit's photo strip without anything in code naming it
- [x] Verified over HTTP: types listed per group with photo types flagged; unknown subject 400; custom type created, duplicate 409, system-key shadow 409; upload by type id 201; PDF as a photo type 415; a lease type filed on a property 400; second title deed 409; cross-organization type 404
- [x] Verified in the browser: four property tabs with correct counts, Images holding only photos and Documents only papers, "Title deed · On file" greyed, the inline add creating and selecting a type in place with a toast, no console errors
- [x] Both pre-existing `FileAsset` rows kept their NIDA type through the migration; `tsc`, lint (0 errors) and `npm run build` clean; every test upload and custom type deleted afterwards

### Not done
- [ ] **Types cannot be renamed, deleted or hidden from the UI.** Adding is the only operation. A typo'd type is permanent, and an organization that stops using one still sees it in the dropdown forever — `RESTRICT` means deleting one in use has to fail anyway, so this wants a "retired" flag rather than a delete
- [ ] **`allowsMultiple` is never asked and always true for custom types.** Someone who wants "one of these per lease" cannot say so
- [ ] **`OTHER` moved under `ORGANIZATION`.** Under the enum it was filed anywhere; a type now declares one subject. Nothing used it, and "add a type" is the better escape hatch — but it is a behaviour change, not a refactor
- [ ] The dev server **must be restarted after this migration** — the same stale-`globalThis`-client trap as Phase 64 and 69
- [ ] Seeding lives only in the migration. A new *system* type means another migration; there is no idempotent seed script the way a `prisma/seed.ts` would give
- [ ] `resolveAssetType` runs twice per upload — once in the route to name what a wrong MIME should have been, once in `createDocument` as the authority. Cheap and indexed, but it is two queries where one would do

## Phase 71 — Feedback pass: quieter Images tab, prefilled photo type, an "allow multiple" checkbox, zero-count tabs

- [x] **The "Photos 2" header is gone** from the Images tab. The tab trigger already carries the count; the card now sits directly under the tab strip with only the "Add photos" button, matching the toolbar-only pattern `DocumentsPanel` already uses
- [x] **The photo upload dialog no longer offers a type picker.** Every subject has exactly one photo type today, so the field shows it — disabled, unclickable, no chevron — rather than a dropdown of one option with an "Add a type…" escape hatch that led nowhere useful yet
- [x] **Photos always allow multiple, enforced where it counts.** `createDocument`'s duplicate check is now `!assetType.allowsMultiple && !assetType.isPhoto` — a belt under the belt `lib/asset-types.ts` already had (`isPhoto` forces `allowsMultiple: true` at creation). A gallery that refuses a second photo is a bug, not a setting, so it is guarded twice
- [x] **The add-a-type caption is gone**, replaced with an **"Allow multiple of this type" checkbox**, default unchecked. Most invented types name one specific document ("Fire safety certificate"); a 409 on the second upload is a smaller cost than an unbounded pile nobody meant to allow. The checkbox is hidden for photo types — asking a question with a server-enforced fixed answer is worse than not asking
- [x] **Tab counts hide at zero**, matching the convention the Billing and Users tabs already established (`{count > 0 && <span>…</span>}`, "a 0 beside a tab reads as a problem rather than a total"). Applied to Units, Images and Documents on the property page, Lease and Documents on the member page
- [x] Verified over HTTP: checkbox omitted → `allowsMultiple: false`; checkbox checked → `true`; `isPhoto: true` with `allowsMultiple: false` sent anyway → stored as `true` regardless; a singular custom type still 409s on a second upload; a photo type with `allowsMultiple` forced true still accepts two uploads
- [x] Verified in the browser: Images tab shows no redundant heading; the photo dialog's type field is inert to a click; the checkbox reads `aria-checked` correctly and its state reaches the database (`MAINTENANCE_RECORD` type created with `allowsMultiple: true`); Documents tab hides its badge at zero documents while Units and Images keep theirs; no console errors
- [x] `tsc`, lint (0 errors) and `npm run build` clean; every test upload and custom type deleted afterwards

### Not done
- [ ] **No UI ever offers a custom *photo* type again** — the only way to add one now is the API directly (`isPhoto: true` in the request body). Removing the picker from `PhotoUploadDialog` closed a real gap (asking for a group nobody wanted to name) but also closed the one place a photo-type addition could happen. If an organization needs a second photo category — floor plan renders, before/after shots — nothing in the UI gets them there
- [ ] The dev server needed no restart this time — no migration in this phase — but the note stands for next time a `FileAssetType` column changes

## Phase 72 — Profile photos: seeded type, circular crop, replace-on-upload

- [x] Migration `20260825140000_profile_photo_type` seeds `PROFILE_PHOTO` (`sys_PROFILE_PHOTO`) — subject `MEMBERSHIP`, `isPhoto: true`, `allowsMultiple: false`. **Nothing configures it**: it exists the moment the migration runs, in every organization, which is the whole ask — "should always be seeded initially, no need for one to add its type"
- [x] `components/documents/profile-photo-avatar.tsx` — the member header's avatar now shows the real photo when one exists (via `AvatarImage`, base-ui's own Avatar already falls back to initials on no `src` or a load error) and a small `+` badge that opens the picker. The badge relabels itself "Change profile photo" once one exists, same affordance either way
- [x] `components/documents/photo-crop-dialog.tsx` — the circular resize mechanism asked for. Drag to pan, a slider to zoom (re-anchored on the frame's centre, not a corner), exported to a fixed 512×512 JPEG via canvas. No cropping library: the whole feature is a pointer-drag handler, a `<input type=range>`, and one `drawImage` call
- [x] **Uploading replaces, not adds.** `PROFILE_PHOTO` disallows multiple, so the component deletes the existing row before uploading the new one rather than surfacing the resulting 409. Verified: exactly one `PROFILE_PHOTO` row survives a replace, in both a raw API sequence and through the actual dialog
- [x] The member page splits its `FileAsset` query the same way the property page splits Images from Documents: `assets.filter(isPhoto)` is the profile photo, everything else is "documents". The Documents tab's badge, empty state and type dropdown all exclude it — verified in the browser, dropdown shows only Employment document / NIDA / Other tenant document / Passport
- [x] **Found and fixed a real bug while wiring this up**: `createDocument`'s duplicate check had `!assetType.allowsMultiple && !assetType.isPhoto`, added in Phase 71 on the assumption every photo type is a gallery. `PROFILE_PHOTO` broke that assumption — the check let a second profile photo upload through with no delete. Fixed to `!assetType.allowsMultiple` alone, trusting the column (already correctly seeded per type) rather than special-casing `isPhoto`. Confirmed the fix doesn't regress property/unit photo galleries, which still accept multiple
- [x] Same fix applied to `createAssetType`'s creation-time default, which had forced `allowsMultiple: true` whenever `isPhoto: true`. `allowsMultiple` and `isPhoto` are independent now, documented as such
- [x] Verified over HTTP: `PROFILE_PHOTO` appears in `GET /api/asset-types?subject=MEMBERSHIP`; upload by its seeded id succeeds; a second upload without deleting 409s; delete-then-upload leaves exactly one row; property photos (`allowsMultiple: true`) still accept a second upload unchanged
- [x] Verified in the browser: initials replaced by the actual photo on load; the badge opens the crop dialog; drag panning and zoom-slider math both confirmed via the rendered `<img>` transform (a vertical drag correctly clamped to zero when the image's height already matched the frame exactly); Save re-encodes to a smaller JPEG and updates the avatar; Cancel leaves the existing photo untouched; the general "Upload document" dropdown never offers "Profile photo"
- [x] `tsc`, lint (0 errors) and `npm run build` clean; every test upload deleted afterwards, pre-existing rows in other organizations confirmed untouched

### Not done
- [ ] **Only the member detail page's avatar is wired up.** Table-based avatars (`PersonCell`, used by the Tenants and Users tables) still show initials only — extending them means a photo lookup per row, which is a real N+1 this pass didn't take on. Scoped deliberately: the ask named the one place initials are shown large enough for a plus icon to make sense
- [ ] **No "remove photo" affordance.** The badge only ever opens the picker; there's no way to delete a profile photo and fall back to initials without picking a replacement
- [ ] The crop export is always a JPEG at fixed quality (0.92) and fixed size (512×512) — no say in either, which is fine for an avatar but worth knowing if this pattern gets reused for something that wants more control
- [ ] The dev server needed a restart again for the new seed row — same stale-`globalThis`-client note as every migration this week

## Phase 73 — Crop dialog shows the cropped-away part (blurred), profile page gets the same avatar

- [x] **`PhotoCropDialog` no longer clips to a circle at the container level.** The frame is square now, and the same image renders twice, stacked: a back copy fills the whole square (`blur-md brightness-[0.45]`, scaled 110% so the blur has margin to bleed into rather than leaving a hairline unblurred edge), a front copy is the same pixels sharp, clipped to a circle by an inner `overflow-hidden` wrapper. Both read the same `offset`/`scale` state, so panning and zooming move them together — verified via `getComputedStyle` on both `<img>`s mid-interaction, only the back one carries the blur/dim filter
- [x] `ProfilePhotoAvatar.membershipId` is now `string | null` — the profile page (`/profile`) can be viewed by an account with no organization and therefore no `Membership`, which is where a photo would hang off. The avatar still renders (initials), just without the edit badge; `editable` is the single derived flag both the badge and the input key off
- [x] **`app/(app)/profile/page.tsx` uses `ProfilePhotoAvatar`** in place of the plain initials-only `Avatar` it had — same split as the member page: fetch `listDocuments`/`listAssetTypes` for `MEMBERSHIP` when a membership exists, find the `isPhoto` row for the photo and its type id, skip the fetch entirely when there's no membership to fetch for
- [x] Verified in the browser: the profile page's badge reads "Add a profile photo" (this account has none yet); opening the picker with a generated checkerboard test image (built in-browser via canvas — no file needed) shows the corners blurred and dimmed around a sharp circular centre, confirmed both visually and via `filter: blur(12px) brightness(0.45)` on the back image and `filter: none` on the front; Cancel uploads nothing (row count unchanged); the member detail page, unaffected by the nullable-prop change, still renders a plain initials avatar for a member with no photo
- [x] `tsc`, lint (0 errors) and `npm run build` clean; no test rows left in the working organization afterwards

### Not done
- [ ] Same gaps as Phase 72, still open: no "remove photo" affordance, table avatars (`PersonCell`) still initials-only, fixed JPEG quality and 512×512 output with no way to ask for anything else

## Phase 74 — Profile photos everywhere a member's initials showed

Every avatar in the app that fell back to initials now shows the real photo when one is on file. Nine files, one new batched lookup.

- [x] `lib/documents.ts` gains `getProfilePhotoIds(organizationId, membershipIds[])` — one query for a whole table or panel, not one per row. Returns a `Map`; a membership with no photo simply has no entry, which every caller reads as `?? null`
- [x] **`PersonCell`** (shared by every table and card that names a person) takes an optional `photoId` and renders `AvatarImage` when present, `AvatarFallback` (initials) otherwise — base-ui's own Avatar handles the fallback, so this is one conditional line
- [x] **The sidebar's menu button** (`NavUser`) — the "menu button" named directly. `app/(app)/layout.tsx` runs on every page, so it uses the lean single-row lookup rather than the fuller `listDocuments`/`listAssetTypes` pair the profile and member pages need for their upload dropdowns
- [x] **Every data table wired through**: `getTenants`, `getMembers`, `getLeases`, `getPayments` each batch-fetch photo ids for their rows in one extra query and attach `photoId` to the row type. Consumers updated: `tenant-columns.tsx`, `tenant-card.tsx`, `users-view.tsx`, `member-card.tsx`, `lease-columns.tsx`, `payment-columns.tsx`
- [x] **Dashboard panels** — `RenewalsPanel`, `MoveInsPanel`, `NeedsInvitePanel` all reach a member via a lease or a membership already loaded for the tenant's *name*, so `membership.id` (added to the shared `tenantTitle` select) cost nothing extra to also select. One combined `getProfilePhotoIds` call covers all three panels' membership ids at once, computed right before the final `return` in `getDashboardPanels`
- [x] **Left as initials, deliberately**: the invitation row in `users-view.tsx` (`invitationLabel(...)`, no `photoId` passed) — a pending invitation has no `Membership` yet, so there is nothing to look a photo up against. `LeaseCard`/`PaymentCard` (the mobile card views for leases and payments) don't render an avatar at all, `PersonCell` or otherwise, so there was nothing to change there
- [x] Verified end to end: uploaded a photo for the signed-in owner and for one tenant, confirmed both rendered in the Tenants table, the Users table, the sidebar dropdown, and — the one that exercises the dashboard wiring specifically — the "Upcoming move-ins" panel, sitting beside a tenant with no photo who still showed plain initials in "Renewals due" on the same page. Confirmed via `getBoundingClientRect` that exactly two `<img src="/api/documents/...">` tags existed on the dashboard page, matching the two uploads
- [x] `tsc`, lint (0 errors) and `npm run build` clean; both test uploads deleted afterwards

### Not done
- [ ] No batched N+1 audit beyond what was touched — if another table renders a person by name in the future, it needs to remember to also fetch and pass `photoId`; nothing enforces that a new caller of `PersonCell` does
- [ ] `getProfilePhotoIds` is called once per list-producing function today. A page that renders more than one such list (there are none currently) would issue the query twice rather than sharing one batch across both

## Phase 75 — Settings menu, and lease templates that fill themselves in from a lease

A `Settings` group in the sidebar with `Lease templates` under it: contract wording written once, reused for every lease.

- [x] **The sidebar grows a submenu.** `NavItem` gains `items?`, `findActiveNavItem` matches a parent through its children, and a new `findActiveSubItem` gives the header the *child's* title ("Lease templates", not "Settings"). Settings owns no page — `/settings` only redirects to its first child, so the parent is a disclosure button, not a link that immediately bounces
- [x] Collapsed to icons, a click on Settings **expands the sidebar first** rather than doing nothing: `SidebarMenuSub` is `group-data-[collapsible=icon]:hidden`, so a plain toggle there is invisible. One interaction, true in both states
- [x] **`components/ui/sidebar.tsx` fixed, not worked around**: `SidebarMenuSubButton` paired `bg-sidebar-accent` (mid blue) with `text-sidebar-accent-foreground` (gold), which rendered an active sub-item as a gold label on a blue pill. Nothing had a submenu until now, so it had never been seen. Now uses the same `primary`/`accent` pairing as `SidebarMenuButton`, and lets its icon inherit rather than forcing the gold
- [x] Migration `20260826110000_lease_templates` — `LeaseTemplate` (org-scoped, `@@unique([organizationId, name])`) plus `MemberProfile.nationality`, which existed nowhere and is named on a contract beside the NIDA number. Purely additive, so `migrate diff --from-migrations` produced it whole; only the partial index is hand-written
- [x] A **partial unique index** `ON ("organizationId") WHERE "isDefault"`. `lib/lease-templates.ts` clears the flag on siblings inside the same transaction as every write, but two concurrent writes would each pass that check and both land. Prisma cannot express it, so it is written under the generated SQL. Verified: a direct `UPDATE` making a second row the default is rejected by name
- [x] **`lib/lease-placeholders.ts` is the single source of truth** — 27 tokens, each with a label, a group, an example, and a `resolve`. Free of Prisma, so the editor's panel imports the same list the server resolves against: a token offered in the UI cannot be a token nothing fills
- [x] **`{{token}}`, and a missing value is a blank fill line**, not an empty string — a contract with a gap in it reads as a form to complete. `renderLeaseTemplate` returns `missing` (known tokens with no data) and `unknown` (typos), so both are reportable rather than silent. An unrecognised token is left **visible** in the output, since blanking it hides the mistake until after signing
- [x] `buildLeaseContext(organizationId, leaseId)` reads the lease, its tenant's `Membership`+`MemberProfile`, the unit, the property and the Owner-role member. `lib/organizations.ts` gains **`getOrganizationOwner`** (the person, with phone and email) and `getOrganizationOwnerName` now reads through it — same `cache()`, so the two together are still one query
- [x] `GET /api/leases/[id]/contract` — the other half of the feature, and what proves the placeholders are real. `?templateId=` picks one, omitted uses the default, `?format=html` returns the document. Verified against a live lease: `L-ZVM9T`, `Chris patt`, `Jackson Mayunga`, `C2`, `Java`, `TZS 600,000`, with the seven fields that organization has never filled coming back in `missing`
- [x] **Two starter contracts** (`lib/lease-template-starters.ts`), English and Swahili, ~10 clauses each. An empty HTML box and a list of tokens is a format, not a contract. Changing the language swaps the starter — but **only while the body is still an unedited starter**, because replacing someone's work because a dropdown moved would be the worst bug this page could have. Verified: typing one character into the body makes the swap stop happening
- [x] The **preview is a `sandbox=""` iframe**, in two modes: *Sample data* (example values, each highlighted) and *Placeholders* (token names highlighted in place). The second is the paper view of the template itself; the first answers "does this read like a contract". The sandbox is also what keeps a template's page-wide CSS out of the app around it
- [x] **The body is sanitized server-side as well**, because the iframe is a guarantee only where there is an iframe. Verified end to end: `<script>`, `<iframe>`, `onclick`, `onerror`, `href="javascript:"`, `@import` and `url(javascript:)` all stripped from the rendered contract; `?format=html` additionally serves `Content-Security-Policy: sandbox; default-src 'none'`
- [x] **The placeholder panel inserts at the cursor**, not just copies — the token is only ever wanted in one place. First attempt restored the caret in a `requestAnimationFrame`, which raced React's controlled re-render and left it at 0, so a second insert landed *before* the first; now held in a ref and applied from an effect after the commit. Verified: caret at 21 (the token's length) with the textarea still focused
- [x] **Exactly one default while any template exists.** It moves by promoting another, never by demoting this one into a vacuum — an organization with templates and no default 404s on contract generation for a reason nobody can see. The form shows this instead of letting the server silently override: the checkbox is checked and disabled on the first template and on the one already in force. Deleting the default promotes the oldest survivor
- [x] Verified over HTTP: 401 unauthenticated on both routes; duplicate name 409 (case-insensitive); empty body and unknown language 400 with per-field messages; **cross-organization GET/PATCH/DELETE all 404, the other organization's row survived the delete attempt, and its template id could not be used to render this organization's lease**
- [x] Verified in the browser: the submenu in both themes, on desktop and in the mobile drawer; both preview modes; the language swap and its guard; insert-at-cursor; create, promote, delete with the successor taking over; mobile cards with no horizontal overflow
- [x] `tsc`, lint (0 errors, 3 pre-existing warnings) clean

### Feedback pass

- [x] **The page caption is gone.** "The contract wording your leases are generated from…" explained the feature to someone who had already navigated to it; the table's own columns say the same thing in less space
- [x] **Submenu items are the same size as top-level ones**, set in from them rather than shrunk. shadcn's `SidebarMenuSubButton` ships `h-7` against this app's `h-10` menu buttons, which read as a different and lesser kind of control. Now `h-10` at the call site, exactly as `SidebarMenuButton` sets its own height there. Measured in the browser: 40px tall and 14px text on both, with the sub item indented 25px
- [x] **A View action (eye) on every row**, leading the three. Double-clicking a row already opened the template, but a double-click is not an affordance anyone finds. It opens a **read-only dialog** rather than the editor — the same split the Units table makes between its view dialog and its form, so the eye and the pencil never mean the same thing
- [x] The dialog **fetches the body when the action fires**, not with the row. `getLeaseTemplates` already reads every body to count placeholders; carrying them into the client would ship a list of contracts to render four columns of metadata
- [x] **Description is its own column**, not a second line under the name. It was competing with the template name for the same cell, and a table that has room for a column should use one
- [x] **A parent with children is never active.** `containsActive` now says only "you are somewhere inside this group" — it opens the group and nothing else. Active means "this is the page you are on", and lighting both Settings and Lease templates put two pills on screen for one location. Verified: the parent carries no `data-active` and a transparent background while the child carries both, in the rail and in the mobile drawer
- [x] `tsc`, lint (0 errors) clean; verified in both themes

### Not done
- [ ] **Nothing in the UI generates a contract yet.** `GET /api/leases/[id]/contract` works and is verified, but no button on the lease page calls it, and the result is not filed as a `FileAsset` against the lease. That is the next phase, and it is where PDF output and a signature flow belong
- [ ] **The body is raw HTML in a `<textarea>`.** No rich-text editor, no syntax highlighting, no validation that the markup is well-formed — a stray `<div>` is only visible in the preview. Fine for the person who pastes a Word export, hostile to anyone else
- [ ] The sanitizer is a **regex allowlist, not a parser**. It strips every vector tested, but a `<script>`'s *text* survives as visible (inert) text, and a sufficiently strange nesting could get past it. The sandboxed iframe is what actually stops execution; do not render a body without one
- [ ] **`<style>` blocks are allowed through**, which the starters rely on. Safe inside the iframe, but it means a body cannot be dropped into a page unwrapped
- [ ] **No preview against a real lease from the editor.** The preview uses example values; the only way to see a contract with actual data is the API. A "preview with lease…" picker belongs on that page
- [ ] `tenant_nationality` now has a column, but **nothing backfills it** and no import writes it — every existing member has null, so that token prints a blank line until someone edits the member
- [ ] **No template versioning.** Editing a template changes the wording future contracts are generated from, with nothing recording what an already-signed contract said. Once generation files a document this stops mattering; until then it is a real gap
- [ ] Two templates were left in the working organization (the English and Swahili starters, saved as real rows) rather than deleted like other test data — they are usable content, not fixtures. Delete them if they are in the way
- [ ] The dev server **had to be restarted** for the new model, the same stale-`globalThis`-client note as Phases 64, 69, 70 and 72

## Phase 76 — The template editor becomes a document, not a textarea

Feedback pass. The editor was HTML in a `<textarea>` with the token syntax on show; it is now a page you type into.

- [x] **Creating a template starts in a dialog** — name, language, and a `Textarea` description — with a **Next** button that carries all three to `/settings/lease-templates/new` in the query string. The editor page shows only the name (plus a language badge and the description under it) and an **Edit details** button that reopens the same dialog. The three fields used to sit above the contract, where they competed with it for the top of the screen and were re-read on every visit despite changing about once
- [x] Landing on `/new` with no name — a typed URL, a stale bookmark — **opens the dialog on the page** rather than dead-ending on a nameless form
- [x] **`components/settings/rich-text-editor.tsx`** — a `contenteditable` surface with the toolbar from the reference: block format, font, size, B/I/U/S, colour, highlight, four alignments, both lists, a table, and `{ } Variable`. Built on `document.execCommand` rather than adding ProseMirror: nothing in the project has an editor library, and what a lease template needs is formatted prose, a table and some variables. The deprecation is real and noted below
- [x] **The editor is uncontrolled.** Writing `innerHTML` on every render puts the caret back at the start of the document on every keystroke, so the DOM is seeded once and changes flow one way, outwards. Toolbar buttons `preventDefault` on mousedown and a `selectionchange` listener remembers the last range inside the editor, so a click in the toolbar or the variables panel acts on the selection it looked like it would
- [x] **Tokens are never shown to the author.** `tokensToChips` turns every known `{{key}}` into an atomic `contenteditable="false"` chip showing its *label* ("Owner full name"); `editorHtmlToBody` walks the DOM on the way back and turns each chip into `{{key}}`. The stored format is unchanged, so the API, `renderLeaseTemplate` and contract generation needed no edits at all. An **unknown** token stays literal text on purpose — it is a typo, and a typo that renders as a chip is one nobody finds
- [x] Verified the round trip against the database: a template written entirely in the WYSIWYG stored 27 token occurrences / 24 distinct, **no `data-variable` anywhere in the stored body**, the signature table intact, and a bold applied through the toolbar preserved. Generating a contract from that body still filled in `L-ZVM9T`, `Chris patt`, `Jackson Mayunga`, `C2`, `Java`, `TZS 600,000`
- [x] **The `<style>` block is gone from template bodies.** How a contract is typeset now lives in `lib/lease-document-style.ts`, read by both the editor surface and the preview iframe. A body carrying its own stylesheet was fine when it was edited as HTML and became CSS the author could see and delete the moment it became a document. Bodies saved before this keep their block — it is stripped on load into the editor, where the shared sheet covers it
- [x] **The signature table ships in every template** (it is in both starters) and survives the round trip — the editor draws a dashed outline on table cells so the block is visible while being edited, and nothing stops it being deleted
- [x] **The variables panel is searchable and shows names only.** No `{{…}}` in the list: the token is a storage format, not something an author should have to read or type. Clicking a name drops the chip in at the caret; a gold dot marks the ones already used. The toolbar's `{ } Variable` button focuses the search rather than duplicating the whole list in a popover
- [x] **Preview defaults to Placeholders**, with **Sample data** as the second button — a template is read to check its wiring far more often than to admire example prose
- [x] Captions removed: the list page's "The contract wording your leases are generated from…" paragraph and both preview-mode explanations
- [x] **Description is its own column** in the table, no longer a second line under the template name
- [x] **A View row action** (the eye, leading) — the body is fetched when the action fires rather than carried on every row, so a list of ten templates doesn't ship ten contracts' worth of HTML to render four columns of metadata
- [x] Verified in the browser: the dialog → Next → editor hand-off carrying all three values; insert-at-caret from a filtered search; bold through the toolbar landing as `font-weight: bold` on the selected word; both preview modes; the Swahili template loading with its old `<style>` block stripped and 28 chips; dark mode (the page stays white paper while the chrome goes dark); mobile with no horizontal overflow; no console errors
- [x] `tsc`, lint (0 errors) clean

### Not done
- [ ] **`document.execCommand` is deprecated.** Every browser still implements it and nothing suggests removal, but it is the load-bearing part of this editor and it is not coming back. The moment this surface wants comments, revision marks, collaborative cursors or reliable undo grouping, it should become ProseMirror rather than grow
- [ ] **No undo/redo buttons**, and `execCommand`'s undo stack is the browser's — ctrl-Z works inside the document, but a toolbar action and a keystroke are not always one step
- [ ] **Editing an old template silently drops its `<style>` block** on the next save. Nothing is lost visually (the shared sheet replaced it) but it is a one-way conversion, unannounced
- [ ] **No preview against a real lease from the editor.** Still example values only; the API is the only way to see a contract with actual data
- [ ] The toolbar's font and size dropdowns **do not reflect the caret** — they are actions, not state, so they always read "Font" and "Size" rather than what is under the cursor
- [ ] **No column/row controls for tables.** The button inserts a 2×2; growing it means the browser's own context menu
- [ ] Everything still open from Phase 75: no UI generates a contract, no versioning, `tenant_nationality` unbackfilled

## Phase 77 — Feedback: one mode button, details in the dialog, captions gone

- [x] **Edit and Preview are one button**, in the slot the details button used to occupy — it reads "Preview" while editing and "Edit" while previewing. A second button appears *only* in preview, flipping between **Placeholders** and **Sample data**: which values fill the gaps is a question the editor cannot answer, so the control does not exist there
- [x] `TemplatePreview` takes an optional `mode`. Supplied, it is controlled and renders no buttons of its own — the editor owns the switch. Left out, it keeps its own pair, which is what the view dialog (the eye action) still wants
- [x] The two panels are **hidden, not unmounted**. Same reason the tabs were `keepMounted`: the editor is uncontrolled, so remounting it would reseed from the *original* body and silently discard everything typed since
- [x] **Template details moved to a gear beside the title.** The page's one prominent action is now the mode switch; the things that change about once a template's life are behind an icon
- [x] **The description no longer appears on the editor page.** It exists to tell two rows of the list apart, and on the page for one template it is a line that never earns its place. Still captured in the dialog, still a column in the table
- [x] **"Use this template by default" moved out of the editor into the create dialog**, joining the rest of what a template *is*. Carried through the Next hand-off as `?isDefault=1`, and the locked case (first template, or the one already in force) shows as a checked disabled box there instead. The card that held it is gone; Cancel/Save is a plain row under the document
- [x] Captions removed: "How this template is labelled in the list…" and "Optional — shown in the list, to tell two templates apart". "Sets the wording the contract starts from" was kept — it explains the starter swap, which is not otherwise discoverable
- [x] Verified in the browser end to end: dialog with the default box checked → Next → editor header showing title, badge and gear only → Preview → Sample data → Placeholders → Edit → gear reopens with all four values including the checkbox → save landed **as the default**, with the previous default's star cleared. Test template deleted and the original default restored afterwards
- [x] `tsc`, lint (0 errors) and a fresh-tab console with no errors

### Not done
- [ ] **`npm run build` while `next dev` is running corrupts the dev server** — it overwrites `.next` underneath it, and the running server then serves stale chunks (this pass surfaced as a phantom `ReferenceError: Tabs is not defined` for code that no longer existed). Fix is `rm -rf .next` and restart. Worth remembering before blaming a build error on the source
- [ ] Everything still open from Phases 75 and 76: `execCommand` deprecation, no undo/redo buttons, no contract generation UI, no versioning, no preview against a real lease

## Phase 78 — Feedback: shorter copy, tooltip, a leaner toolbar, visible lists and tables, unsaved-changes bar

- [x] **"already the default; promote another to move it" → "already the default"**, in both the create dialog and the edit-details dialog (one component, `LeaseTemplateDetailsDialog`, serves both)
- [x] **The placeholder panel's footer caption is now a tooltip** on an info glyph beside "Variables" — `Tooltip`/`TooltipTrigger`/`TooltipContent` from `components/ui/tooltip.tsx`, the root layout's existing `TooltipProvider`. The panel is shorter by a paragraph that only mattered the first time anyone saw it
- [x] **Font and text colour removed from the toolbar.** A contract has one voice, not five typefaces, and colour was the one control with no place in a printed agreement. Highlight (a single fixed gold) stays — marking a clause for attention is a different thing from choosing an arbitrary colour
- [x] **Fixed: bulleted lists, numbered lists and tables rendered nothing.** Two separate causes, both in `lib/lease-document-style.ts`:
  - Tailwind's Preflight sets `list-style: none` on every `ul`/`ol` **in the app's own page** — invisible to the preview iframe (a separate document Tailwind never reaches) but stripping every bullet and number inside the editor, which shares the page. `.jarvis-doc ul { list-style: disc }` / `ol { list-style: decimal }` restates the browser default explicitly, scoped so nothing outside the document surface is touched
  - A plain `<table>` has no visible border in any browser by default — the insert wasn't broken, there was just nothing to see. `.jarvis-doc table td/th` now carries a real `1px solid #999`; `.signatures` (both starters' sign-off block) is explicitly exempted, since it lays out with the `.rule` underline rather than a grid and was never meant to show cell lines. The editor's old dashed-outline-on-`td` override is gone — the real border does that job in both the editor and the preview now, so it no longer needs a separate, weaker one
- [x] **A top "Unsaved changes" bar**, Reset + Save/Create, appearing only when `mode === "edit"` **and** something has actually changed. "Changed" compares the live `body` and `details` against a baseline captured once at mount via a lazy `useState` initializer — not a `useRef`, because the new React Compiler lint rule (`react-hooks/refs`) flags reading `ref.current` during render, and `isDirty` is computed every render. Reset restores both to that baseline and bumps `RichTextEditor`'s `documentKey`, which forces it to reseed from the *same* `initialEditorHtml` it started with — no second copy of the starting HTML needed
- [x] The bottom Cancel/Save row is unchanged and still the reliable path; the top bar is a shortcut that only exists when it has something to say
- [x] Verified in the browser: tooltip fires on hover; a numbered list (existing, in the starter) renders `1. 2. 3.`; a bulleted list created live from the toolbar renders a disc; a table inserted from the toolbar shows a real grid while the signature table stays borderless; typing produces the top bar, Reset removes it and reverts the document exactly (table and list both gone, content back to the untouched starter); Preview shows no top bar regardless of edits; a fresh tab's console has one pre-existing, unrelated `InvalidStateError` from React's page `<ViewTransition>` under rapid programmatic navigation (see the 2026-08-13 decision log entries) and nothing else
- [x] `tsc`, lint (0 errors, the same 3 pre-existing warnings) and a clean `npm run build` with the dev server stopped first

### Not done
- [ ] Everything already open from Phases 75–77: `execCommand` deprecation, no undo/redo buttons, no contract generation UI, no versioning, no preview against a real lease, no font/size reflecting the caret position

## Phase 79 — Feedback: one action row, no bottom footer

- [x] **The bottom Cancel / Save row is gone.** Every action for the page now lives on the header row, level with the title — Reset (when there's something to throw away), the Preview/Sample-data toggle, and Save/Create, in that order, ending with Save as the page's one primary action
- [x] **Save had to stop being conditional on `isDirty`** once it lost its second, always-visible copy at the bottom: a brand-new template built entirely from the untouched starter is still something to save, even though nothing has technically *changed*. It is now always present, disabled only when there's a name but no organization-facing reason to submit — `pending`, an empty name, or (editing an existing template specifically) no pending changes. Reset stays conditional on `isDirty`, since resetting nothing is a button with no job
- [x] Leaving the page without saving is still one click away via the existing "← All templates" link at the top of the page — that was never the removed button's job, so nothing was lost by dropping it
- [x] Verified in the browser: an unmodified existing template shows Preview + a disabled Save, no Reset, no bottom row; typing produces Reset and an enabled Save on the same row as Preview; Reset removes both the edit and itself, restoring the exact original content; a brand-new template (untouched starter) shows an *enabled* "Create template" immediately, with no dead-end requiring an edit first
- [x] `tsc`, lint (0 errors, same 3 pre-existing warnings) and a clean `npm run build` with the dev server stopped first

### Not done
- [ ] Everything already open from Phases 75–78.

## Phase 80 — Lease contracts: `lease.created` → PDF → MinIO → a record like any other

A lease is signed, an event goes on the bus, and a worker turns the default template into a filed PDF. Nothing on the request path changes.

- [x] **`lib/events/` — a second exchange, not the mail one.** `jarvis.events` (topic) with its own DLX, mirroring `lib/mail/queue.ts` shape for shape: one recovering connection, a confirm channel, topology re-asserted on reconnect. It *has* to be separate — `jarvis.emails` binds `#` and its consumer treats everything it receives as a rendered `MailMessage`, so a domain event published there would be mailed to nobody and dead-lettered. Both happen to carry a `lease.created` key because they describe one occurrence in two vocabularies: "tell these people" and "this is now true"
- [x] The **producer declares the queue**, not the worker: an event published before the worker has ever run must be held, and a topic exchange with no bound queue discards silently. That is the difference between "the worker was down ten minutes" and "ten leases have no contract and nothing says why"
- [x] `POST /api/leases` publishes `lease.created` inside `after()`, beside the existing email announcement. Ids only, never a snapshot — by the time a consumer runs the database is the truth, and anything copied into the message is a guess about what it said
- [x] **`lib/pdf.ts` — Playwright/Chromium**, chosen over a pure-JS generator for one reason: the contract's look is already defined in `lib/lease-document-style.ts` and already approved in the editor's Preview. A layout engine that re-implements CSS produces something *similar*, and then nobody can say whether the preview or the PDF is right. Chromium renders the same stylesheet, so the PDF **is** the preview. One browser per process on `globalThis`, a fresh context per render
- [x] **`lib/contracts.ts` — the pipeline**, assembled from pieces that already existed: `generateLeaseContract` (fills placeholders from the database) → `htmlToPdf` → `createDocument`. That last one matters most: a generated contract goes through the *same single door* every uploaded file does, so it is listed, downloaded and deleted by exactly the code that handles a scanned one. That is what "consistent with how we keep our records" has to mean — not a parallel table for machine-made files
- [x] `createDocument`'s `userId` is now `string | null`. **A worker is not a person**, and inventing a membership for it would put a lie in `uploadedById` that every "uploaded by" line then repeats. The column was already nullable for exactly this reason; the Contract tab shows `—`
- [x] Migration `20260826150000_lease_contract_type` seeds `sys_LEASE_CONTRACT` ("Generated contract", LEASE, `allowsMultiple: false`). Deliberately **not** `sys_LEASE_AGREEMENT` ("Signed agreement") — that is the scan uploaded after both parties sign, and conflating a machine-made draft with a legally executed document would have them share one slot
- [x] **`worker/contract-worker.ts`**, run as `npm run worker`. Prefetch 1, one retry then the dead-letter queue. Retries **republish with an `x-attempts` header** rather than `nack(requeue)` — a requeued delivery looks brand new, so the retry would never terminate. Unparseable messages and ones with no ids go straight to the DLQ (they will never become valid); "no template" and "lease not found" are **acked**, since neither fixes itself by being retried and the Contract tab's Generate button is the real recovery
- [x] **Chromium lives only in the worker.** `POST /api/leases/[id]/contract` publishes the same event rather than rendering inline, so the web process never needs a browser installed. 202, not 201 — nothing has been created yet, and saying otherwise is a lie the UI then has to explain
- [x] **The Contract tab is a real `DocumentsPanel`**, replacing the "will live here" placeholder. The generated PDF sits in the same table as Amendment / Renewal / Signed agreement / Termination notice, with the same view, download and delete actions
- [x] Verified end to end against live infrastructure: publishing an event filed `contract-L-ZVM9T.pdf` (104,702 bytes) at the same key convention as an uploaded file; read back through `getObjectStream` it is a valid `%PDF-` of exactly the recorded `sizeBytes`; rendered to an image it shows the real lease's data — Chris patt, Jackson Mayunga, C2 at Java, Kinondoni, TZS 600,000/month, TZS 1,800,000 over 3 months — with dotted fill lines for the seven fields that organization has never filled
- [x] Verified **creating a lease through the API** auto-generated its contract with no further action, and that regenerating **replaced**: still exactly one row, a new object key, and the superseded object gone from the bucket rather than orphaned
- [x] Verified the failure paths: unauthenticated 401; an unknown lease id 404; **a real lease id belonging to another organization 404**; unparseable and id-less messages dead-lettered (`contracts.generate.dead` = 2) while the queue drained to 0; an organization with no template skipped with a message naming the fix; and **`emails.outbound` untouched throughout**, which is the separation the two exchanges exist for
- [x] Fixed while verifying: the PDF footer's page counter was three flex children under `space-between`, rendering "1     /     2". One child now
- [x] `tsc`, lint (0 errors) and a clean `npm run build`

### Not done
- [ ] **Deleting a lease orphans its contract object in MinIO.** The `FileAsset` row cascades away with the lease, but the bytes stay in the bucket — pre-existing behaviour (deleting a property or member does the same; TASKS Phase 67 calls for a reaper), now much more likely to be hit because every lease has a contract. Verified and cleaned up by hand this time. The reaper is the fix; a cascade-aware delete in `lib/leases.ts` is the cheaper one
- [ ] **The worker is a second process the deploy has to run**, plus `npx playwright install chromium` on that host. Nothing in the repo provisions it — no Procfile, no Railway service definition, no Dockerfile. `npm run worker` is documented in AGENTS.md and that is all
- [ ] **No status on screen while a contract is being generated.** The tab says "refresh in a moment" and nudges a refresh after 2.5s. There is no `generating`/`failed` state anywhere — a render that dead-letters looks identical to one that was never asked for. A column on `Lease`, or a small `ContractJob` table, is what would fix it
- [ ] **The DLQ has no drain.** Messages that fail twice sit in `contracts.generate.dead` with nothing watching it and no alert
- [ ] Regeneration is **destructive and unversioned** — the previous contract's row and object are both deleted. Fine while nothing is signed, wrong the moment one is
- [ ] The worker renders **one contract at a time** (`PREFETCH = 1`). Correct while a browser context is the expensive part; a bulk import creating fifty leases would queue behind it
- [ ] Nothing generates a contract on **renewal** — `lease.renewed` exists as a mail routing key but is not a domain event, so an auto-renewed lease keeps its old contract

## Phase 81 — Contract and Documents split; the event is the only path

- [x] **Contract and Documents are separate tabs on a lease**, the same split a property makes between Images and Documents: one tab holds what the system produced, the other holds what people file. They are read for different reasons and only one of them is uploaded into. Both carry a count badge that hides at zero, matching the convention everywhere else
- [x] The predicate is the seeded type's **id**, not a new column. Exactly one lease type is machine-made, and an `isGenerated` column would be a migration to express what `LEASE_CONTRACT_TYPE_ID` already says. The property page splits on `isPhoto` because *several* types share that property; this does not
- [x] **"Generated contract" is gone from the Documents dropdown**, because `paperTypes` excludes it — so there is no way to hand-upload something into the slot the worker owns
- [x] **The Generate button and its caption are both gone.** The contract is made when `lease.created` lands on the bus, and a button beside it would be a second way to do one thing, leaving the tab to explain which is authoritative. `POST /api/leases/[id]/contract` still exists for a backfill or a retry — it just isn't a control anyone has to think about
- [x] `DocumentsPanel` gains **`allowUpload`** (default true). False hides the toolbar button *and* the "Not uploaded" checklist rows — those rows are an invitation to upload, and on a generated list that invitation is a dead end. The Contract tab passes false and reuses the same table, so view / download / delete are the identical code path
- [x] **A row's Upload button now locks the type.** Opened from "Signed agreement", the dialog files a signed agreement — the field still *shows* what is being filed but cannot be changed into something the row did not ask for, the same inert-field choice `PhotoUploadDialog` made in Phase 71. Derived from `initialAssetTypeId !== null` rather than a second prop, since that already means "opened from a type's own row". The toolbar button is unaffected and still chooses freely
- [x] Verified in the browser: Contract tab shows only `contract-L-OW5LY.pdf` with no caption and no buttons; Documents shows the five human-filed types with Upload; a row's dialog opens preset and **genuinely inert** (`disabled: true`, and clicking it yields 0 options) while the toolbar's opens with all five plus "Add a type…"; **the stored link serves** — `/api/documents/<id>` returned 200, `application/pdf`, `inline; filename="contract-L-OW5LY.pdf"`, 104,269 bytes matching `sizeBytes` exactly
- [x] Verified the priority path again after the tab changes: creating a lease through the API filed `contract-L-R1ZQG.pdf` with **no manual step**. Also confirmed the durable queue does its job — a message for L-OW5LY had been waiting while the worker was stopped, and was processed on startup
- [x] Test lease, its contract row and its object all removed afterwards; two real contracts remain with no orphaned objects. `tsc`, lint (0 errors) and a clean `npm run build`

### Not done
- [ ] **With no Generate button, a lease that missed its contract has no on-screen recovery.** Leases created before Phase 80, and any whose render dead-lettered, will show an empty Contract tab forever. The API endpoint is the recovery and nothing in the UI reaches it — a backfill script, or surfacing the endpoint on a failed state, is the real fix
- [ ] Still no **generating / failed status**: an empty Contract tab means "not made yet", "being made right now" and "dead-lettered twice" indistinguishably. This is the gap the missing button makes sharper, not one it caused
- [ ] Everything else still open from Phase 80: lease deletion orphans the object in MinIO, the worker is an unprovisioned second process, the DLQ has no drain, regeneration is unversioned, and renewal generates nothing

## Phase 82 — Backfill for leases missing contracts

The recovery Phase 81 left open, in both shapes: one lease from the page, every lease from the command line.

- [x] **`findLeasesMissingContracts(organizationId?, limit?)`** in `lib/contracts.ts` — `fileAssets: { none: { assetTypeId: LEASE_CONTRACT_TYPE_ID } }` rather than filtering in JS, since the set of leases *with* a contract grows without bound and this only ever wants the gap. Oldest first, so a `--limit`ed run makes predictable progress instead of re-doing the same head of the list
- [x] **`npm run backfill:contracts`** (`worker/backfill-contracts.ts`), with `--dry-run`, `--org=<id>` and `--limit=<n>`. It **publishes rather than renders**: it needs no browser, and the worker stays the only thing that makes a PDF — one code path files a contract, whether the lease was signed a minute ago or two years ago
- [x] **Idempotent by construction.** A lease that got its contract on the first pass is no longer missing one, so a second run finds it gone. Verified: re-running the org-scoped backfill printed "every lease in organization … already has a contract"
- [x] A failed publish **logs and carries on** rather than abandoning the rest — re-running skips whatever did get through, so a partial run is always safe to repeat
- [x] **The Generate button is back, but only when there is no contract.** Phase 81 removed it because it duplicated the event in the normal case; that reasoning holds when a contract exists and fails when one doesn't. Present exactly when there is something to recover from, absent the rest of the time
- [x] Verified the whole loop in the browser: with a contract on file the tab shows the record and no button; deleting it made the button appear; clicking queued it (`Queueing…` → toast), the worker rendered it, and the auto-refresh brought the row back with the count badge at 1 and the button gone again
- [x] Verified the flags: `--dry-run` listed 8 leases and published nothing (queue depth unchanged); `--org` narrowed to 3; `--limit=2` took the first two; `--limit=abc` was refused with a message and a non-zero exit
- [x] Ran it for real against the working organization — `L-VM24Y` and `L-265FD` queued and filed. Five contracts now on file, **five objects in the bucket, one each**: no orphans through a full delete-and-regenerate cycle
- [x] The 5 leases still listed as missing are in organizations with **no lease template** — the worker skips those with a message naming the fix, which is correct rather than a failure
- [x] `tsc`, lint (0 errors) and a clean `npm run build`

### Not done
- [ ] The backfill **queues, it does not wait**. `npm run backfill:contracts` finishing means the messages are on the bus, not that the PDFs exist — the worker has to be running, and the script says so rather than blocking on an unknowable
- [ ] Still no **generating / failed status** on screen: with the button now present whenever a contract is absent, "never made" and "dead-lettered twice" still look identical, and clicking again is the only way to tell
- [ ] The button is shown to **anyone who can see the lease** — there are no permissions on it, in a codebase where roles exist but grant nothing yet
- [ ] Everything else still open from Phases 80–81: lease deletion orphans the object in MinIO, the worker is an unprovisioned second process, the DLQ has no drain, regeneration is unversioned, renewal generates nothing

## Done

Auth + app shell complete. Deferred: org switcher (build with invitations).
Next sprint candidates: Properties CRUD (the shell is ready — add pages under `app/(app)/properties/`), org invitations, org switcher.

Known benign warning: `next-themes` injects a pre-hydration `<script>`; React 19 logs "Encountered a script tag while rendering React component". Expected, theme switching works.

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

## Done

Auth + app shell complete. Deferred: org switcher (build with invitations).
Next sprint candidates: Properties CRUD (the shell is ready — add pages under `app/(app)/properties/`), org invitations, org switcher.

Known benign warning: `next-themes` injects a pre-hydration `<script>`; React 19 logs "Encountered a script tag while rendering React component". Expected, theme switching works.

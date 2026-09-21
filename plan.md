# Jarvis — architecture & decisions

Multi-tenant property management (product name **Rentoo**, `SITE_NAME` in `lib/site.ts`; **Jarvis** is the codename). An `Organization` owns `Property` → `Unit` → `Lease`. A `User` joins an org through a `Membership`, which carries an org-scoped `Role`. **Tenants are not a separate model** — a lease points at the tenant's `Membership`. Each `Lease` has one `Invoice`; `Payment`s hang off the invoice. An org also owns `LeaseTemplate`s, `FileAsset`s (every stored file) and per-org `FileAssetType`s.

> **This file is the short version.** The full chronological decision log (~100 entries with complete reasoning, to 2026-09-21) is in [`docs/archive/plan-2026-09-21.md`](docs/archive/plan-2026-09-21.md). Read it only when you need the *why* behind a rule below — don't load it at session start.
> **Adding a decision:** one row in the log at the bottom, **≤ 3 sentences**. Fold anything that becomes a standing rule into the right section here.

## System shape

- **Web app (this repo)** — Next.js on a long-lived container (Railway). `npm start` = `prisma migrate deploy && next start`.
- **Queue consumers run inside the web server** (`instrumentation.ts` → `lib/events/{document,lease}-consumer.ts`). A deploy of the app is a deploy of its consumers. Start functions resolve on *subscription* (never on messages), are idempotent (`running` promise), and log rather than throw on broker failure. **Only valid on a long-lived container** — on serverless, move consumers out first. `worker/*.ts` are thin shims for debugging one consumer.
- **`document-worker`** (`../document-worker`, NestJS :3400) renders PDFs. Jarvis publishes `lease.created` `{ html, objectKey, footerText, meta }`; the worker renders, uploads, announces `document.stored`. **No Playwright/Chromium in this repo** (ESLint rule enforces).
- **`notifier`** (`../notifier`) sends email from `NOTIFIER_EMAIL_QUEUE`. **`automatifier`** (`../automatifier`) owns the clock: publishes `lease.renewal` / `lease.vacating`.
- **RabbitMQ** — three exchanges: `jarvis.events` (domain events, direct DLX), `jarvis.emails` (rendered mail), `automatifier.events` (inbound). **Naming:** queues `UPPER_SNAKE` named for the *consumer*; routing keys `lowercase.dotted` named for *what happened*; DLQs `<QUEUE>_DEAD`. Routing keys are env-configurable but event *identity* stays literal in code (`as const`) so payloads type-check. Jarvis asserts and binds topology; consumers only `checkQueue`. Renaming a queue is a three-sided change (Jarvis, consumer, env).
- **Storage** — S3 API (MinIO local, Cloudflare R2 prod). One bucket, keys `organizations/<orgId>/…`; tenancy is a prefix.
- **Cron** — `POST /api/cron/notifications` (Bearer `CRON_SECRET`), hourly. Runs `syncLeaseStatuses` (Upcoming→Active) first, then the notification sweep.

## Standing rules (by area)

### Auth & sessions
- Custom auth: `jose` HS256 JWT in an httpOnly cookie (7d), `bcryptjs`. Login by email **or** phone. `proxy.ts` (Next 16's middleware) protects pages; **API routes enforce auth themselves**.
- The session's `orgId` is a *claim*, revalidated against live memberships in `getCurrentUser()` on every request. Org switching re-issues the cookie. One organization per owner (enforced in a transaction).
- `passwordHash` and `email` are nullable (assisted-onboarding tenants, phone-only). Login rejects a null hash with the same generic 401 + dummy hash (no enumeration/timing leak).
- Registration = one transaction: User + Organization + Owner role + Membership + default lease template. Self-service registrations require email verification (the gate lives in `requireActiveOrg`, not just the layout); invited members are grandfathered via a column default.
- One-time codes (reset, verify): 6-digit CSPRNG, **bcrypt**-hashed, 5-attempt cap, shared policy in `lib/auth/one-time-code.ts`. Invite tokens: 256-bit, SHA-256 stored. Reset proof travels as an httpOnly ticket cookie, never in the URL. `forgot-password` always answers `{ ok: true }`.
- Auth endpoints are rate-limited in memory by IP **and** by identifier (per-process).
- Accepting an invitation applies the invited role **on acceptance** (never on creation) and verifies the email only if the invitation carried that address. A role change that would leave the org with no Owner is refused, but the acceptance still completes.
- Deleting an org: three explicit ordered deletes (roles are `RESTRICT`), clears the caller's cookie in the same request, lands on `/`. Never touches `User` rows.

### Roles & permissions
- `Role` is an org-scoped model. **Owner** and **Tenant** are built-in and matched by name in code (`lib/role-constants.ts` — Prisma-free on purpose); never rename/delete them. The Roles page is hidden; **permissions are named but not modelled or enforced** — any member can reach any page.

### Leases, billing, renewal
- `Lease.status` is a **stored column** (`Upcoming/Active/Ended/Renewed`) written by `leaseStatus()` on create/edit/import. **Renewed** is set on the predecessor inside `insertLease`'s transaction (`renewedFromId`, unique).
- `insertLease` is the one overlap-checked write path (UI, import, renewal). It announces nothing; **callers** publish (`lease.created` to the document worker, mail events inside `after()`).
- A lease stores its own agreed `monthlyRent`; `leaseAmount = monthlyRent × durationMonths`. Editing re-derives from the unit's current rent and is refused below what has been paid.
- One `Invoice` per `Lease` for the full amount; `InvoiceStatus` (Unpaid/Partial/Paid) is **derived**. Balances come from one grouped aggregate, never nested includes. Billing totals live on the dashboard only; the invoice figures sit on the lease Overview.
- **Auto-renew is on the `Unit`** (`autoRenew` default true, `minTenureMonths` default 6). `createLease` rejects terms shorter than the tenure. Moving the flag to `Lease` is an open decision.
- **Lease events:** `automatifier` says only "this term is up"; the handler re-reads the row and takes nothing but `lease.id` from the payload. Renewal reuses `insertLease`; `unit-occupied` closes the lease instead of retrying. Vacating is an `updateMany` guarded on status (zero rows = idempotent) and never overwrites `Renewed`. Both handlers are idempotent against at-least-once delivery. The lazy renewal-on-page-load sweep is **gone**.
- Cross-organization leases are **not prevented by the schema** — every query must filter by both the membership's and the unit's org.
- Day counts and expiry tags are computed server-side; tags escalate (outline <60d, destructive <30d).

### Contracts pipeline
- `LeaseTemplate` bodies hold `{{placeholders}}`; the token set + resolvers live in `lib/lease-placeholders.ts` (Prisma-free, one list for UI and server). Unresolved token → blank fill line; unknown token stays visible. Exactly one default template while any exist (moves by promotion); every org is seeded one at creation (`lib/lease-template-starters.ts`).
- Bodies are sanitized server-side **and** rendered in a `sandbox=""` iframe. The editor stores `{{tokens}}` and displays chips; it is `contenteditable` + `execCommand` (replace only if you need comments/revisions/collab). Typography lives in `lib/lease-document-style.ts`.
- Flow: lease created → `lease.created` → document-worker renders (layout fixed there; margins 18/16/20/16mm) → `document.stored` → **this app's consumer writes the `FileAsset` row** (a row means "bytes exist"). The object key is the correlation id (`parseContractObjectKey` inverts `buildObjectKey`); `meta` is trusted **all-or-nothing** and the key is authoritative. Recording is idempotent (`objectKey @unique`) and checks the lease belongs to the org. HTML is capped at 4MB (bytes) → `too-large`, HTTP 413.
- The Contract tab is separate from Documents (split on `LEASE_CONTRACT_TYPE_ID`). Generate appears only when there is no contract; it **publishes and answers 202** — it cannot report a failed render. `npm run backfill:contracts` queues, never waits.

### Messaging, mail, notifications
- Mail leaves as a **fully rendered message** (`{ email, subject, content, service_name }`); the notifier templates nothing. `publishMail`/`publishEvent` **never fail the request** (they swallow errors) and callers wrap them in `after()`.
- **Domain email goes to owners only** (`getOwnerRecipients`; no `tenantEmail` in the mail layer). Auth email follows credentials. The one exception is the invitation email, gated by `INVITE_EMAIL_OWNERS_ONLY` (default true; suppression is reported to the inviter as `emailSuppressedForRole`). The copyable link never goes away.
- Scheduled notices are claimed by a **unique-key insert into `NotificationLog` before sending** (`invoice.paid_in_full` fires on the crossing; lease-expiry skips auto-renewing units). The lockout email has its own rate limiter.
- Build links with `appUrl`, never a browser origin.

### Files & documents
- One `FileAsset` table for every stored file; `organizationId` required; **at most one subject** (hand-written CHECK); subject FKs cascade, `uploadedById` SET NULL, `assetTypeId` RESTRICT. The object key's file name is a fresh uuid.
- `FileAssetType` is a **table** (system rows shared/immutable, custom rows per-org). One `/api/documents` for every subject. **Write object then row; delete row then object** (the surviving failure is an invisible orphan, not a dead row). The cross-org rule is enforced in `createDocument` before upload — a write-path rule, not an FK.
- The MIME allowlist matches the *reported* type and the stored extension comes from it, never the file name (no svg/html served from our origin). Bytes pass through the route handler (10MB).
- One document per (subject, type) unless the type `allowsMultiple`. Photos: own tab, own dialog, sequential uploads. Profile photo: singular, replace deletes the old one client-side, hand-built canvas crop. Photo lookups are **batched per list** (`getProfilePhotoIds`).
- `DocumentsPanel` is the one component for every subject; `allowUpload` turns off the upload affordances.

### Spreadsheets: import / export / backup
- Importers go through `lib/xlsx-import.ts` + `components/import-dialog.tsx` (server parses, client creates row by row via the normal endpoint; leading-zero columns use text format). Exports are one generic builder returning the **full org dataset**, not the table view.
- Org backup: five sheets, raw DB columns with real FKs (Payment carries `leaseId`; Invoice is rebuilt from the lease). Restore validates everything first, then writes in **one transaction**; it reuses `User` by email then phone, and the owner's existing membership. **`PaymentAccount` and `FileAsset` are not backed up.**

### Frontend conventions
- **Import hygiene:** anything a client component imports must be free of Prisma/Playwright/exceljs (`lib/*-types.ts`, `*-options.ts`, `role-constants.ts`, `errors.ts`, `contract-steps.ts`, `search-types.ts` exist for this). Avoid import cycles between `lib/` modules.
- **base-ui gotchas:** `Button render={<Link/>}` needs `nativeButton={false}`; `SelectValue` needs a function child; `Checkbox` has its own `indeterminate`; `DropdownMenuLabel` needs a `DropdownMenuGroup`; navigating menu items use `DropdownMenuLinkItem`. `npx shadcn add` can overwrite unrelated `components/ui/*` — read the diff and revert.
- **React 19 lint rules:** no `setState` in effects (reset dialog forms with a `key` remount), no ref reads during render (use lazy `useState`), no components created during render.
- **Prisma:** after `prisma generate` **restart the dev server** (client cached on `globalThis`; symptom `Unknown field … for select`). Don't run `next build` while `next dev` runs. Schemas whose transform emits `null` are `.nullish()`, never `.optional()`. Migrations on this repo are authored with `migrate diff` + `migrate deploy`.
- **Tables:** `DataTable` uses `getRowId` from the record id, a global filter across all accessor columns, and a card view under 768px via `renderCard`. One `rowActions` function feeds both the desktop icon strip and the mobile sheet; unavailable actions grey out, meaningless ones hide. Filters persist in a module-level map.
- **Design tokens:** kinds get one `--kind-*` ink token (badges derive tint at 10% alpha); `--stat*` for filled cards; font tokens only in `@theme inline`. Currency is `TZS` via `lib/format.ts`. Motion is `tw-animate-css` + the platform + View Transitions; `motion` is **only** for the landing page. One `AppLoader` (no skeletons). Amount inputs accept arithmetic (`lib/amount-expression.ts`, never `eval`) and group digits as typed.
- **Tours:** progress is `User.toursSeen` + `toursSeenVersion` (bump `TOURS_VERSION` to re-greet everyone). `findTourForPath` matches exactly. **No tours below 768px.**

### Public site, pricing, checkout
- `/` is a static public landing page; signed-in visitors are redirected in `proxy.ts`. Packages are defined once in `PRICING_PLANS` (`lib/site.ts`): **Mikumi 25,000 / Kilimanjaro 65,000 / Serengeti 150,000 TZS a year**; monthly is derived (`round(yearly / YEARLY_MONTHS_CHARGED = 10)`); yearly shows the total plus TZS saved, never a per-month equivalent. The billing switch is a `radiogroup` client island defaulting to monthly.
- Every "pay us" CTA goes through `planCheckoutHref` to the hosted checkout **`NEXT_PUBLIC_CHECKOUT_URL`** (default `https://snippe.me/pay/rentoo`; inlined **at build time**; `?plan=&billing=` is a hint, not an instruction). `/payment-complete` is a public, `noindex` page that **reports an outcome and grants nothing**: query params are editable claims, the reference is validated, an unknown status stays `unknown` (never assumed failed). There is **no link from a payment to a subscription** until a webhook exists.

## Open decisions & known gaps
The working list is `TASKS.md → Open items`. The ones that shape design:
- Auto-renew on `Unit` vs `Lease`.
- A job-status row (`DocumentJob`) that both this repo and `document-worker` can write, so a failed render is visible. Deferred repeatedly; needs a cross-service decision.
- A permission model (roles are decorative today).
- Payment → subscription/entitlement (needs a provider webhook).
- "Rentops" vs "Rentoo" in the signed-in app, auth pages and emails (the landing page and logo already say Rentoo).

## Decision log (new entries)

| Date | Decision | Why |
|------|----------|-----|
| 2026-09-21 | Compacted `plan.md` and `TASKS.md`; full originals kept in `docs/archive/` | Both had grown past what an agent can read at session start (170KB / 287KB). The live files now hold standing rules and open items only. |

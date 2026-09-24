# TASKS

Working list. Architecture and standing rules are in `plan.md`.

> **History is archived.** ~96 phases of per-task checklists, verification notes and "not done" lists are in [`docs/archive/TASKS-2026-09-21.md`](docs/archive/TASKS-2026-09-21.md) (287KB — search it, don't load it). This file holds only **what is still open** plus a one-line-per-era index of what shipped.
>
> **Triage note (2026-09-21):** the open list below was rebuilt from the old "Not done" sections. Items that later phases resolved were dropped; the ones marked ✔ were re-checked against the code that day, the rest are carried over from the notes and worth a quick check before you build on them.
>
> **Working here:** add new work under *Open items* as `- [ ]`; when it lands, delete it (or move a one-line summary to *Shipped*). Don't append long verification write-ups — put standing rules in `plan.md`, and keep this file under ~150 lines.

## Open items

### Product gaps
- [ ] ✔ **No permission model** — `Role` exists, no `Permission` table, nothing enforced. Every member reaches every page (a tenant can read another tenant's documents if they hold the membership id).
- [ ] ✔ **Roles can't be renamed or deleted** (only `GET`/`POST /api/roles`), and **an active member's role can't be changed** (`PATCH /api/members/[id]` takes no `roleId`; the only path is re-inviting). Owner/Tenant must stay undeletable.
- [ ] **Payment → subscription link** — `/payment-complete` reports and grants nothing; needs the provider's webhook and a subscription row.
- [ ] ✔ **"Rentops" still shows** in `app/page.tsx`, `not-found.tsx`, `(auth)/layout`, `(auth)/login`, `payment-complete`, `app-loader`, `logo`, `org-switcher`, landing nav/sections (and `SITE_NAME` says Rentoo). Decide and sweep; the mail `service_name` is `"Jarvis"` on purpose.
- [ ] **Auto-renew flag: `Unit` or `Lease`?** Still open (case is in the archived transcript).
- [ ] ✔ **Invitations:** no resend (the token is only shown once, hashed after), revoking tells the holder nothing, `invitation.accepted` isn't wired. Emailing tenants is deployment-wide (`INVITE_EMAIL_OWNERS_ONLY`) — no per-org override.
- [ ] **Tenants receive no email at all** — if that should change, it's a deliberate channel decision (SMS is the obvious one). An org whose owners all lack an email logs the notice as sent and never retries.
- [ ] **A phone-only account can't reset its password** (delivery is email-only; the user sees the normal "check your messages" screen and nothing arrives). Needs SMS.
- [ ] Lease day counts: a lease flips to Ended at 00:00 UTC on its end date, so the badge for the end day itself can never show "today". Decide whether the end date is the last day *of* the lease or the first day after.
- [ ] **Templates:** no versioning (regeneration deletes the previous contract, so a signed contract's wording isn't recoverable); no "preview with a real lease"; the auto-created starter is English only; `tenant_nationality` is never backfilled; no undo/redo buttons, table row/column controls, or caret-aware font/size dropdowns; `execCommand` is deprecated (replace only when comments/revisions/collab arrive).
- [ ] **Documents & photos:** no cover photo or reordering; photos are served full-size into thumbnails (needs derivatives or a resize route); no per-file retry in `PhotoUploadDialog`; unit photos can't be deleted from the UI; file types can't be renamed/deleted; `allowsMultiple` is always true for custom types; no pagination on a member's documents; no "remove profile photo".
- [ ] ✔ **Backup** doesn't include `PaymentAccount` or `FileAsset`.
- [ ] Smaller: unit rent / lease rent inputs don't accept arithmetic; unit amenities aren't shown in the units table; there is no org-wide Invoices list page; `User.phone` is still nullable (11 legacy rows); leases created before billing may have no invoice and no "Issue invoice" action; per-entity tables (a property's units, a lease's payments) don't get sticky filters.

### Reliability & operations
- [ ] **SMS alerts tab isn't org-scoped** — notifier rows have no `organizationId`, so a phone that is a member of two orgs shows both orgs' texts. Fix needs an `organization_id` (or `reference`) on notifier's SMS payload + a filter. Also: notifier's HTTP API has no auth (keep it private-network only), and it has no message-text search.
- [ ] ✔ **A failed render is invisible** — the Generate button publishes and answers 202; "never made", "being made", "worker down" and "dead-lettered" look identical. The fix is a `DocumentJob` status row both this repo and `document-worker` can write (**does not exist**). Needs a decision first.
- [ ] **No DLQ drain or alert** on any `_DEAD` queue (`NOTIFIER_EMAIL_QUEUE_DEAD`, `DOCUMENT_WORKER_QUEUE_DEAD`, `LEASE_LIFECYCLE_QUEUE_DEAD`). A drain script shaped like `backfill:contracts` is a small first step.
- [ ] ✔ **Storage orphans** — cascade deletes remove `FileAsset` rows and leave the bytes; an org delete leaves its whole `organizations/<id>/` prefix. No reaper exists (`lib/storage.ts` / `lib/documents.ts` delete only via `deleteDocument`). Also sweep contract objects that have no `FileAsset` row.
- [ ] **No transactional outbox** — `publishMail`/`publishEvent` run after commit, so a crash in between loses the event. Fine for auth mail; matters for `lease.created`.
- [ ] `publishMail` has no timeout — during a broker outage it waits on amqplib recovery inside `after()`, bounded only by route max duration.
- [ ] ✔ **Unbounded tables:** `NotificationLog` is never pruned; expired reset/verification tokens are only deleted when touched. Add a sweep to the hourly cron.
- [ ] ✔ **Sessions survive a password reset** — no token version on the JWT, so resetting after a theft doesn't log the thief out (same gap `POST /api/account/password` documents).
- [ ] ✔ **Changing `User.email` doesn't clear `emailVerifiedAt`** (member PATCH and the profile editor).
- [ ] **Cross-org data isn't blocked by the DB** — a `Lease` can join a membership in one org to a unit in another (queries filter it; a CHECK or org column would stop it). `FileAsset` cross-org is a write-path rule only.
- [ ] Uploads are buffered through the route handler at 10MB and trust the client's MIME type (no magic-byte check, no virus scan). A presigned upload fixes size; sniffing fixes type. `FileAsset.sizeBytes` is `Int` (2GB).
- [ ] Sends are sequential per recipient; the in-memory rate limiters (`lib/rate-limit.ts`, lockout notice) are per process, so N instances means N budgets.
- [ ] Only some catalogue emails are wired: `lease.amended`, `lease.cancelled`, `lease.renewal_failed`, `payment.recorded`, `payment.reversed`, `payment_account.changed` and the digests are not. `auth.login.new_device` was dropped (no device tracking).
- [ ] Search is `contains`, not ranked full-text — move to `tsvector` + GIN when rows grow. Mobile "infinite scroll" reveals rows already in memory, so a table of thousands needs server pagination first.
- [ ] ✔ **`.env.production` has no `STORAGE_*` block** — production R2 values aren't recorded there (confirm where they are set).
- [ ] `notifier/.env.template` leaves `RABBITMQ_EMAIL_QUEUE=` blank; confirm the running notifier picked up `NOTIFIER_EMAIL_QUEUE` (0 consumers means mail accumulates).

### Never verified in a signed-in browser
Verified by code, CSS or direct function calls only; worth a click-through next time you're signed in: the Phase 38 rent field and "Monthly rent" row; the Phase 43 loader/sidebar/payments-in-search and hover states; Phase 42 reduced-motion; the successful path of the profile password change; the invitation accept form; the Phase 96 day-count badge.

## Shipped (index of the archive)

Phase numbers in the archive are not unique (two each of 28, 62 and 83) — search by title.

| Phases | What landed |
|---|---|
| 0–7 | Auth: email/phone + password, `jose` JWT, `proxy.ts`, registration creates the org |
| 8–18 | App shell, properties/units CRUD, users & tenants, edit member, org-less recovery |
| 19–26 | Dashboard cards and panels, tenant status fixes, roles page, multi-org switcher, global search |
| 27–31 | Railway readiness, toasts, Excel import for units and tenants, search polish |
| 32–39 | Billing: invoices, payments, auto-renew, lease editing, agreed rent, expiry tags |
| 40–56 | Perf and rate limiting, fonts, motion, mobile card views, arithmetic amounts, row actions, table search |
| 57–61 | Landing page, profile page, payment accounts |
| 62–66 | Delete organization, RabbitMQ + auth emails, password reset, email verification, notifications, lease mail events |
| 67–74 | `FileAsset`, documents, property/unit photos, `FileAssetType` table, profile photos |
| 75–79 | Lease templates with placeholders, WYSIWYG editor |
| 80–90 | Contract pipeline → PDF → storage, backfill, Excel export, org backup/restore, rendering moved to `document-worker` |
| 91–96 | One broker naming convention, emailed invitations, owners-only mail, invite verification, day-count fix |
| Later (2026-09) | Stored `Lease.status`; consumers start inside the server; hourly cron; `automatifier`-driven renewal/vacating (lazy sweep removed); auto-renew defaults; tours stored per user; pricing packages; hosted checkout; `/payment-complete` |
| Production Docker image | Multi-stage Node 24 build, Next.js standalone server, non-root runtime, migrations on startup, runtime secrets excluded from build context |

## Phase — snippe webhook

- [x] `BillingEvent` model + migration `billing_events` (append-only ledger, unique `eventId`)
- [x] `lib/billing/snippe-webhook.ts`: raw-byte HMAC-SHA256 verification, ±300s window, both payload versions
- [x] `POST /api/webhooks/snippe`: 503 unset secret / 401 bad signature / 200 stored or duplicate / 500 on write failure
- [x] `planCheckoutHref` sends snippe's `?meta=` blob (the old `?plan=&billing=` params were never forwarded)
- [x] Verified with `openssl`-signed requests across every path; build, `tsc`, lint clean

### Not done
- [ ] Set `SNIPPE_WEBHOOK_SECRET` on Railway (jarvis → production) **before** submitting the webhook URL to snippe
- [ ] Confirm `?meta=` survives on the `/pay/rentoo` page link with one real payment — documented for payment links, unproven on this one
- [ ] Attribution: a pricing-page payer has no organization yet — match on email/phone at signup, or an in-app upgrade link carrying the org id in `meta`
- [ ] Entitlement: nothing reads `BillingEvent` yet. Any grant must check `amount` against the plan's price, since `url_metadata` is payer-editable

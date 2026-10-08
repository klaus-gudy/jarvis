# TASKS

Working list. Architecture and standing rules are in `plan.md`.

> **History is archived.** ~96 phases of per-task checklists, verification notes and "not done" lists are in [`docs/archive/TASKS-2026-09-21.md`](docs/archive/TASKS-2026-09-21.md) (287KB — search it, don't load it). This file holds only **what is still open** plus a one-line-per-era index of what shipped.
>
> **Triage note (2026-09-21):** the open list below was rebuilt from the old "Not done" sections. Items that later phases resolved were dropped; the ones marked ✔ were re-checked against the code that day, the rest are carried over from the notes and worth a quick check before you build on them.
>
> **Working here:** add new work under *Open items* as `- [ ]`; when it lands, delete it (or move a one-line summary to *Shipped*). Don't append long verification write-ups — put standing rules in `plan.md`, and keep this file under ~150 lines.

## Open items

### Product gaps — decided 2026-10-08, build next
- [ ] **Branding:** "Rentoo" everywhere the user sees it, every string read from `SITE_NAME` (`app/page.tsx`, `not-found.tsx`, `(auth)/layout`, `(auth)/login`, `payment-complete`, `app-loader`, `logo`, `org-switcher`, landing). Mail `service_name` stays `"Jarvis"`.
- [ ] **Auto-renew:** `Unit.autoRenew` stays as the default; `Lease.autoRenew` is copied from it at creation and editable per lease; renewal and expiry notices read the lease.
- [ ] **End date = last day of the lease:** Ended from 00:00 the day *after* `endDate`; the badge can say "ends today". Check `leaseStatus()`, `syncLeaseStatuses`, overlap checks and renewal start dates.
- [ ] **Tenant email:** tenants with a verified email get lease created/renewed/ending, payment confirmed, claim rejected (with reason) and contract-ready-to-sign. Ends the owners-only rule for these events only. Phone-only users on the reset screen are told to ask their landlord to add an email (landlord edits it on the member page); no SMS reset.
- [ ] **Invitations:** "Resend" mints a new token (old one dies) and re-sends; wire `invitation.accepted` → email owners.
- [ ] **Contracts keep every version:** regenerate adds a contract and marks the old one superseded; a signed contract can't be deleted.
- [ ] **Template editor:** preview filled with a chosen real lease; a Swahili starter seeded beside the English one; backfill `tenant_nationality`.
- [ ] **Photo thumbnails:** resized derivatives so lists stop loading full-size photos.
- [ ] **Backup:** add `PaymentAccount` and `PaymentClaim` sheets (export + restore).
- [ ] **Payment claims:** required rejection reason (portal + tenant email); email owners on a new claim; tenant can attach a receipt (image/PDF).
- [ ] **Permissions:** grey out/hide write controls the API would refuse (lease detail, member page, documents panels); re-add the `roles` tour; seed the Tenant role in `createOrganizationForUser`.
- [ ] **Units table polish:** arithmetic in unit/lease rent inputs, amenities column, sticky filters on per-entity tables.
- [ ] **Subscriptions** (with the snippe phase below): a pay link clicked without an org sends the visitor to register first, then on to checkout with the org id in `meta`. Webhook creates a `Subscription` (plan, period, paid-until) only when `amount` matches the plan price; shown in Settings. No plan limits yet.

**Not chosen (2026-10-08):** cover photo/reorder, per-file upload retry, remove profile photo, custom file-type management, member-docs pagination; revoke notice and per-org invite-email override; undo/redo + table controls; FileAsset in backup; `DocumentJob` render status; org-wide Invoices page; "Issue invoice" for pre-billing leases; tenant pay-online; making `User.phone` required (stays nullable). Also still open: an org whose owners all lack an email logs a notice as sent and never retries.

- [ ] **Activity follow-ups:** the tenant portal has no activity view; there's no filter by person or action on `/activity`. **After deploy:** run `npm run activity:backfill -- --dry-run`, then run it for real against prod.

### Reliability & operations
- [ ] **Prod chores after deploy:** the legacy audience-less session fallback is gone (2026-10-08), so any cookie minted before 2026-09-29 now signs out — expected. Run `npm run templates:sanitize -- --dry-run` then for real against prod after deploy. Confirm `AUTH_SECRET` in Railway is ≥ 32 bytes (the app now refuses shorter) and that Railway appends to `X-Forwarded-For` (else set `TRUSTED_PROXY_HOPS`).
- [ ] **SMS alerts tab isn't org-scoped** — notifier rows have no `organizationId`, so a phone that is a member of two orgs shows both orgs' texts. Fix needs an `organization_id` (or `reference`) on notifier's SMS payload + a filter. Also: notifier's HTTP API has no auth (keep it private-network only), and it has no message-text search. **Send SMS** needs `sms:send`; the rate limit is still per process.
- [ ] ✔ **A failed render is invisible** — the Generate button publishes and answers 202; "never made", "being made", "worker down" and "dead-lettered" look identical. The fix is a `DocumentJob` status row both this repo and `document-worker` can write (**does not exist**). Needs a decision first.
- [ ] **No DLQ drain or alert** on any `_DEAD` queue (`NOTIFIER_EMAIL_QUEUE_DEAD`, `DOCUMENT_WORKER_QUEUE_DEAD`, `LEASE_LIFECYCLE_QUEUE_DEAD`). A drain script shaped like `backfill:contracts` is a small first step.
- [ ] **Signatures:** deleting a membership/org leaves its signature object in the bucket (add to the reaper below); tenants without portal access can never sign (by design — revisit if in-person signing on the owner's device is wanted).
- [ ] ✔ **Storage orphans** — cascade deletes remove `FileAsset` rows and leave the bytes; an org delete leaves its whole `organizations/<id>/` prefix. No reaper exists (`lib/storage.ts` / `lib/documents.ts` delete only via `deleteDocument`). Also sweep contract objects that have no `FileAsset` row.
- [ ] **No transactional outbox** — `publishMail`/`publishEvent` run after commit, so a crash in between loses the event. Fine for auth mail; matters for `lease.created`.
- [ ] `publishMail` has no timeout — during a broker outage it waits on amqplib recovery inside `after()`, bounded only by route max duration.
- [ ] ✔ **Unbounded tables:** `NotificationLog` is never pruned; expired reset/verification tokens are only deleted when touched. Add a sweep to the hourly cron.
- [ ] **Cross-org data isn't blocked by the DB** — a `Lease` can join a membership in one org to a unit in another (queries filter it; a CHECK or org column would stop it). `FileAsset` cross-org is a write-path rule only.
- [ ] Uploads are buffered through the route handler at 10MB and trust the client's MIME type (no magic-byte check, no virus scan). A presigned upload fixes size; sniffing fixes type. `FileAsset.sizeBytes` is `Int` (2GB).
- [ ] Sends are sequential per recipient; the in-memory rate limiters (`lib/rate-limit.ts`, lockout notice) are per process, so N instances means N budgets.
- [ ] Only some catalogue emails are wired: `lease.amended`, `lease.cancelled`, `lease.renewal_failed`, `payment.recorded`, `payment.reversed`, `payment_account.changed` and the digests are not. `auth.login.new_device` was dropped (no device tracking).
- [ ] Search is `contains`, not ranked full-text — move to `tsvector` + GIN when rows grow. Mobile "infinite scroll" reveals rows already in memory, so a table of thousands needs server pagination first.
- [ ] ✔ **`.env.production` has no `STORAGE_*` block** — production R2 values aren't recorded there (confirm where they are set).
- [ ] `notifier/.env.template` leaves `RABBITMQ_EMAIL_QUEUE=` blank; confirm the running notifier picked up `NOTIFIER_EMAIL_QUEUE` (0 consumers means mail accumulates).

### Never verified in a signed-in browser
Verified by code, CSS or direct function calls only; worth a click-through next time you're signed in: the tenant portal sections and profile edit (2026-09-27, needs a tenant login); the Phase 38 rent field and "Monthly rent" row; the Phase 43 loader/sidebar/payments-in-search and hover states; Phase 42 reduced-motion; the successful path of the profile password change; the invitation accept form; the Phase 96 day-count badge; the lease Overview's "Renewed from / Renewed as" rows and their hover previews (2026-09-29/30, no renewed pair in the local DB).

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
- [ ] Attribution + entitlement: see **Subscriptions** under Product gaps

# TASKS

Working list. Architecture and standing rules are in `plan.md`.

> **History is archived.** ~96 phases of per-task checklists, verification notes and "not done" lists are in [`docs/archive/TASKS-2026-09-21.md`](docs/archive/TASKS-2026-09-21.md) (287KB — search it, don't load it). This file holds only **what is still open** plus a one-line-per-era index of what shipped.
>
> **Triage note (2026-09-21):** the open list below was rebuilt from the old "Not done" sections. Items that later phases resolved were dropped; the ones marked ✔ were re-checked against the code that day, the rest are carried over from the notes and worth a quick check before you build on them.
>
> **Working here:** add new work under *Open items* as `- [ ]`; when it lands, delete it (or move a one-line summary to *Shipped*). Don't append long verification write-ups — put standing rules in `plan.md`, and keep this file under ~150 lines.

## Open items

### Product gaps

The 2026-10-08 build list has shipped (see *Shipped*). **Not chosen (2026-10-08):** cover photo/reorder, per-file upload retry, remove profile photo, custom file-type management, member-docs pagination; revoke notice and per-org invite-email override; undo/redo + table controls; FileAsset in backup; `DocumentJob` render status; org-wide Invoices page; "Issue invoice" for pre-billing leases; tenant pay-online; making `User.phone` required (stays nullable). Also still open: an org whose owners all lack an email logs a notice as sent and never retries.

- [ ] **Activity follow-ups:** the tenant portal has no activity view; there's no filter by person or action on `/activity`. **After deploy:** run `npm run activity:backfill -- --dry-run`, then run it for real against prod.

### Reliability & operations
- [ ] **Deploy order (2026-10-08):** migrate this app **before** deploying `automatifier` (it now reads `Lease.autoRenew`). Expect one day of shifted reminder tiers: day counts now measure to the last day, so a lease can skip one tier on the switch-over day.
- [ ] **After deploy (2026-10-08):** `npm run templates:add-swahili -- --dry-run` then for real; decide whether to run `npm run members:backfill-nationality -- --nationality=Tanzanian` (add `--with-nida` to limit it) — the value is your call, the script infers nothing.
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
- [ ] Only some catalogue emails are wired: `lease.amended`, `lease.cancelled`, `lease.renewal_failed`, `payment.reversed`, `payment_account.changed` and the digests are not. `auth.login.new_device` was dropped (no device tracking).
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
| 2026-10-08 | Rentoo branding sweep; write controls hidden by permission (documents, photos, member edit, create lease); roles tour; Tenant role seeded on org create; arithmetic rent inputs, amenities column, per-entity sticky filters; backup carries PaymentAccounts + PaymentClaims |
| 2026-10-08 | Per-lease auto-renew (unit is the default); end dates shown as the last day everywhere incl. `automatifier`; renewals start with no gap; contract versions kept, signed ones undeletable |
| 2026-10-08 | Tenant email at verified addresses (lease, payment, claim, contract) + opt-in verification; claim rejection reasons, receipts, owner alert; invitation resend + accepted notice; reset copy for phone-only users |
| 2026-10-08 | Swahili starter template seeded (+ script for existing orgs); real-lease template preview; tenant nationality on create/import + backfill script; image thumbnails via `?w=` |
| 2026-10-08 | Subscriptions: `/subscribe` gate (register / verify / create org first), org in checkout `meta`, webhook grants on exact price match, Settings → Billing |
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
- [ ] Plan limits: nothing reads `Subscription` to restrict anything yet (decided 2026-10-08: record first, limit later)

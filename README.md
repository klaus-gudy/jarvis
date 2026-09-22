<div align="center">

# Rentoo

**Property management for Tanzanian landlords.**
Rent, tenants, leases and payments in one place — priced in TZS, built around M-Pesa, Tigo Pesa and Airtel Money.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

</div>

> **Rentoo** is the product name; **Jarvis** is the codename this repository, its database and its services still go by.

---

## What it does

A landlord signs up, names an organization, and can run a portfolio from one screen:

| | |
|---|---|
| **Properties & units** | Buildings and the units inside them, with photos and documents filed against each. Every unit carries its own auto-renew setting and minimum tenure. |
| **Tenants** | Tenants are members of your organization with a profile, a payment history and their own login — not a separate silo of records. |
| **Leases** | Create, edit and renew leases with overlap checks so a unit can never be double-booked. Status (`Upcoming → Active → Ended / Renewed`) is stored, not guessed from dates. |
| **Contracts** | Write a lease template once, with `{{placeholders}}` for the tenant, unit, rent and dates. Every new lease renders into a PDF contract and files itself on the lease. |
| **Invoices & payments** | Every lease raises an invoice; record payments against it and see exactly who has paid what, per tenant or across the organization. |
| **Auto-renewal** | Leases renew or end on their own when the term is up, driven by events rather than someone opening a page. |
| **Reminders** | Owners get email for the things a landlord acts on — new leases, renewals, expiries, overdue invoices. Sent once, however often the job runs. |
| **Teams & invitations** | Invite people by email or a shareable link, with org-scoped roles. An organization can never be left without an Owner. |
| **Import, export & backup** | Bulk-load units and tenants from Excel, export any list, or download a full organization backup and restore it into a fresh one. |
| **Guided tours** | Six short product tours that remember what you have seen — on your account, not your browser. |
| **Light & dark** | Both themes, and a phone-friendly layout throughout. |

## How it fits together

Jarvis owns the data and the web app. The slow or scheduled work — rendering PDFs, sending mail, watching the clock — lives in small neighbouring services that talk to it over RabbitMQ.

```mermaid
flowchart LR
    subgraph app["Jarvis (this repo)"]
        web["Next.js app<br/>pages + API routes"]
        cons["Queue consumers<br/>(start with the server)"]
    end

    db[("PostgreSQL")]
    s3[("Object storage<br/>MinIO / Cloudflare R2")]
    mq{{"RabbitMQ"}}

    dw["document-worker<br/>renders PDFs"]
    nt["notifier<br/>sends email"]
    au["automatifier<br/>owns the clock"]

    web <--> db
    cons --> db
    web -- "lease.created<br/>(html + key)" --> mq
    mq --> dw
    dw -- "PDF" --> s3
    dw -- "document.stored" --> mq
    mq --> cons
    web -- "mail messages" --> mq
    mq --> nt
    au -- "lease.renewal<br/>lease.vacating" --> mq
    mq --> cons
    web -- "files & downloads" --> s3
```

A few decisions worth knowing before you dig in:

- **The web app never renders a PDF.** It publishes `lease.created` with the contract HTML and a target key; the [`document-worker`](../document-worker) service renders it, uploads it, and announces `document.stored`. There is no Playwright or Chromium in this repo, and an ESLint rule keeps it that way.
- **The consumers run inside the Next.js server.** `instrumentation.ts` starts them on boot, so deploying the app deploys its consumers. This assumes a long-lived container, not serverless.
- **`automatifier` owns the clock, Jarvis owns the tables.** It publishes "this lease's term is up"; Jarvis re-reads the lease and decides. Every handler is idempotent against an at-least-once bus.
- **Tenancy is a prefix, not a bucket.** One storage bucket serves every organization, with keys namespaced `organizations/<orgId>/…`.

The full reasoning behind each of these — and the dozens of smaller calls — is in [`plan.md`](plan.md), with the full history in [`docs/archive/`](docs/archive).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript strict |
| UI | Tailwind 4, [shadcn](https://ui.shadcn.com) on `@base-ui/react` (not Radix), `lucide-react`, `motion`, `sonner` |
| Data | Prisma 7 with the `@prisma/adapter-pg` driver adapter, PostgreSQL 16 |
| Auth | Email or phone + password, `bcryptjs`, signed session cookie via `jose`, route protection in `proxy.ts` |
| Messaging | RabbitMQ (`amqplib`) |
| Files | S3 API — MinIO locally, Cloudflare R2 in production |
| Spreadsheets | `exceljs` for import, export and backups |
| Validation | `zod` |

> **Heads up:** this is a recent Next.js with breaking changes from older versions (middleware is now `proxy.ts`, for one). When in doubt, read the guides in `node_modules/next/dist/docs/` rather than trusting memory.

## Getting started

**You will need** Node.js 20+, npm and Docker.

**1. Install**

```bash
npm install
```

`postinstall` generates the Prisma client into `lib/generated/prisma`.

**2. Start the backing services**

```bash
docker compose up -d
```

This brings up everything the app depends on, on deliberately shifted ports so it will not collide with anything you already run:

| Service | Host port | Notes |
|---|---|---|
| PostgreSQL 16 | `5439` | database `jarvis`, user and password `postgres` |
| RabbitMQ | `5682` | management UI at [localhost:15682](http://localhost:15682), `guest` / `guest` |
| MinIO | `9000` | console at [localhost:9001](http://localhost:9001), `minioadmin` / `minioadmin123` |

A one-shot `minio-init` container creates the `jarvis-files` bucket, so the first upload does not fail with `NoSuchBucket`.

**3. Configure**

```bash
cp .env.example .env
```

Then fill in the blanks. For local development:

```bash
AUTH_SECRET="<any long random string — e.g. output of: openssl rand -base64 32>"
CRON_SECRET="<any string; guards the scheduled-jobs endpoint>"

STORAGE_ENDPOINT="http://localhost:9000"
STORAGE_BUCKET="jarvis-files"
STORAGE_ACCESS_KEY_ID="minioadmin"
STORAGE_SECRET_ACCESS_KEY="minioadmin123"
```

Everything else can stay empty — see [Environment variables](#environment-variables).

**4. Migrate the database**

```bash
npx prisma migrate dev
```

**5. Run it**

```bash
npm run dev
```

Open **[http://localhost:3347](http://localhost:3347)**, register, and the account you create becomes the Owner of the organization you name at signup.

> **Contracts need one more service.** Creating a lease publishes a render request, but the PDF itself is produced by [`document-worker`](../document-worker) (port 3400). Without it running, leases still save; they just have no contract until it is up. Backfill any that were missed with `npm run backfill:contracts -- --dry-run`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port **3347**. Also starts the queue consumers. |
| `npm run build` | Production build. |
| `npm start` | `prisma migrate deploy`, then `next start`. |
| `npm run lint` | ESLint. |
| `npm run worker` | Run the document consumer on its own — consumes `document.stored` and files the `FileAsset` row. Handy for watching one consumer's log in isolation. |
| `npm run worker:leases` | Run the lease consumer on its own — renews or ends leases on `lease.renewal` / `lease.vacating` from `automatifier`. |
| `npm run backfill:contracts` | Queue contracts for leases that have none. Flags: `--dry-run`, `--org=<id>`, `--limit=<n>`. |
| `npm run studio:local` | Prisma Studio on port 5555. |
| `npx prisma migrate dev --name <name>` | Create and apply a migration. |
| `npx prisma generate` | Regenerate the client after a schema change. |

## Environment variables

Only the first group is required to boot. The messaging variables have defaults that match `docker-compose.yml`, so you set them only to point somewhere else.

**Required**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. The example points at `localhost:5439`. |
| `AUTH_SECRET` | Signs session tokens (HS256). |
| `STORAGE_ENDPOINT` `STORAGE_BUCKET` `STORAGE_ACCESS_KEY_ID` `STORAGE_SECRET_ACCESS_KEY` | S3-compatible object store. Moving from MinIO to R2 changes only these four. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/notifications`. The route refuses to run without it. |

**Optional**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | — | Port override for the server (`npm run dev` pins **3347**). |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical origin, used in metadata and emailed links. |
| `NEXT_PUBLIC_CHECKOUT_URL` | hosted checkout link | Where every "pay us" button leads. Inlined **at build time** — set it where `next build` runs. |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5682` | The broker. |
| `EVENTS_EXCHANGE` | `jarvis.events` | Domain events exchange. |
| `DOCUMENTS_QUEUE` | `JARVIS_DOCUMENTS_QUEUE` | Queue for `document.stored`. |
| `LEASE_CREATED_ROUTING_KEY` `DOCUMENT_STORED_ROUTING_KEY` | `lease.created` `document.stored` | Wire keys; must match `document-worker`. |
| `AUTOMATIFIER_EXCHANGE` | `automatifier.events` | Where lease lifecycle events arrive from. |
| `LEASE_LIFECYCLE_QUEUE` | `LEASE_LIFECYCLE_QUEUE` | Queue for `lease.renewal` / `lease.vacating`. |
| `LEASE_RENEWAL_ROUTING_KEY` `LEASE_VACATING_ROUTING_KEY` | `lease.renewal` `lease.vacating` | Wire keys for the above. |
| `MAIL_EXCHANGE` `MAIL_QUEUE` `MAIL_SERVICE_NAME` | `jarvis.emails` `NOTIFIER_EMAIL_QUEUE` `Jarvis` | Where rendered emails go for the `notifier` service. |
| `INVITE_EMAIL_OWNERS_ONLY` | `true` | Email invitations to Owners only; other roles get a link to share by hand. |

Naming convention on the broker: queues are `UPPER_SNAKE`, named for who consumes them; routing keys are `lowercase.dotted`, named for what happened. Dead-letter queues are `<QUEUE>_DEAD`.

## Scheduled jobs

Point any scheduler at this once an hour:

```bash
curl -X POST https://<your-host>/api/cron/notifications \
  -H "Authorization: Bearer $CRON_SECRET"
```

It moves leases from Upcoming to Active and sends due reminders. Running it more often is harmless — every send is claimed through a unique key first, so a second run finds nothing left to do.

## Project layout

```
app/
  (app)/          Signed-in product: dashboard, properties, tenants, leases,
                  payments, users, settings, profile
  (auth)/         Login, register, invitations, verification, password reset
  api/            Route handlers — each one enforces its own auth
  payment-complete/  Public return page after hosted checkout
components/       UI, including shadcn primitives in components/ui
lib/              Domain logic — one module per concern (leases, payments,
                  invoices, contracts, roles…), plus lib/events and lib/mail
prisma/           schema.prisma and migrations
worker/           Thin entry points over the queue consumers, and the backfill
instrumentation.ts  Starts the consumers with the server
proxy.ts          Route protection (Next 16's replacement for middleware)
```

## Conventions

- **Prisma client** is generated to `lib/generated/prisma` (gitignored). Always import the singleton from `@/lib/prisma` — never construct a `PrismaClient` elsewhere.
- **Ids** are `cuid()`.
- **Adding a shadcn component:** use `npx shadcn add <name>`, then read the diff — it can overwrite unrelated files in `components/ui/`. Revert anything you did not ask for.
- **Dark mode** is the `.dark` class on `<html>` via `next-themes`; keep `suppressHydrationWarning` there.
- **Standalone scripts** need `import "dotenv/config"` to see `DATABASE_URL`.

## Where to read next

| | |
|---|---|
| [`plan.md`](plan.md) | Architecture and standing rules — *why* things are the way they are. Read this first. |
| [`TASKS.md`](TASKS.md) | What is still open, plus an index of what has shipped. |
| [`docs/archive/`](docs/archive) | The full, uncompacted `plan.md` and `TASKS.md` history as of 2026-09-21. Search it when you need the reasoning behind a rule. |
| [`AGENTS.md`](AGENTS.md) | The short project brief that AI coding agents load each session. |

## Deployment

The app is built to run as a **long-lived container** (it is deployed on Railway): `npm start` applies pending migrations and then serves, and the queue consumers start with it. Set `NEXT_PUBLIC_*` variables wherever `next build` runs, since they are inlined at build time.

Production uses Cloudflare R2 for files and runs the neighbouring `document-worker`, `notifier` and `automatifier` services alongside the app, all sharing one RabbitMQ broker.

### Production Docker image

The multi-stage `Dockerfile` uses Node 24.18.0, generates Prisma Client during dependency installation, and builds Next.js standalone output. The final image runs as the unprivileged `node` user and includes production dependencies, including the Prisma CLI and engines needed for migrations. Its entrypoint applies migrations before starting `server.js`; a failed migration prevents startup. The app's RabbitMQ consumers start with the server.

```bash
docker build -t jarvis:local \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-app.example \
  --build-arg NEXT_PUBLIC_CHECKOUT_URL=https://snippe.me/pay/rentoo .
docker run --rm --name jarvis-app -p 3347:3347 \
  --env-file /path/to/runtime.env jarvis:local
```

Set `DATABASE_URL`, authentication secrets, RabbitMQ, storage, and other server settings in the runtime environment (see `.env.example`). Local `.env*` files are excluded from the build context. The two `NEXT_PUBLIC_*` settings above are public build arguments: changing them requires rebuilding the image. Building also downloads the Google fonts used by the app.

The image defaults to port 3347 and listens on `0.0.0.0`; a runtime `PORT` overrides it. For Docker Desktop with the infrastructure in `docker-compose.yml`, runtime URLs can use `host.docker.internal` with host ports 5439 (Postgres), 5682 (RabbitMQ), and 9000 (MinIO). `localhost` inside the app container points to the app container itself.

On Railway, use this Dockerfile and its default entrypoint/command; remove any start-command override that invokes `npm start`, because this image runs the standalone `server.js`. Supply the public build arguments during the build and secrets at runtime. The existing Compose file remains the local infrastructure setup, and `npm run dev` remains the development workflow.

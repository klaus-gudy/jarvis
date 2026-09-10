<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jarvis — project brief

Multi-tenant property management app. See `plan.md` (architecture + decisions) and `TASKS.md` (current sprint checklist).

## Stack

- Next.js 16.2.12, App Router, TypeScript strict
- Tailwind 4 + shadcn built on `@base-ui/react` — **NOT Radix**. Add components only via `npx shadcn add <name>`, then **read the diff**: it overwrites unrelated `components/ui/*` files (it reverted `button.tsx`'s hover variants once). Revert anything outside the component you asked for
- Prisma 7.9 + Postgres 16 in Docker (host port **5439**, db `jarvis`)
- Dev server port **3347**; Prisma Studio on 5555

## Commands

- `docker compose up -d` — start Postgres
- `npm run dev` — dev server (port 3347)
- `npm run worker` — document worker; consumes `document.stored`, files the `FileAsset` row
- **PDF rendering lives in the separate `document-worker` service** (`../document-worker`, NestJS, port 3400). Jarvis publishes `lease.created` carrying `{ html, objectKey }`; that service renders and uploads, then announces `document.stored`. **No Playwright or Chromium in this repo** — an ESLint rule blocks importing one back in
- `npm run backfill:contracts -- --dry-run` — queue contracts for leases missing one (`--org=`, `--limit=`)
- `npx prisma migrate dev --name <name>` — migrate; `npx prisma generate` — regenerate client
- `npx prisma studio --port 5555 --browser none` — data browser

## Conventions

- Prisma client is generated to `lib/generated/prisma` (gitignored). **Always import the singleton from `@/lib/prisma`** — never construct `PrismaClient` elsewhere. Prisma 7 requires the driver adapter (`@prisma/adapter-pg`); datasource URL lives in `prisma.config.ts` + `.env`
- Ids are `cuid()` (`HealthCheck` is legacy `uuid()`)
- Dark mode via `.dark` class on `<html>` (`next-themes`); `suppressHydrationWarning` on `<html>` is required
- Standalone scripts need `import "dotenv/config"` to see `DATABASE_URL`

## Session workflow (context-window protection)

- At session start: read `plan.md` + `TASKS.md` before exploring code
- Check off `TASKS.md` items as work lands; add new decisions to the `plan.md` decision log
- Keep this file under ~60 lines — it loads every session

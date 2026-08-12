This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## File storage

Documents and images live in object storage, not in Postgres. The app talks S3
everywhere, so the same code runs against a local MinIO container in
development and Cloudflare R2 in production — the four `STORAGE_*` variables
are the only difference.

### Local

`docker compose up -d` starts MinIO alongside Postgres and creates the bucket.
Nothing else to set up; `.env` already points at it.

- API: `http://localhost:9010` (9000 is taken by another project on this machine)
- Console: `http://localhost:9011` — sign in with `jarvis` / `jarvis-dev-secret`

```
STORAGE_ENDPOINT=http://localhost:9010
STORAGE_BUCKET=jarvis-files
STORAGE_ACCESS_KEY_ID=jarvis
STORAGE_SECRET_ACCESS_KEY=jarvis-dev-secret
```

### Production (Cloudflare R2 on Railway)

1. Create an R2 bucket. Keep it **private** — the app never serves objects
   directly, it redirects to presigned URLs that expire in five minutes.
2. Create an R2 API token scoped to that bucket (Object Read & Write).
3. Set these Railway variables:

```
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_BUCKET=<bucket-name>
STORAGE_ACCESS_KEY_ID=<access-key-id>
STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
```

4. **Add a CORS policy to the bucket**, or every upload fails in the browser
   with an opaque network error. Uploads go straight from the browser to R2, so
   the bucket has to accept them from the app's origin:

```json
[
  {
    "AllowedOrigins": ["https://<your-app>.up.railway.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Downloads need no CORS rule — the browser is redirected to the object and
navigates to it rather than fetching it cross-origin.

Any S3-compatible provider works in place of R2 (Backblaze B2, Supabase
Storage, plain S3): change the four variables and the bucket's CORS policy.

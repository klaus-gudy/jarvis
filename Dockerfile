# syntax=docker/dockerfile:1
FROM node:24.18.0-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3347
ARG NEXT_PUBLIC_CHECKOUT_URL=https://snippe.me/pay/rentoo
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CHECKOUT_URL=$NEXT_PUBLIC_CHECKOUT_URL
RUN npm run build

# Keep the locked Prisma CLI and its engines for migrations at startup.
FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3347 \
    HOSTNAME=0.0.0.0
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint
USER node
EXPOSE 3347
ENTRYPOINT ["docker-entrypoint"]
CMD ["node", "server.js"]
